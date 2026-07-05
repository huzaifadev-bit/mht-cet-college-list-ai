from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, JSON, Numeric
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class District(Base):
    __tablename__ = "districts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    
    colleges = relationship("College", back_populates="district")

class University(Base):
    __tablename__ = "universities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    
    colleges = relationship("College", back_populates="university")

class AcademicYear(Base):
    __tablename__ = "academic_years"
    
    id = Column(Integer, primary_key=True, index=True)
    year = Column(String, unique=True, nullable=False, index=True) # e.g. "2023-24", "2024-25"
    
    cutoffs = relationship("Cutoff", back_populates="academic_year")
    vacancy_seats = relationship("VacancySeat", back_populates="academic_year")

class College(Base):
    __tablename__ = "colleges"
    
    code = Column(Integer, primary_key=True, index=True) # MHT CET Institute Code (e.g. 6006)
    name = Column(String, nullable=False, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    university_id = Column(Integer, ForeignKey("universities.id"), nullable=False)
    status = Column(String, nullable=False) # e.g., "Government", "Private", "Government Aided"
    autonomous = Column(Boolean, default=False)
    minority_status = Column(String, nullable=True) # e.g., "Linguistic", "Religious", None
    fees = Column(Integer, nullable=True) # Annual tuition fees in INR
    hostel_availability = Column(Boolean, default=False)
    average_package = Column(Float, nullable=True) # in LPA (Lakhs Per Annum)
    highest_package = Column(Float, nullable=True) # in LPA
    official_website = Column(String, nullable=True)
    maps_location = Column(String, nullable=True) # Google Maps URL
    
    district = relationship("District", back_populates="colleges")
    university = relationship("University", back_populates="colleges")
    cutoffs = relationship("Cutoff", back_populates="college")
    vacancy_seats = relationship("VacancySeat", back_populates="college")
    branches = relationship("CollegeBranch", back_populates="college")
    preference_items = relationship("PreferenceItem", back_populates="college")

class Branch(Base):
    __tablename__ = "branches"
    
    code = Column(String, primary_key=True, index=True) # e.g. "19110" or "24210"
    name = Column(String, nullable=False, index=True) # e.g. "Computer Engineering"
    
    colleges = relationship("CollegeBranch", back_populates="branch")
    cutoffs = relationship("Cutoff", back_populates="branch")
    vacancy_seats = relationship("VacancySeat", back_populates="branch")
    preference_items = relationship("PreferenceItem", back_populates="branch")

class CollegeBranch(Base):
    __tablename__ = "college_branches"
    
    college_code = Column(Integer, ForeignKey("colleges.code"), primary_key=True)
    branch_code = Column(String, ForeignKey("branches.code"), primary_key=True)
    intake = Column(Integer, nullable=True)
    
    college = relationship("College", back_populates="branches")
    branch = relationship("Branch", back_populates="colleges")

class Cutoff(Base):
    __tablename__ = "cutoffs"
    
    id = Column(Integer, primary_key=True, index=True)
    college_code = Column(Integer, ForeignKey("colleges.code"), nullable=False)
    branch_code = Column(String, ForeignKey("branches.code"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    cap_round = Column(Integer, nullable=False) # 1, 2, 3
    seat_type = Column(String, nullable=False, index=True) # e.g., "GOPENH", "LOPENH", "GOBCO", "TFWS", "EWS"
    category = Column(String, nullable=False, index=True) # e.g., "OPEN", "OBC", "SC", "ST", "EWS", "TFWS"
    percentile = Column(Numeric(7, 4), nullable=False) # e.g., 99.2345
    rank = Column(Integer, nullable=False) # State merit rank
    
    college = relationship("College", back_populates="cutoffs")
    branch = relationship("Branch", back_populates="cutoffs")
    academic_year = relationship("AcademicYear", back_populates="cutoffs")

class VacancySeat(Base):
    __tablename__ = "vacancy_seats"
    
    id = Column(Integer, primary_key=True, index=True)
    college_code = Column(Integer, ForeignKey("colleges.code"), nullable=False)
    branch_code = Column(String, ForeignKey("branches.code"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    cap_round = Column(Integer, nullable=False)
    seat_type = Column(String, nullable=False, index=True)
    vacant_seats = Column(Integer, nullable=False, default=0)
    
    college = relationship("College", back_populates="vacancy_seats")
    branch = relationship("Branch", back_populates="vacancy_seats")
    academic_year = relationship("AcademicYear", back_populates="vacancy_seats")

class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    profile_data = Column(JSON, nullable=True) # Stores scores, categories, category rank, gender, etc.
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    preference_lists = relationship("PreferenceList", back_populates="student")

class PreferenceList(Base):
    __tablename__ = "preference_lists"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    name = Column(String, default="My Preference List")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    student = relationship("Student", back_populates="preference_lists")
    items = relationship("PreferenceItem", back_populates="preference_list", cascade="all, delete-orphan", order_by="PreferenceItem.preference_order")

class PreferenceItem(Base):
    __tablename__ = "preference_items"
    
    id = Column(Integer, primary_key=True, index=True)
    preference_list_id = Column(Integer, ForeignKey("preference_lists.id"), nullable=False)
    college_code = Column(Integer, ForeignKey("colleges.code"), nullable=False)
    branch_code = Column(String, ForeignKey("branches.code"), nullable=False)
    preference_order = Column(Integer, nullable=False)
    locked = Column(Boolean, default=False)
    
    preference_list = relationship("PreferenceList", back_populates="items")
    college = relationship("College", back_populates="preference_items")
    branch = relationship("Branch", back_populates="preference_items")

class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False) # "cutoff", "vacancy", "fee", "placement", "hostel", "college_info"
    academic_year = Column(String, nullable=False) # e.g. "2023-24"
    cap_round = Column(Integer, nullable=True)
    status = Column(String, default="processing") # "processing", "completed", "failed"
    error_message = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

class StudentQuery(Base):
    __tablename__ = "student_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, nullable=False)
    response = Column(String, nullable=False)
    asked_at = Column(DateTime, default=datetime.datetime.utcnow)
