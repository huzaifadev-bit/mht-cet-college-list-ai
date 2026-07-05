import os
import re
import hashlib
import pdfplumber
from pypdf import PdfReader
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from decimal import Decimal
from google import genai
from google.genai import types
from pydantic import BaseModel

from .models import College, Branch, CollegeBranch, Cutoff, VacancySeat, District, University, AcademicYear, UploadedDocument

# Schema for structured LLM extraction from brochures
class CollegeDetailsExtraction(BaseModel):
    college_code: int
    college_name: str
    fees_open: Optional[int] = None
    fees_obc: Optional[int] = None
    fees_sc_st: Optional[int] = None
    fees_ews: Optional[int] = None
    hostel_available: bool = False
    hostel_fees: Optional[int] = None
    average_package_lpa: Optional[float] = None
    highest_package_lpa: Optional[float] = None
    autonomous: bool = False
    status: str = "Private" # e.g. Government, Private, Government Aided
    minority_status: Optional[str] = None # e.g. Gujarati, Religious, None
    official_website: Optional[str] = None

class MHTCETPDFParser:
    def __init__(self, db: Session, gemini_api_key: Optional[str] = None):
        self.db = db
        self.client = None
        if gemini_api_key:
            self.client = genai.Client(api_key=gemini_api_key)

    def compute_pdf_hash(self, file_path: str) -> str:
        """Compute MD5 hash to detect duplicate uploads."""
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            buf = f.read(65536)
            while len(buf) > 0:
                hasher.update(buf)
                buf = f.read(65536)
        return hasher.hexdigest()

    def get_or_create_district(self, name: str) -> District:
        name = name.strip().title()
        if not name:
            name = "Unknown"
        district = self.db.query(District).filter(District.name == name).first()
        if not district:
            district = District(name=name)
            self.db.add(district)
            self.db.commit()
            self.db.refresh(district)
        return district

    def get_or_create_university(self, name: str) -> University:
        name = name.strip()
        if not name:
            name = "Unknown University"
        university = self.db.query(University).filter(University.name == name).first()
        if not university:
            university = University(name=name)
            self.db.add(university)
            self.db.commit()
            self.db.refresh(university)
        return university

    def get_or_create_academic_year(self, year: str) -> AcademicYear:
        year = year.strip()
        ac_year = self.db.query(AcademicYear).filter(AcademicYear.year == year).first()
        if not ac_year:
            ac_year = AcademicYear(year=year)
            self.db.add(ac_year)
            self.db.commit()
            self.db.refresh(ac_year)
        return ac_year

    def parse_cutoff_pdf(self, file_path: str, academic_year_str: str, cap_round: int) -> int:
        """
        Parses official MHT CET cutoff list PDF page-by-page.
        Finds College Codes, Choice Codes, and parses tables of Ranks and Percentiles.
        """
        ac_year = self.get_or_create_academic_year(academic_year_str)
        records_added = 0
        
        # Regex definitions
        college_header_re = re.compile(r"^(\d{4})\s*-\s*(.+)$")
        course_header_re = re.compile(r"^(\d{9})\s*-\s*(.+)$")
        
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text:
                    continue
                
                lines = text.split("\n")
                
                current_college_code = None
                current_college_name = None
                current_branch_code = None
                current_branch_name = None
                
                # Let's find college and course codes on this page
                for i, line in enumerate(lines):
                    line = line.strip()
                    
                    # Detect College Header
                    college_match = college_header_re.match(line)
                    if college_match:
                        current_college_code = int(college_match.group(1))
                        current_college_name = college_match.group(2).strip()
                        
                        # Set default district/university
                        district = self.get_or_create_district("Unknown")
                        university = self.get_or_create_university("Unknown University")
                        
                        # Add college if not exists
                        college = self.db.query(College).filter(College.code == current_college_code).first()
                        if not college:
                            college = College(
                                code=current_college_code,
                                name=current_college_name,
                                district_id=district.id,
                                university_id=university.id,
                                status="Private", # default, updated later
                                autonomous=False,
                                hostel_availability=False
                            )
                            self.db.add(college)
                            self.db.commit()
                        continue
                    
                    # Detect Course Header
                    course_match = course_header_re.match(line)
                    if course_match:
                        full_choice_code = course_match.group(1) # e.g. 600619110
                        branch_name = course_match.group(2).strip()
                        
                        # The last 5 digits of the choice code represent branch/shift
                        current_branch_code = full_choice_code[4:] # e.g. 19110
                        current_branch_name = branch_name
                        
                        # Check branch
                        branch = self.db.query(Branch).filter(Branch.code == current_branch_code).first()
                        if not branch:
                            branch = Branch(code=current_branch_code, name=current_branch_name)
                            self.db.add(branch)
                            self.db.commit()
                            
                        # Link College and Branch
                        if current_college_code:
                            cb = self.db.query(CollegeBranch).filter(
                                CollegeBranch.college_code == current_college_code,
                                CollegeBranch.branch_code == current_branch_code
                            ).first()
                            if not cb:
                                cb = CollegeBranch(
                                    college_code=current_college_code,
                                    branch_code=current_branch_code,
                                    intake=60 # default
                                )
                                self.db.add(cb)
                                self.db.commit()
                        continue

                # Parse the tabular cutoffs on this page
                # In MHT CET cutoff tables, cell grids are defined. Let's extract tables.
                tables = page.extract_tables()
                if not tables:
                    # Let's fallback to text layout search if table structures aren't extracted well
                    continue
                
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    
                    # Look for headers like GOPENH, LOPENH, etc.
                    headers = []
                    header_row_idx = -1
                    
                    for row_idx, row in enumerate(table):
                        cleaned_row = [str(cell).strip() for cell in row if cell is not None]
                        # Check if this row contains category tokens
                        seat_types = [cell for cell in cleaned_row if any(tok in cell for tok in ["OPEN", "SC", "ST", "OBC", "NT", "VJ", "EWS", "TFWS"])]
                        if len(seat_types) > 2:
                            headers = cleaned_row
                            header_row_idx = row_idx
                            break
                    
                    if header_row_idx == -1:
                        continue
                    
                    # Process values below header row
                    # In MHT CET cutoffs, usually:
                    # Row index + 1 is State Merit Rank
                    # Row index + 2 is Percentile
                    # OR they can be in cells separated by linebreaks.
                    rank_row = None
                    percentile_row = None
                    
                    # Sometimes the table rows are:
                    # Row (header): [GOPENH, LOPENH, GSCH, ...]
                    # Row: [1243 (99.245), 2341 (98.234), ...] or split
                    for row_idx in range(header_row_idx + 1, len(table)):
                        row = table[row_idx]
                        if not row:
                            continue
                        
                        # Process columns
                        for col_idx, cell in enumerate(row):
                            if col_idx >= len(headers) or not headers[col_idx]:
                                continue
                            
                            seat_type = headers[col_idx].strip().replace("\n", "").replace(" ", "")
                            if not seat_type or seat_type in ["Seat Type", "Stage", "Round", "Stage I", "Stage II"]:
                                continue
                            
                            val = str(cell).strip()
                            if not val or val == "None":
                                continue
                            
                            # Parse Rank and Percentile
                            # Case 1: "1243\n(99.2345)" or "1243\n99.2345"
                            # Case 2: "99.2345\n(1243)"
                            lines_val = val.split("\n")
                            rank = None
                            percentile = None
                            
                            for lv in lines_val:
                                lv = lv.strip().replace("(", "").replace(")", "")
                                if not lv:
                                    continue
                                if "." in lv:
                                    try:
                                        percentile = float(lv)
                                    except ValueError:
                                        pass
                                else:
                                    try:
                                        rank = int(lv)
                                    except ValueError:
                                        pass
                            
                            if percentile is not None and rank is not None and current_college_code and current_branch_code:
                                # Resolve category and gender from seat_type (e.g. GOPENH -> OPEN, G/Male)
                                category, gender = self.map_seat_type_to_category_and_gender(seat_type)
                                
                                # Check if cutoff already exists
                                cutoff = self.db.query(Cutoff).filter(
                                    Cutoff.college_code == current_college_code,
                                    Cutoff.branch_code == current_branch_code,
                                    Cutoff.academic_year_id == ac_year.id,
                                    Cutoff.cap_round == cap_round,
                                    Cutoff.seat_type == seat_type
                                ).first()
                                
                                if not cutoff:
                                    cutoff = Cutoff(
                                        college_code=current_college_code,
                                        branch_code=current_branch_code,
                                        academic_year_id=ac_year.id,
                                        cap_round=cap_round,
                                        seat_type=seat_type,
                                        category=category,
                                        percentile=Decimal(str(percentile)),
                                        rank=rank
                                    )
                                    self.db.add(cutoff)
                                    records_added += 1
                                else:
                                    cutoff.percentile = Decimal(str(percentile))
                                    cutoff.rank = rank
                                
                    self.db.commit()
        return records_added

    def parse_vacancy_pdf(self, file_path: str, academic_year_str: str, cap_round: int) -> int:
        """Parses official vacancy seat PDFs and updates the vacancy_seats database table."""
        ac_year = self.get_or_create_academic_year(academic_year_str)
        records_added = 0
        
        college_header_re = re.compile(r"^(\d{4})\s*-\s*(.+)$")
        course_header_re = re.compile(r"^(\d{9})\s*-\s*(.+)$")
        
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                
                lines = text.split("\n")
                current_college_code = None
                current_branch_code = None
                
                # Identify headers on page
                for line in lines:
                    line = line.strip()
                    college_match = college_header_re.match(line)
                    if college_match:
                        current_college_code = int(college_match.group(1))
                        continue
                    course_match = course_header_re.match(line)
                    if course_match:
                        current_branch_code = course_match.group(1)[4:]
                        continue
                
                tables = page.extract_tables()
                if not tables:
                    continue
                
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    
                    headers = []
                    header_row_idx = -1
                    for row_idx, row in enumerate(table):
                        cleaned = [str(c).strip() for c in row if c is not None]
                        # Look for vacancy seat table headers
                        if any(tok in cleaned for tok in ["GOPENH", "GOBCH", "LOPENH", "Vacancy", "Vacant"]):
                            headers = cleaned
                            header_row_idx = row_idx
                            break
                            
                    if header_row_idx == -1:
                        continue
                    
                    for row_idx in range(header_row_idx + 1, len(table)):
                        row = table[row_idx]
                        if not row:
                            continue
                        
                        # Process cell values
                        for col_idx, cell in enumerate(row):
                            if col_idx >= len(headers) or not headers[col_idx]:
                                continue
                            
                            seat_type = headers[col_idx].strip().replace("\n", "").replace(" ", "")
                            if not seat_type or seat_type in ["Round", "Vacancy", "Total", "Vacant"]:
                                continue
                                
                            val_str = str(cell).strip()
                            try:
                                vacant_count = int(val_str)
                            except ValueError:
                                continue
                                
                            if current_college_code and current_branch_code:
                                vacancy = self.db.query(VacancySeat).filter(
                                    VacancySeat.college_code == current_college_code,
                                    VacancySeat.branch_code == current_branch_code,
                                    VacancySeat.academic_year_id == ac_year.id,
                                    VacancySeat.cap_round == cap_round,
                                    VacancySeat.seat_type == seat_type
                                ).first()
                                
                                if not vacancy:
                                    vacancy = VacancySeat(
                                        college_code=current_college_code,
                                        branch_code=current_branch_code,
                                        academic_year_id=ac_year.id,
                                        cap_round=cap_round,
                                        seat_type=seat_type,
                                        vacant_seats=vacant_count
                                    )
                                    self.db.add(vacancy)
                                    records_added += 1
                                else:
                                    vacancy.vacant_seats = vacant_count
                    self.db.commit()
        return records_added

    def extract_unstructured_pdf_data(self, file_path: str, academic_year_str: str) -> Tuple[int, str]:
        """
        Extracts unstructured data (Fees, Placements, Hostels) from college brochure PDFs
        using Google Gemini structured JSON capabilities.
        Also chunks the text and loads it into the Vector Database (handled in rag_service).
        """
        if not self.client:
            return 0, "Gemini Client not initialized. Please provide GEMINI_API_KEY."
            
        # 1. Read first few pages of PDF to find core college details
        reader = PdfReader(file_path)
        full_text = ""
        # Read max 15 pages to stay within token limits and extract core details
        max_pages = min(15, len(reader.pages))
        for page_num in range(max_pages):
            full_text += f"\n--- Page {page_num+1} ---\n" + reader.pages[page_num].extract_text()
        
        # 2. Call Gemini model to parse details in JSON format
        prompt = f"""
        Analyze the following text extracted from a college admission brochure/fees document for MHT CET admissions.
        Extract the structured details in JSON format matching the schema instructions.
        Make sure you identify the 4-digit MHT CET Institute Code (e.g. 6006, 3199, 6278).
        If some values are missing, return null.
        
        Document Content:
        {full_text[:40000]} # Trim to 40k chars to fit context comfortably
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=CollegeDetailsExtraction,
                    temperature=0.1
                )
            )
            
            # Import json here to parse response
            import json
            data = json.loads(response.text)
            
            college_code = data.get("college_code")
            if not college_code:
                return 0, "Could not extract College Code from document."
                
            # Update database
            college = self.db.query(College).filter(College.code == college_code).first()
            if not college:
                # Need to check district and university
                district = self.get_or_create_district("Unknown")
                university = self.get_or_create_university("Unknown University")
                college = College(
                    code=college_code,
                    name=data.get("college_name", "Unknown College"),
                    district_id=district.id,
                    university_id=university.id,
                    status=data.get("status", "Private"),
                    autonomous=data.get("autonomous", False),
                    minority_status=data.get("minority_status"),
                    fees=data.get("fees_open"),
                    hostel_availability=data.get("hostel_available", False),
                    average_package=data.get("average_package_lpa"),
                    highest_package=data.get("highest_package_lpa"),
                    official_website=data.get("official_website")
                )
                self.db.add(college)
            else:
                # Update details
                if data.get("fees_open"):
                    college.fees = data.get("fees_open")
                if data.get("hostel_available") is not None:
                    college.hostel_availability = data.get("hostel_available")
                if data.get("average_package_lpa"):
                    college.average_package = data.get("average_package_lpa")
                if data.get("highest_package_lpa"):
                    college.highest_package = data.get("highest_package_lpa")
                if data.get("autonomous") is not None:
                    college.autonomous = data.get("autonomous")
                if data.get("status"):
                    college.status = data.get("status")
                if data.get("minority_status"):
                    college.minority_status = data.get("minority_status")
                if data.get("official_website"):
                    college.official_website = data.get("official_website")
                    
            self.db.commit()
            return 1, f"Successfully extracted details for {college.name} (Code: {college_code})."
            
        except Exception as e:
            self.db.rollback()
            return 0, f"Error calling Gemini or saving data: {str(e)}"

    @staticmethod
    def map_seat_type_to_category_and_gender(seat_type: str) -> Tuple[str, str]:
        """
        Maps a MHT CET seat type code (e.g., GOPENH, LOBCO, TFWS) to category and gender.
        Returns: (category, gender)
        """
        seat_type = seat_type.upper()
        
        # Special types
        if "TFWS" in seat_type:
            return "TFWS", "M"
        if "EWS" in seat_type:
            return "EWS", "M"
        if "ORPHAN" in seat_type:
            return "OPEN", "M"
            
        # Gender determination: G at start = General (M/F), L = Ladies (F)
        gender = "M"
        category = "OPEN"
        
        if seat_type.startswith("L"):
            gender = "F"
            
        # Category mapping
        # Examples: GOPENH, LOBCO, GSCH, GSTO, GNT1H, GNT2H, GNT3H, GSBCS, GVJNT
        if "OPEN" in seat_type:
            category = "OPEN"
        elif "OBC" in seat_type:
            category = "OBC"
        elif "SC" in seat_type:
            category = "SC"
        elif "ST" in seat_type:
            category = "ST"
        elif "SBC" in seat_type:
            category = "SBC"
        elif "NT1" in seat_type or "NT-A" in seat_type:
            category = "NT1"
        elif "NT2" in seat_type or "NT-B" in seat_type:
            category = "NT2"
        elif "NT3" in seat_type or "NT-C" in seat_type:
            category = "NT3"
        elif "VJ" in seat_type or "DT" in seat_type:
            category = "VJNT"
        elif "DEF" in seat_type:
            category = "DEFENCE"
        elif "PH" in seat_type or "PWD" in seat_type:
            category = "PH"
            
        return category, gender
