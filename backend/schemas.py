from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal

# Authentication
class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    is_admin: bool
    profile_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Student Profile & Prediction
class StudentProfile(BaseModel):
    percentile: float = Field(..., ge=0.0, le=100.0)
    rank: int = Field(..., ge=1)
    jee_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    category: str # OPEN, OBC, SC, ST, EWS, VJNT, etc.
    gender: str # M or F
    home_university: str # e.g. "Pune", "Mumbai", "State-Level"
    candidature_type: str # Type A, B, C, D, OMS (Other than Maharashtra State)
    tfws_status: bool = False
    defence_status: bool = False
    ph_status: bool = False
    orphan_status: bool = False
    minority_status: Optional[str] = None # e.g. "Gujarati", "Sindhi", None
    
    # Preferences
    preferred_branches: List[str] # List of branch codes or names
    preferred_cities: Optional[List[str]] = []
    preferred_districts: Optional[List[str]] = []
    max_fees: Optional[int] = None
    gov_private_pref: Optional[str] = "ANY" # "GOVT", "PVT", "ANY"
    autonomous_pref: Optional[str] = "ANY" # "AUTONOMOUS", "NON-AUTONOMOUS", "ANY"
    hostel_required: bool = False
    placement_priority: bool = False

class PredictionRequest(BaseModel):
    percentile: float
    rank: Optional[int] = None
    category: str
    gender: str
    home_university: Optional[str] = ""
    candidature_type: Optional[str] = "Type A"
    tfws_status: bool = False
    defence_status: bool = False
    ph_status: bool = False
    minority_status: Optional[str] = None
    preferred_branches: Optional[List[str]] = []
    preferred_districts: Optional[List[str]] = None
    max_fees: Optional[int] = None
    gov_private_pref: Optional[str] = "ANY"
    autonomous_pref: Optional[str] = "ANY"
    hostel_required: bool = False
    placement_priority: bool = False

# Database Entities Output
class DistrictOut(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class UniversityOut(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class BranchOut(BaseModel):
    code: str
    name: str
    class Config:
        from_attributes = True

class CollegeBranchOut(BaseModel):
    branch_code: str
    branch: BranchOut
    intake: Optional[int] = None
    class Config:
        from_attributes = True

class CollegeOut(BaseModel):
    code: int
    name: str
    district: DistrictOut
    university: UniversityOut
    status: str
    autonomous: bool
    minority_status: Optional[str] = None
    fees: Optional[int] = None
    hostel_availability: bool
    average_package: Optional[float] = None
    highest_package: Optional[float] = None
    official_website: Optional[str] = None
    maps_location: Optional[str] = None

    class Config:
        from_attributes = True

class CutoffOut(BaseModel):
    id: int
    college_code: int
    branch_code: int
    cap_round: int
    seat_type: str
    category: str
    percentile: Decimal
    rank: int
    academic_year: str # resolve to string in output serializer
    
    class Config:
        from_attributes = True

class PredictionResult(BaseModel):
    college: CollegeOut
    branch: BranchOut
    cap_round: int
    seat_type: str
    admission_probability: float # 0 to 100
    category_closing_percentiles: Dict[str, List[Dict[str, Any]]] # e.g. {"2023-24": [{"round": 1, "percentile": 98.2, "rank": 2043}], ...]}
    current_vacant_seats: Optional[int] = 0
    previous_vacant_seats: Optional[int] = 0
    explanation: str

# Preference List
class PreferenceItemCreate(BaseModel):
    college_code: int
    branch_code: str
    preference_order: int
    locked: bool = False

class PreferenceItemOut(BaseModel):
    id: int
    college: CollegeOut
    branch: BranchOut
    preference_order: int
    locked: bool
    admission_probability: Optional[float] = None

    class Config:
        from_attributes = True

class PreferenceListCreate(BaseModel):
    name: str
    items: List[PreferenceItemCreate]

class PreferenceListOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    items: List[PreferenceItemOut]

    class Config:
        from_attributes = True

class PreferenceReviewResponse(BaseModel):
    has_warnings: bool
    warnings: List[str]
    risky_choices: List[str]
    missing_recommendations: List[Dict[str, Any]]
    overall_score: float # Quality score out of 100

# Compare
class CompareRequest(BaseModel):
    college_codes: List[int]

# Chat
class ChatRequest(BaseModel):
    message: str
    chat_history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    response: str
    sources: List[str]

# Admin Upload
class UploadedDocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    academic_year: str
    cap_round: Optional[int]
    status: str
    error_message: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True

# Stateless Requests
class PreferenceReviewStatelessRequest(BaseModel):
    percentile: float
    rank: int
    category: str
    gender: str
    home_university: str
    preferences: List[PreferenceItemCreate]

class EvaluatedItemInput(BaseModel):
    preference_order: int
    college_code: int
    college_name: str
    branch_code: str
    branch_name: str
    fees: Optional[int] = 0
    autonomous: bool = False
    average_package: Optional[float] = 0.0
    highest_package: Optional[float] = 0.0
    probability: float
    status: str

class ExportStatelessRequest(BaseModel):
    student_info: Dict[str, Any]
    preferences: List[EvaluatedItemInput]
