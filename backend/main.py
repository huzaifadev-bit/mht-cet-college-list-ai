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

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MHT CET AI College Predictor API", version="1.0.0")

# CORS middleware for Next.js communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
            recs = parser.parse_seat_matrix_pdf(file_path, academic_year)
            doc.error_message = f"Successfully parsed {recs} college-branch seat records."
        else:
            success, msg = parser.extract_unstructured_pdf_data(file_path, academic_year)
            if not success:
                raise Exception(msg)
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
