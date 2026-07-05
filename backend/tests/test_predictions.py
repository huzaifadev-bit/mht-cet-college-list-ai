import os
import sys
from decimal import Decimal
from sqlalchemy.orm import Session

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, Base, engine
from backend.models import College, Branch, CollegeBranch, Cutoff, AcademicYear, District, University
from backend.prediction_service import PredictionService

def setup_test_data(db: Session):
    # Wipe old test data
    db.query(Cutoff).delete()
    db.query(CollegeBranch).delete()
    db.query(College).delete()
    db.query(Branch).delete()
    db.query(District).delete()
    db.query(University).delete()
    db.query(AcademicYear).delete()
    db.commit()

    # Create Districts
    pune = District(name="Pune")
    mumbai = District(name="Mumbai")
    db.add_all([pune, mumbai])
    db.commit()

    # Create Universities
    sppu = University(name="Savitribai Phule Pune University")
    mu = University(name="Mumbai University")
    db.add_all([sppu, mu])
    db.commit()

    # Create Academic Years
    y22 = AcademicYear(year="2022-23")
    y23 = AcademicYear(year="2023-24")
    y24 = AcademicYear(year="2024-25")
    db.add_all([y22, y23, y24])
    db.commit()

    # Create Colleges
    coep = College(
        code=6006,
        name="College of Engineering, Pune",
        district_id=pune.id,
        university_id=sppu.id,
        status="Government Autonomous",
        autonomous=True,
        fees=135000,
        hostel_availability=True,
        average_package=11.5,
        highest_package=44.0,
        official_website="https://www.coep.org.in"
    )
    vit = College(
        code=6278,
        name="Vishwakarma Institute of Technology, Pune",
        district_id=pune.id,
        university_id=sppu.id,
        status="Private",
        autonomous=True,
        fees=180000,
        hostel_availability=False,
        average_package=6.8,
        highest_package=32.0,
        official_website="https://www.vit.edu"
    )
    db.add_all([coep, vit])
    db.commit()

    # Create Branches
    comp = Branch(code="19110", name="Computer Engineering")
    it = Branch(code="24610", name="Information Technology")
    db.add_all([comp, it])
    db.commit()

    # Link branches
    db.add(CollegeBranch(college_code=6006, branch_code="19110", intake=120))
    db.add(CollegeBranch(college_code=6278, branch_code="19110", intake=180))
    db.add(CollegeBranch(college_code=6278, branch_code="24610", intake=120))
    db.commit()

    # Create Cutoffs (3-year trends for General Open Home University - GOPENH)
    # COEP CS (Highly competitive, ~99.8%)
    db.add(Cutoff(college_code=6006, branch_code="19110", academic_year_id=y22.id, cap_round=3, seat_type="GOPENH", category="OPEN", percentile=Decimal("99.8245"), rank=152))
    db.add(Cutoff(college_code=6006, branch_code="19110", academic_year_id=y23.id, cap_round=3, seat_type="GOPENH", category="OPEN", percentile=Decimal("99.8540"), rank=131))
    db.add(Cutoff(college_code=6006, branch_code="19110", academic_year_id=y24.id, cap_round=3, seat_type="GOPENH", category="OPEN", percentile=Decimal("99.8821"), rank=112))

    # VIT Pune CS (Competitive, ~98.5%)
    db.add(Cutoff(college_code=6278, branch_code="19110", academic_year_id=y22.id, cap_round=3, seat_type="GOPENH", category="OPEN", percentile=Decimal("98.3512"), rank=2310))
    db.add(Cutoff(college_code=6278, branch_code="19110", academic_year_id=y23.id, cap_round=3, seat_type="GOPENH", category="OPEN", percentile=Decimal("98.5204"), rank=2145))
    db.add(Cutoff(college_code=6278, branch_code="19110", academic_year_id=y24.id, cap_round=3, seat_type="GOPENH", category="OPEN", percentile=Decimal("98.6432"), rank=1943))
    db.commit()
    print("Mock setup data inserted successfully.")

def run_tests():
    db = SessionLocal()
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    setup_test_data(db)
    
    pred_service = PredictionService(db)
    
    print("\n--- TEST CASE 1: Student with 99.90 Percentile (Should get COEP as Safe) ---")
    res1 = pred_service.calculate_admission_probability(
        student_percentile=99.90,
        student_rank=95,
        college_code=6006,
        branch_code="19110",
        category="OPEN",
        gender="M",
        home_university="Savitribai Phule Pune University"
    )
    print(f"COEP CS Probability: {res1['probability']}% | Status: {res1['status']}")
    print(f"Explanation: {res1['explanation']}")
    assert res1['status'] == "Safe"

    print("\n--- TEST CASE 2: Student with 98.45 Percentile (Should get VIT Pune CS as Moderate/High, COEP as Dream) ---")
    res2_vit = pred_service.calculate_admission_probability(
        student_percentile=98.45,
        student_rank=2195,
        college_code=6278,
        branch_code="19110",
        category="OPEN",
        gender="M",
        home_university="Savitribai Phule Pune University"
    )
    res2_coep = pred_service.calculate_admission_probability(
        student_percentile=98.45,
        student_rank=2195,
        college_code=6006,
        branch_code="19110",
        category="OPEN",
        gender="M",
        home_university="Savitribai Phule Pune University"
    )
    print(f"VIT Pune CS Probability: {res2_vit['probability']}% | Status: {res2_vit['status']}")
    print(f"COEP CS Probability: {res2_coep['probability']}% | Status: {res2_coep['status']}")
    assert res2_vit['status'] in ["Moderate Chance", "High Chance"]
    assert res2_coep['status'] == "Dream"

    print("\n--- TEST CASE 3: Preference Ordering Warning Check ---")
    # Student has 98.45% percentile.
    # Proposed preferences:
    # 1. VIT CS (Cutoff ~98.5%)
    # 2. COEP CS (Cutoff ~99.8%) - Wasted because VIT is placed first and student qualifies for it.
    review = pred_service.review_preference_list(
        student_percentile=98.45,
        student_rank=2195,
        category="OPEN",
        gender="M",
        home_university="Savitribai Phule Pune University",
        preferences=[(6278, "19110"), (6006, "19110")]
    )
    print(f"Overall Review Score: {review['overall_score']}/100")
    print(f"Warnings generated: {len(review['warnings'])}")
    for w in review['warnings']:
        print(f"- {w}")
    assert len(review['warnings']) > 0
    
    db.close()
    print("\nAll prediction engine verification tests PASSED successfully!")

if __name__ == "__main__":
    run_tests()
