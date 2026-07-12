import os
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from decimal import Decimal
import datetime

from .database import engine, Base, get_db
from .models import College, Branch, CollegeBranch, Cutoff, VacancySeat, Student, PreferenceList, PreferenceItem, UploadedDocument, StudentQuery, District, University, AcademicYear
from .schemas import (
    UserRegister, UserLogin, Token, UserOut, StudentProfile, PredictionRequest, PredictionResult,
    CollegeOut, BranchOut, PreferenceListCreate, PreferenceListOut, PreferenceReviewResponse,
    CompareRequest, ChatRequest, ChatResponse, UploadedDocumentOut,
    PreferenceReviewStatelessRequest, ExportStatelessRequest
)
from .auth import hash_password, verify_password, create_access_token, get_current_user, get_current_admin
from .prediction_service import PredictionService
# RAGService, MHTCETPDFParser, DocumentGenerator are imported lazily inside functions
# to avoid startup crash if chromadb native extensions are unavailable

# Create tables (wrapped in try/except to prevent startup crash if DB is unreachable)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"WARNING: Could not create tables on startup: {e}")
    print("Tables will be created on first successful DB connection.")

app = FastAPI(title="MHT CET AI College Predictor API", version="1.0.0")

@app.on_event("startup")
def startup_event():
    print("MHT-CET BACKEND STARTING UP - REFRESHED VERSION 1.0.1")


# Health check + DB debug endpoint
@app.get("/health")
def health_check():
    import os
    db_url = os.getenv("DATABASE_URL", "NOT SET")
    # Mask password
    import re
    masked = re.sub(r':[^@]+@', ':***@', db_url) if db_url else "NOT SET"
    # Try to connect using psycopg2 manually to see error
    errors = {}
    try:
        from sqlalchemy import create_engine, text
        # Strategy 1: psycopg2
        url_psycopg2 = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        eng_p = create_engine(url_psycopg2)
        with eng_p.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM colleges")).scalar()
        return {"status": "ok", "driver": "psycopg2", "db": masked, "colleges": count}
    except Exception as e:
        errors["psycopg2"] = str(e)
        
    try:
        from sqlalchemy import create_engine, text
        # Strategy 2: pg8000
        url_pg = db_url
        if not url_pg.startswith("postgresql+pg8000://"):
            url_pg = url_pg.replace("postgresql://", "postgresql+pg8000://", 1)
        eng_g = create_engine(url_pg)
        with eng_g.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM colleges")).scalar()
        return {"status": "ok", "driver": "pg8000", "db": masked, "colleges": count}
    except Exception as e:
        errors["pg8000"] = str(e)

    # Fallback to local SQLite if both cloud postgres strategies fail
    try:
        from sqlalchemy import create_engine, text
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mhtcet.db"))
        eng_sqlite = create_engine(f"sqlite:///{db_path}")
        with eng_sqlite.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM colleges")).scalar()
        return {"status": "fallback_sqlite", "db": "sqlite", "colleges": count, "errors": errors}
    except Exception as e:
        return {"status": "db_error", "db": masked, "error": str(e), "errors": errors}

# CORS middleware for Next.js communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Background Task for PDF Processing ---
def process_pdf_background(
    doc_id: int,
    file_path: str,
    file_type: str,
    academic_year: str,
    cap_round: Optional[int]
):
    # Setup fresh database session
    from .database import SessionLocal
    db = SessionLocal()
    doc = db.query(UploadedDocument).filter(UploadedDocument.id == doc_id).first()
    if not doc:
        db.close()
        return
        
    try:
        from .pdf_parser import MHTCETPDFParser
        from .rag_service import RAGService
        api_key = os.getenv("GEMINI_API_KEY")
        parser = MHTCETPDFParser(db, gemini_api_key=api_key)
        rag_service = RAGService(db, gemini_api_key=api_key)
        
        if file_type == "cutoff":
            recs = parser.parse_cutoff_pdf(file_path, academic_year, cap_round or 1)
            doc.error_message = f"Successfully parsed {recs} cutoff records."
        elif file_type == "vacancy":
            recs = parser.parse_vacancy_pdf(file_path, academic_year, cap_round or 1)
            doc.error_message = f"Successfully parsed {recs} vacancy records."
        elif file_type == "seat_matrix":
            # Parse structured seat data into SQL DB (College, Branch, CollegeBranch)
            recs = parser.parse_seat_matrix_pdf(file_path, academic_year)
            doc.error_message = f"Successfully parsed {recs} college-branch seat records."
        else:
            # Unstructured PDFs: fees, placement, hostel, etc.
            success, msg = parser.extract_unstructured_pdf_data(file_path, academic_year)
            if not success:
                raise Exception(msg)
                
            # Chunk and Index in vector DB
            chunks = rag_service.add_pdf_to_vector_db(file_path, doc_id, doc.filename)
            doc.error_message = f"{msg} Added {chunks} semantic chunks to Vector DB."
            
        doc.status = "completed"
        db.commit()
    except Exception as e:
        db.rollback()
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
    finally:
        db.close()

