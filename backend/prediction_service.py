import math
import httpx
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from decimal import Decimal
from google import genai
from google.genai import types
from pydantic import BaseModel

from .models import College, Cutoff, VacancySeat, AcademicYear, Branch

def _make_gemini_client(api_key: str):
    try:
        custom_client = httpx.Client(verify=False)
        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(httpx_client=custom_client)
        )
    except Exception:
        return genai.Client(api_key=api_key)

class PredictionService:
    def __init__(self, db: Session, gemini_api_key: Optional[str] = None):
        self.db = db
        self.client = None
        if gemini_api_key:
            self.client = _make_gemini_client(gemini_api_key)

    def calculate_admission_probability(
        self,
        student_percentile: float,
        college_code: int,
        branch_code: str,
        category: str,
        gender: str,
        home_university: str,
        student_rank: Optional[int] = None,
        minority_status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates the admission probability of a student getting a specific college branch.
        Uses 3-year weighted cutoffs and vacancy adjustments.
        """
        # 1. Resolve student's appropriate seat type.
        # Home University vs Other than Home University vs State Level
        # For government/autonomous colleges, it is usually State Level (e.g. GOPENO or GOPENS).
        # We fetch all cutoffs matching the college, branch, and category.
        college = self.db.query(College).filter(College.code == college_code).first()
        if not college:
            return {"probability": 0.0, "status": "Dream", "explanation": "College not found."}
            
        # Determine likely seat types for this student.
        # General pattern: e.g. GOBCH (General OBC Home University), GOPENO (General OPEN Other than Home University), GSC(State level)
        seat_types = []
        is_state_level = college.status in ["Government", "University Managed"] or college.autonomous
        
        gender_prefix = "L" if gender == "F" else "G"
        
        # Build candidate seat types
        if category == "TFWS":
            seat_types = ["TFWS"]
        elif category == "EWS":
            seat_types = ["EWS"]
        else:
            # Home University vs Other Than Home University
            # If university matches, H, else O. Or S if state level
            u_suffix = "H" if home_university.lower() in college.university.name.lower() else "O"
            
            # Seat types to search:
            seat_types = [
                f"{gender_prefix}{category}{u_suffix}", # e.g. GOBCH, LOPENH
                f"G{category}{u_suffix}", # Fallback to general if ladies seat not found
                f"{gender_prefix}{category}S", # State level
                f"G{category}S",
                f"{gender_prefix}OPEN{u_suffix}", # Fallback to OPEN
                f"GOPEN{u_suffix}",
                f"{gender_prefix}OPENS",
                f"GOPENS"
            ]

        # Add minority quota seat type if student belongs to a minority
        if minority_status and minority_status.lower() not in ["none", ""]:
            seat_types.insert(0, "MI")

        # Fetch cutoff records for this category
        cutoffs_qs = self.db.query(Cutoff).join(AcademicYear).filter(
            Cutoff.college_code == college_code,
            Cutoff.branch_code == branch_code,
            Cutoff.seat_type.in_(seat_types)
        ).all()
        
        if not cutoffs_qs:
            # Try a broader search just on category
            cutoffs_qs = self.db.query(Cutoff).join(AcademicYear).filter(
                Cutoff.college_code == college_code,
                Cutoff.branch_code == branch_code,
                Cutoff.category == category
            ).all()

        # Group by academic year and find latest cap round cutoff for each year
        year_cutoffs = {}
        for c in cutoffs_qs:
            y = c.academic_year.year
            if y not in year_cutoffs or c.cap_round > year_cutoffs[y]["round"]:
                year_cutoffs[y] = {
                    "percentile": float(c.percentile),
                    "rank": c.rank,
                    "round": c.cap_round,
                    "seat_type": c.seat_type
                }
                
        if not year_cutoffs:
            # If no cutoffs found, fallback to general OPEN state cutoffs
            fallback_qs = self.db.query(Cutoff).join(AcademicYear).filter(
                Cutoff.college_code == college_code,
                Cutoff.branch_code == branch_code,
                Cutoff.category == "OPEN"
            ).all()
            for c in fallback_qs:
                y = c.academic_year.year
                if y not in year_cutoffs or c.cap_round > year_cutoffs[y]["round"]:
                    year_cutoffs[y] = {
                        "percentile": float(c.percentile),
                        "rank": c.rank,
                        "round": c.cap_round,
                        "seat_type": c.seat_type
                    }

        if not year_cutoffs:
            return {
                "probability": 10.0,
                "status": "Dream",
                "explanation": "No cutoff history available for this course. Estimated as low probability.",
                "history": {}
            }

        # Calculate weighted cutoff percentile
        # Weights: Last year = 50%, 2 years ago = 30%, 3 years ago = 20%
        # Sorted years descending
        sorted_years = sorted(list(year_cutoffs.keys()), reverse=True)
        
        weighted_p = 0.0
        total_w = 0.0
        weights = [0.5, 0.3, 0.2]
        
        for idx, y in enumerate(sorted_years):
            if idx < len(weights):
                w = weights[idx]
            else:
                w = 0.1
            weighted_p += year_cutoffs[y]["percentile"] * w
            total_w += w
            
        weighted_cutoff = weighted_p / total_w if total_w > 0 else 0.0
        
        # Calculate Delta
        delta = student_percentile - weighted_cutoff
        
        # Dynamic margins based on competitiveness of the college
        # At very high percentiles (e.g. 99.8%), a very tiny margin is safe.
        # At lower percentiles (e.g. 80%), we need about 1.0% margin.
        percentile_gap = max(0.01, 100.0 - weighted_cutoff)
        safe_margin = min(1.0, max(0.01, 0.8 * (percentile_gap / 10.0)))
        moderate_margin = -min(1.0, max(0.15, 0.5 * (percentile_gap / 10.0)))
        
        # Basic Probability calculation
        if delta >= safe_margin:
            prob = 95.0 + min(4.0, (delta - safe_margin) * 2.0)
            status = "Safe"
        elif delta >= 0.0:
            prob = 75.0 + (delta / safe_margin) * 20.0
            status = "High Chance"
        elif delta >= moderate_margin:
            prob = 50.0 + ((delta - moderate_margin) / abs(moderate_margin)) * 25.0
            status = "Moderate Chance"
        else:
            # Dream college
            prob = max(5.0, 50.0 - (abs(delta - moderate_margin) / 3.0) * 45.0)
            status = "Dream"
            
        # Vacancy Adjustment
        # Fetch latest vacant seats for this course
        latest_year = sorted_years[0] if sorted_years else None
        vacant_seats = 0
        if latest_year:
            vacancy_record = self.db.query(VacancySeat).join(AcademicYear).filter(
                VacancySeat.college_code == college_code,
                VacancySeat.branch_code == branch_code,
                AcademicYear.year == latest_year
            ).order_by(VacancySeat.cap_round.desc()).first()
            if vacancy_record:
                vacant_seats = vacancy_record.vacant_seats
                
        # If vacant seats are high, boost probability
        if vacant_seats > 5:
            boost = min(5.0, (vacant_seats - 5) * 0.5)
            prob = min(99.0, prob + boost)
        elif vacant_seats == 0 and status in ["Safe", "High Chance"]:
            prob = max(50.0, prob - 3.0) # slight penalty since it fills fast
            
        # Generate text explanation
        explanation = f"Based on historical cutoff trends, the weighted cutoff percentile for your category is {weighted_cutoff:.4f}%. "
        if delta >= 0:
            explanation += f"Your percentile ({student_percentile:.4f}%) is {delta:.4f}% ABOVE the weighted average. "
        else:
            explanation += f"Your percentile ({student_percentile:.4f}%) is {abs(delta):.4f}% BELOW the weighted average. "
            
        if vacant_seats > 0:
            explanation += f"Additionally, there were {vacant_seats} vacant seats recorded in the last CAP round of {latest_year}, which increases your allocation chance."
        else:
            explanation += f"Cutoffs are highly competitive and vacant seats were limited last year."

        return {
            "probability": round(prob, 2),
            "status": status,
            "explanation": explanation,
            "weighted_cutoff": round(weighted_cutoff, 4),
            "history": year_cutoffs
        }

    def review_preference_list(
        self,
        student_percentile: float,
        student_rank: int,
        category: str,
        gender: str,
        home_university: str,
        preferences: List[Tuple[int, str]], # List of (college_code, branch_code)
        minority_status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Performs structural and AI analysis on a student's proposed preference list.
        Detects invalid ordering and alerts students if they have no safe options.
        """
        warnings = []
        risky_choices = []
        evaluated_items = []
        
        # 1. Deterministic Cutoff ordering check
        # We calculate prediction details for each preference
        prev_cutoff = 0.0
        prev_college_name = ""
        prev_branch_name = ""
        
        safe_count = 0
        moderate_count = 0
        dream_count = 0
        
        for idx, (col_code, br_code) in enumerate(preferences):
            pred = self.calculate_admission_probability(
                student_percentile=student_percentile,
                student_rank=student_rank,
                college_code=col_code,
                branch_code=br_code,
                category=category,
                gender=gender,
                home_university=home_university,
                minority_status=minority_status
            )
            
            college = self.db.query(College).filter(College.code == col_code).first()
            branch = self.db.query(Branch).filter(Branch.code == br_code).first()
            
            col_name = college.name if college else f"Code {col_code}"
            br_name = branch.name if branch else f"Code {br_code}"
            
            prob = pred["probability"]
            status = pred["status"]
            weighted_cutoff = pred.get("weighted_cutoff", 0.0)
            
            if status == "Safe":
                safe_count += 1
            elif status in ["High Chance", "Moderate Chance"]:
                moderate_count += 1
            else:
                dream_count += 1
                
            # Ordering check: If we place a LOWER cutoff college ABOVE a HIGHER cutoff college
            # For instance: Choice 2 has cutoff 85%, Choice 3 has cutoff 95%.
            # If student's score is 96%, they will immediately get Choice 2, and Choice 3 is never evaluated.
            # Thus, Choice 3 is wasted/unreachable.
            if idx > 0 and weighted_cutoff > prev_cutoff and (prev_cutoff > 0):
                # If difference is significant (> 0.5 percentile)
                if (weighted_cutoff - prev_cutoff) > 0.5:
                    warnings.append(
                        f"Ordering Risk at preference #{idx+1}: You placed {col_name} - {br_name} (cutoff: {weighted_cutoff:.2f}%) "
                        f"below {prev_college_name} - {prev_branch_name} (cutoff: {prev_cutoff:.2f}%). "
                        f"Since admissions are sequential, if you qualify for the higher college, you will be allocated the lower college first, and your higher choice will be ignored."
                    )
            
            prev_cutoff = weighted_cutoff
            prev_college_name = col_name
            prev_branch_name = br_name
            
            evaluated_items.append({
                "college_code": col_code,
                "college_name": col_name,
                "branch_code": br_code,
                "branch_name": br_name,
                "probability": prob,
                "status": status,
                "weighted_cutoff": weighted_cutoff
            })

        # Summary flags
        if safe_count == 0:
            warnings.append(
                "Critical Warning: Your preference list does not contain any 'Safe' colleges. "
                "If cutoffs rise slightly this year, you risk not getting allocated to any college in this CAP round."
            )
            
        if len(preferences) < 5:
            warnings.append("Recommendation: Your preference list is very short. We recommend adding at least 10-15 colleges to maximize options.")

        # 2. Call Gemini for strategic counseling if client is initialized
        gemini_recommendations = []
        overall_score = 100.0 - (len(warnings) * 15)
        overall_score = max(10.0, min(100.0, overall_score))
        
        if self.client:
            pref_list_str = "\n".join([
                f"{i+1}. Code: {item['college_code']} - {item['college_name']} ({item['branch_name']}) - Cutoff: {item['weighted_cutoff']}% - Probability: {item['probability']}% ({item['status']})"
                for i, item in enumerate(evaluated_items)
            ])
            
            prompt = f"""
            As an expert MHT CET Admission Counsellor, analyze the student's proposed preference list for engineering admission.
            
            Student Scores:
            - Percentile: {student_percentile}
            - State Merit Rank: {student_rank}
            - Category: {category}
            - Gender: {gender}
            - Home University: {home_university}
            
            Student's Proposed Preference List:
            {pref_list_str}
            
            Provide:
            1. An evaluation of the choice strategy (balance between Dream, Moderate, and Safe options).
            2. 2-3 specific colleges/branches that the student might have missed but should consider adding based on their rank and preferences.
            3. A short review on how they can improve their list.
            
            Return the output in a JSON object with the keys:
            "strategy_evaluation" (string),
            "suggested_colleges" (list of objects with keys "college_name", "branch_name", "reason"),
            "improvement_tip" (string)
            """
            
            try:
                # Use structure definition for safety
                class GeminiCounsellingResponse(BaseModel):
                    strategy_evaluation: str
                    suggested_colleges: List[Dict[str, str]]
                    improvement_tip: str

                response = self.client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=GeminiCounsellingResponse,
                        temperature=0.2
                    )
                )
                
                import json
                ai_advice = json.loads(response.text)
                
                # Format suggested recommendations
                for sug in ai_advice.get("suggested_colleges", []):
                    gemini_recommendations.append({
                        "college_name": sug.get("college_name"),
                        "branch_name": sug.get("branch_name"),
                        "reason": sug.get("reason")
                    })
            except Exception as e:
                print(f"Gemini Counselling error: {e}")
                
        return {
            "evaluated_items": evaluated_items,
            "warnings": warnings,
            "overall_score": overall_score,
            "suggested_colleges": gemini_recommendations
        }