# --- AUTHENTICATION ROUTES ---
@app.post("/api/auth/register", response_model=UserOut)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(Student).filter(Student.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Check if first user, make admin for ease of configuration
    is_admin = db.query(Student).count() == 0
    
    hashed = hash_password(user_in.password)
    new_user = Student(
        email=user_in.email,
        password_hash=hashed,
        name=user_in.name,
        is_admin=is_admin,
        profile_data=None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(Student).filter(Student.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserOut)
def get_me(current_user: Student = Depends(get_current_user)):
    return current_user

@app.put("/api/auth/profile", response_model=UserOut)
def update_profile(profile: StudentProfile, current_user: Student = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.profile_data = profile.dict()
    db.commit()
    db.refresh(current_user)
    return current_user

# --- PREDICTION ROUTES ---
@app.post("/api/predict", response_model=Dict[str, List[PredictionResult]])
def predict_colleges(req: PredictionRequest, db: Session = Depends(get_db)):
    pred_service = PredictionService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    
    # Fetch all colleges matching filters
    query = db.query(College)
    
    # 1. District Filters
    if req.preferred_districts:
        # Match district names
        query = query.join(District).filter(District.name.in_(req.preferred_districts))
        
    # 2. Govt / Private Preference
    if req.gov_private_pref == "GOVT":
        query = query.filter(College.status.in_(["Government", "Government Aided", "University Managed"]))
    elif req.gov_private_pref == "PVT":
        query = query.filter(College.status == "Private")
        
    # 3. Autonomous Pref
    if req.autonomous_pref == "AUTONOMOUS":
        query = query.filter(College.autonomous == True)
    elif req.autonomous_pref == "NON-AUTONOMOUS":
        query = query.filter(College.autonomous == False)
        
    # 4. Fees limit
    if req.max_fees:
        query = query.filter(College.fees <= req.max_fees)
        
    # 5. Hostel Required
    if req.hostel_required:
        query = query.filter(College.hostel_availability == True)
        
    colleges = query.all()
    
    # For matching branches
    branches_filter = req.preferred_branches
    
    results = {
        "Safe": [],
        "High Chance": [],
        "Moderate Chance": [],
        "Dream": []
    }
    
    for col in colleges:
        # Get branches offered by this college
        for cb in col.branches:
            br = cb.branch
            
            # Filter branch
            # Matches if preferred_branches is empty or branch code/name matches
            if branches_filter:
                match_branch = False
                for pref_br in branches_filter:
                    if pref_br.lower() in br.name.lower() or pref_br == br.code:
                        match_branch = True
                        break
                if not match_branch:
                    continue
            
            # Predict
            pred = pred_service.calculate_admission_probability(
                student_percentile=req.percentile,
                student_rank=req.rank,
                college_code=col.code,
                branch_code=br.code,
                category=req.category,
                gender=req.gender,
                home_university=req.home_university,
                minority_status=req.minority_status
            )
            
            status_bucket = pred["status"]
            # Map "High Chance" to "High Chance" bucket, others as is
            bucket = "High Chance" if status_bucket == "High Chance" else status_bucket
            if status_bucket == "Safe":
                bucket = "Safe"
            elif status_bucket == "Moderate Chance":
                bucket = "Moderate Chance"
            elif status_bucket == "Dream":
                bucket = "Dream"
                
            # Fetch vacant seats
            # Find latest recorded vacant seats
            latest_vacancy = db.query(VacancySeat).filter(
                VacancySeat.college_code == col.code,
                VacancySeat.branch_code == br.code
            ).order_by(VacancySeat.cap_round.desc()).first()
            
            vacant_count = latest_vacancy.vacant_seats if latest_vacancy else 0
            
            # Build prediction output
            res = PredictionResult(
                college=CollegeOut.model_validate(col),
                branch=BranchOut.model_validate(br),
                cap_round=pred["history"].get(max(pred["history"].keys()), {}).get("round", 1) if pred["history"] else 1,
                seat_type=pred["history"].get(max(pred["history"].keys()), {}).get("seat_type", "GOPENH") if pred["history"] else "GOPENH",
                admission_probability=pred["probability"],
                category_closing_percentiles={
                    yr: [{"round": vals["round"], "percentile": Decimal(str(vals["percentile"])), "rank": vals["rank"]}]
                    for yr, vals in pred["history"].items()
                },
                current_vacant_seats=vacant_count,
                previous_vacant_seats=0, # set dummy or fetch previous year
                explanation=pred["explanation"]
            )
            
            results[bucket].append(res)
            
    # Sort buckets by probability descending
    for b in results:
        results[b] = sorted(results[b], key=lambda x: x.admission_probability, reverse=True)[:50] # Cap top 50 per bucket
        
    return results

# --- PREFERENCE LIST ROUTES ---
@app.post("/api/preferences", response_model=PreferenceListOut)
def create_preference_list(req: PreferenceListCreate, current_user: Student = Depends(get_current_user), db: Session = Depends(get_db)):
    # Delete existing preference lists for simplicity or keep multiple
    existing = db.query(PreferenceList).filter(PreferenceList.student_id == current_user.id).first()
    if existing:
        db.delete(existing)
        db.commit()
        
    pref_list = PreferenceList(student_id=current_user.id, name=req.name)
    db.add(pref_list)
    db.commit()
    db.refresh(pref_list)
    
    for item in req.items:
        pref_item = PreferenceItem(
            preference_list_id=pref_list.id,
            college_code=item.college_code,
            branch_code=item.branch_code,
            preference_order=item.preference_order,
            locked=item.locked
        )
        db.add(pref_item)
        
    db.commit()
    db.refresh(pref_list)
    return pref_list

@app.get("/api/preferences/active", response_model=PreferenceListOut)
def get_active_preference_list(current_user: Student = Depends(get_current_user), db: Session = Depends(get_db)):
    pref_list = db.query(PreferenceList).filter(PreferenceList.student_id == current_user.id).first()
    if not pref_list:
        # Create empty preference list
        pref_list = PreferenceList(student_id=current_user.id, name="My CAP Preference List")
        db.add(pref_list)
        db.commit()
        db.refresh(pref_list)
    return pref_list

@app.post("/api/preferences/review", response_model=PreferenceReviewResponse)
def review_preferences(current_user: Student = Depends(get_current_user), db: Session = Depends(get_db)):
    pref_list = db.query(PreferenceList).filter(PreferenceList.student_id == current_user.id).first()
    if not pref_list or not pref_list.items:
        return PreferenceReviewResponse(
            has_warnings=False,
            warnings=["No preferences saved yet."],
            risky_choices=[],
            missing_recommendations=[],
            overall_score=0.0
        )
        
    prof = current_user.profile_data
    if not prof:
        raise HTTPException(status_code=400, detail="Please complete your student profile scores first.")
        
    pred_service = PredictionService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    
    pref_tuples = [(item.college_code, item.branch_code) for item in pref_list.items]
    
    review = pred_service.review_preference_list(
        student_percentile=prof["percentile"],
        student_rank=prof["rank"],
        category=prof["category"],
        gender=prof["gender"],
        home_university=prof["home_university"],
        preferences=pref_tuples,
        minority_status=prof.get("minority_status")
    )
    
    risky = [
        f"{item['college_name']} ({item['branch_name']})"
        for item in review["evaluated_items"]
        if item["status"] == "Dream"
    ]
    
    return PreferenceReviewResponse(
        has_warnings=len(review["warnings"]) > 0,
        warnings=review["warnings"],
        risky_choices=risky,
        missing_recommendations=review["suggested_colleges"],
        overall_score=review["overall_score"]
    )

# --- EXPORT PREFERENCE REPORTS ---
@app.get("/api/preferences/download/pdf")
def download_pdf(current_user: Student = Depends(get_current_user), db: Session = Depends(get_db)):
    pref_list = db.query(PreferenceList).filter(PreferenceList.student_id == current_user.id).first()
    prof = current_user.profile_data
    if not pref_list or not prof:
        raise HTTPException(status_code=400, detail="Incomplete preference list or profile scores.")
        
    # Evaluate items
    pred_service = PredictionService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    evaluated_items = []
    
    for item in pref_list.items:
        pred = pred_service.calculate_admission_probability(
            student_percentile=prof["percentile"],
            student_rank=prof["rank"],
            college_code=item.college_code,
            branch_code=item.branch_code,
            category=prof["category"],
            gender=prof["gender"],
            home_university=prof["home_university"],
            minority_status=prof.get("minority_status")
        )
        evaluated_items.append({
            "preference_order": item.preference_order,
            "college_code": item.college_code,
            "college_name": item.college.name,
            "branch_code": item.branch_code,
            "branch_name": item.branch.name,
            "fees": item.college.fees,
            "autonomous": item.college.autonomous,
            "average_package": item.college.average_package,
            "highest_package": item.college.highest_package,
            "probability": pred["probability"],
            "status": pred["status"]
        })
        
    student_info = {
        "name": current_user.name,
        "percentile": prof["percentile"],
        "rank": prof["rank"],
        "category": prof["category"],
        "gender": prof["gender"],
        "home_university": prof["home_university"]
    }
    
    from .document_generator import DocumentGenerator
    pdf_buffer = DocumentGenerator.generate_preference_pdf(student_info, evaluated_items)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CAP_Preference_Form_{current_user.name.replace(' ', '_')}.pdf"}
    )

@app.get("/api/preferences/download/excel")
def download_excel(current_user: Student = Depends(get_current_user), db: Session = Depends(get_db)):
    pref_list = db.query(PreferenceList).filter(PreferenceList.student_id == current_user.id).first()
    prof = current_user.profile_data
    if not pref_list or not prof:
        raise HTTPException(status_code=400, detail="Incomplete preference list or profile scores.")
        
    pred_service = PredictionService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    evaluated_items = []
    
    for item in pref_list.items:
        pred = pred_service.calculate_admission_probability(
            student_percentile=prof["percentile"],
            student_rank=prof["rank"],
            college_code=item.college_code,
            branch_code=item.branch_code,
            category=prof["category"],
            gender=prof["gender"],
            home_university=prof["home_university"],
            minority_status=prof.get("minority_status")
        )
        evaluated_items.append({
            "preference_order": item.preference_order,
            "college_code": item.college_code,
            "college_name": item.college.name,
            "branch_code": item.branch_code,
            "branch_name": item.branch.name,
            "fees": item.college.fees,
            "autonomous": item.college.autonomous,
            "average_package": item.college.average_package,
            "highest_package": item.college.highest_package,
            "probability": pred["probability"],
            "status": pred["status"]
        })
        
    student_info = {
        "name": current_user.name,
        "percentile": prof["percentile"],
        "rank": prof["rank"],
        "category": prof["category"],
        "gender": prof["gender"],
        "home_university": prof["home_university"]
    }
    
    from .document_generator import DocumentGenerator
    excel_buffer = DocumentGenerator.generate_preference_excel(student_info, evaluated_items)
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=CAP_Preference_Form_{current_user.name.replace(' ', '_')}.xlsx"}
    )

# --- CHATBOT (RAG) ROUTE ---
@app.post("/api/chat", response_model=ChatResponse)
def query_ai_assistant(req: ChatRequest, db: Session = Depends(get_db)):
    from .rag_service import RAGService
    rag = RAGService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    answer, sources = rag.answer_admission_query(req.message, req.chat_history)
    
    # Save student query analytics
    sq = StudentQuery(query=req.message, response=answer)
    db.add(sq)
    db.commit()
    
    return ChatResponse(response=answer, sources=sources)

# --- COLLEGE COMPARISON ROUTE ---
@app.post("/api/compare", response_model=List[CollegeOut])
def compare_colleges(req: CompareRequest, db: Session = Depends(get_db)):
    if len(req.college_codes) > 5:
        raise HTTPException(status_code=400, detail="Cannot compare more than 5 colleges.")
    colleges = db.query(College).filter(College.code.in_(req.college_codes)).all()
    return colleges

# --- ADMIN DASHBOARD ROUTES ---
@app.post("/api/admin/upload")
def admin_upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    file_type: str = Form(...), # "cutoff", "vacancy", "fee", "placement", "hostel", "college_info"
    academic_year: str = Form(...),
    cap_round: Optional[int] = Form(None),
    current_admin: Student = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    unique_fn = f"{file_type}_{academic_year.replace('-', '_')}_{datetime.datetime.utcnow().timestamp()}{file_ext}"
    dest_path = os.path.join(UPLOAD_DIR, unique_fn)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Check duplicate
    from .pdf_parser import MHTCETPDFParser
    parser = MHTCETPDFParser(db)
    file_hash = parser.compute_pdf_hash(dest_path)
    
    # Check if hash already registered in completed uploads
    dup = db.query(UploadedDocument).filter(
        UploadedDocument.status == "completed",
        UploadedDocument.filename == file.filename
    ).first()
    
    if dup:
        os.remove(dest_path)
        return {"status": "skipped", "message": "File already parsed and registered."}
        
    doc = UploadedDocument(
        filename=file.filename,
        file_type=file_type,
        academic_year=academic_year,
        cap_round=cap_round,
        status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Trigger background indexing worker
    background_tasks.add_task(
        process_pdf_background,
        doc.id,
        dest_path,
        file_type,
        academic_year,
        cap_round
    )
    
    return {"status": "processing", "document_id": doc.id, "message": "Upload success, processing in background."}

@app.get("/api/admin/documents", response_model=List[UploadedDocumentOut])
def get_uploaded_documents(current_admin: Student = Depends(get_current_admin), db: Session = Depends(get_db)):
    docs = db.query(UploadedDocument).order_by(UploadedDocument.uploaded_at.desc()).all()
    return docs

@app.get("/api/admin/analytics")
def get_admin_analytics(current_admin: Student = Depends(get_current_admin), db: Session = Depends(get_db)):
    colleges_count = db.query(College).count()
    cutoffs_count = db.query(Cutoff).count()
    queries_count = db.query(StudentQuery).count()
    docs_count = db.query(UploadedDocument).count()
    
    # Average student percentile
    avg_percentile = 0.0
    students_with_scores = db.query(Student).filter(Student.profile_data.isnot(None)).all()
    if students_with_scores:
        sum_p = sum(float(s.profile_data.get("percentile", 0)) for s in students_with_scores)
        avg_percentile = sum_p / len(students_with_scores)
        
    return {
        "colleges_indexed": colleges_count,
        "cutoff_records": cutoffs_count,
        "total_student_queries": queries_count,
        "uploaded_pdfs": docs_count,
        "average_student_percentile": round(avg_percentile, 2)
    }

@app.post("/api/admin/reset")
def reset_database(current_admin: Student = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Wipes vector db and SQL tables, leaving admin user. Used for full reindexing."""
    # Wipe ChromaDB chunks
    from .rag_service import RAGService
    rag = RAGService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    try:
        rag.chroma_client.delete_collection("mht_cet_documents")
    except Exception:
        pass
        
    # Wipe SQL Tables contents (excluding Students)
    db.query(PreferenceItem).delete()
    db.query(PreferenceList).delete()
    db.query(Cutoff).delete()
    db.query(VacancySeat).delete()
    db.query(CollegeBranch).delete()
    db.query(College).delete()
    db.query(Branch).delete()
    db.query(District).delete()
    db.query(University).delete()
    db.query(AcademicYear).delete()
    db.query(UploadedDocument).delete()
    db.query(StudentQuery).delete()
    db.commit()
    
    return {"status": "success", "message": "Database wiped successfully. Ready for full upload re-indexing."}

# --- STATELESS PUBLIC ENDPOINTS ---
@app.post("/api/preferences/review-stateless", response_model=PreferenceReviewResponse)
def review_preferences_stateless(req: PreferenceReviewStatelessRequest, db: Session = Depends(get_db)):
    pred_service = PredictionService(db, gemini_api_key=os.getenv("GEMINI_API_KEY"))
    
    # Map preferences to tuples of (college_code, branch_code)
    pref_tuples = [(item.college_code, item.branch_code) for item in req.preferences]
    
    review = pred_service.review_preference_list(
            student_percentile=req.percentile,
            student_rank=req.rank,
            category=req.category,
            gender=req.gender,
            home_university=req.home_university,
            preferences=pref_tuples,
            minority_status=req.minority_status
        )
    
    risky = [
        f"{item['college_name']} ({item['branch_name']})"
        for item in review["evaluated_items"]
        if item["status"] == "Dream"
    ]
    
    return PreferenceReviewResponse(
        has_warnings=len(review["warnings"]) > 0,
        warnings=review["warnings"],
        risky_choices=risky,
        missing_recommendations=review["suggested_colleges"],
        overall_score=review["overall_score"]
    )

@app.post("/api/preferences/download/pdf-stateless")
def download_pdf_stateless(req: ExportStatelessRequest):
    # Evaluate items
    evaluated_items = [item.dict() for item in req.preferences]
    
    from .document_generator import DocumentGenerator
    pdf_buffer = DocumentGenerator.generate_preference_pdf(req.student_info, evaluated_items)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=CAP_Preference_Form.pdf"}
    )

@app.post("/api/preferences/download/excel-stateless")
def download_excel_stateless(req: ExportStatelessRequest):
    # Evaluate items
    evaluated_items = [item.dict() for item in req.preferences]
    
    from .document_generator import DocumentGenerator
    excel_buffer = DocumentGenerator.generate_preference_excel(req.student_info, evaluated_items)
    
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=CAP_Preference_Form.xlsx"}
    )

