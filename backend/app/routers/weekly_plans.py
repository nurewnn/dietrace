"""
app/routers/weekly_plans.py — Weekly menu plan endpoints.

Endpoints:
    POST /weekly-plans/generate/{patient_id}    → generate weekly plan for patient stay
    GET  /weekly-plans/{patient_id}             → get patient's current weekly plan
    GET  /weekly-plans/by-id/{weekly_plan_id}   → get weekly plan by ID (with full recommendations)
    POST /weekly-plans/{weekly_plan_id}/approve-all → approve all pending days
    GET  /patient-view/{patient_code}/today     → get today's menu for patient (public-ish)
"""

from typing import Optional
import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_dietitian
from app.models import (
    Patient, Recommendation, RecommendationItem, WeeklyPlan, WeeklyPlanDay,
    Dietitian, ApprovalHistory, MenuOption,
)
from app.schemas import (
    WeeklyPlanWithDaysRead, WeeklyPlanBriefRead, TodayMenuResponse,
    PatientViewMealItem, RecommendationRead,
)
from app.inference_engine import generate_recommendation

router = APIRouter(prefix="/weekly-plans", tags=["weekly-plans"])


# ── Helpers ───────────────────────────────────────────────────────────────

def _get_patient_by_id_or_code(db: Session, patient_id: str) -> Patient:
    """Look up patient by UUID or patient_code."""
    patient = None
    try:
        uid = uuid.UUID(patient_id)
        patient = db.query(Patient).filter(Patient.id == uid).first()
    except ValueError:
        pass
    if not patient:
        patient = db.query(Patient).filter(Patient.patient_code == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def _calculate_overall_status(days: list[WeeklyPlanDay]) -> str:
    """Recalculate overall status based on day statuses."""
    if not days:
        return "pending_review"
    statuses = [d.status for d in days]
    if all(s == "approved" for s in statuses):
        return "approved"
    if any(s == "rejected" for s in statuses):
        return "partially_approved"
    if any(s in ("approved", "modified") for s in statuses):
        return "partially_approved"
    return "pending_review"


def _build_menu_items_summary(day: WeeklyPlanDay) -> list[dict]:
    """Build brief menu item summary for grid view."""
    if not day.recommendation:
        return []
    items = []
    for item in day.recommendation.items:
        menu = item.menu_option
        if menu:
            items.append({
                "meal_time": item.meal_time,
                "menu_name": menu.menu_name,
                "calories": menu.calories_kcal,
            })
        else:
            items.append({
                "meal_time": item.meal_time,
                "menu_name": "No suitable menu",
                "calories": None,
            })
    return items


def _build_friendly_note(meal_time: str, explanation_json: dict, menu_name: str) -> str:
    """Build a warm, patient-friendly explanation."""
    rec = explanation_json.get("recommendations", {}).get(meal_time, {})
    score_reasons = rec.get("score_reasons", [])
    meal_time_friendly = {
        "breakfast": "morning",
        "lunch": "midday",
        "dinner": "evening",
    }.get(meal_time, meal_time)
    if not score_reasons:
        return f"A wholesome {meal_time_friendly} meal — {menu_name} — selected to support your recovery."
    friendly_parts = []
    for reason in score_reasons:
        r = reason.lower()
        if "diabetes" in r or "sugar" in r:
            friendly_parts.append("carefully balanced to help keep your blood sugar steady")
        elif "sodium" in r or "salt" in r or "hypertension" in r:
            friendly_parts.append("prepared with low salt to protect your heart")
        elif "protein" in r:
            friendly_parts.append("packed with protein to help your body heal")
        elif "fat" in r or "cholesterol" in r:
            friendly_parts.append("made with heart-healthy ingredients")
        elif "chewing" in r or "soft" in r:
            friendly_parts.append("gentle and easy to enjoy")
        elif "vegetarian" in r:
            friendly_parts.append("a nourishing plant-based choice")
        elif "allergy" in r or "allergen" in r:
            friendly_parts.append("prepared safely, free from allergens")
        elif "pregnant" in r or "pregnancy" in r:
            friendly_parts.append("nutritious and safe for you and your baby")
        elif "calorie" in r or "energy" in r:
            friendly_parts.append("perfectly portioned for the right energy")
        elif "fibre" in r or "fiber" in r:
            friendly_parts.append("rich in fiber to keep you comfortable")
        elif "pre-op" in r or "preop" in r:
            friendly_parts.append("light and easy to digest before your procedure")
        elif "post-op" in r or "postop" in r:
            friendly_parts.append("gentle on your stomach while helping you regain strength")
        else:
            friendly_parts.append(reason.lower())
    if friendly_parts:
        reasons_text = ", ".join(friendly_parts)
        return f"Your {meal_time_friendly} meal — {menu_name} — is {reasons_text}."
    return f"A wholesome {meal_time_friendly} meal — {menu_name} — selected to support your recovery."


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/generate/{patient_id}", response_model=WeeklyPlanWithDaysRead)
def generate_weekly_plan(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """
    Generate a weekly plan for the patient's entire admission duration.
    Deletes any existing weekly plan for this patient first.
    """
    patient = _get_patient_by_id_or_code(db, patient_id)

    if not patient.admission_date or not patient.discharge_date:
        raise HTTPException(
            status_code=400,
            detail="Patient must have both admission_date and discharge_date set"
        )

    if patient.discharge_date < patient.admission_date:
        raise HTTPException(
            status_code=400,
            detail="Discharge date must be on or after admission date"
        )

    total_days = (patient.discharge_date - patient.admission_date).days + 1
    if total_days > 14:
        raise HTTPException(
            status_code=400,
            detail="Maximum stay duration is 14 days"
        )

    # Delete existing weekly plan (cascade deletes days)
    existing = db.query(WeeklyPlan).filter(WeeklyPlan.patient_id == patient.id).first()
    if existing:
        db.delete(existing)
        db.commit()

    # Create weekly plan
    weekly_plan = WeeklyPlan(
        patient_id=patient.id,
        admission_date=patient.admission_date,
        discharge_date=patient.discharge_date,
        total_days=total_days,
        overall_status="pending_review",
    )
    db.add(weekly_plan)
    db.flush()  # Get weekly_plan.id

    # Generate recommendation for each day
    for day_number in range(1, total_days + 1):
        cycle_day = ((day_number - 1) % 4) + 1
        menu_date = patient.admission_date + timedelta(days=day_number - 1)
        menu_date_str = menu_date.isoformat()

        try:
            recommendation = generate_recommendation(db, patient.id, menu_date=menu_date_str)
        except ValueError as e:
            # If duplicate or other error, rollback and re-raise
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

        # Link recommendation to weekly plan
        recommendation.weekly_plan_id = weekly_plan.id
        db.flush()

        # Create day record
        plan_day = WeeklyPlanDay(
            weekly_plan_id=weekly_plan.id,
            day_number=day_number,
            cycle_day=cycle_day,
            recommendation_id=recommendation.id,
            status="pending_review",
        )
        db.add(plan_day)

    db.commit()

    # Reload with relationships
    db.refresh(weekly_plan)
    return weekly_plan


@router.get("/{patient_id}", response_model=WeeklyPlanWithDaysRead)
def get_weekly_plan(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Get the weekly plan for a patient (by patient UUID or code)."""
    patient = _get_patient_by_id_or_code(db, patient_id)

    weekly_plan = (
        db.query(WeeklyPlan)
        .options(
            selectinload(WeeklyPlan.days)
            .selectinload(WeeklyPlanDay.recommendation)
            .selectinload(Recommendation.items)
            .selectinload(RecommendationItem.menu_option),
            joinedload(WeeklyPlan.patient),
        )
        .filter(WeeklyPlan.patient_id == patient.id)
        .first()
    )

    if not weekly_plan:
        raise HTTPException(status_code=404, detail="Weekly plan not found for this patient")

    return weekly_plan


@router.get("/by-id/{weekly_plan_id}", response_model=WeeklyPlanBriefRead)
def get_weekly_plan_by_id(
    weekly_plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Get weekly plan by ID with brief day summaries (for grid view)."""
    weekly_plan = (
        db.query(WeeklyPlan)
        .options(
            selectinload(WeeklyPlan.days)
            .selectinload(WeeklyPlanDay.recommendation)
            .selectinload(Recommendation.items)
            .selectinload(RecommendationItem.menu_option),
        )
        .filter(WeeklyPlan.id == weekly_plan_id)
        .first()
    )

    if not weekly_plan:
        raise HTTPException(status_code=404, detail="Weekly plan not found")

    return weekly_plan


@router.post("/{weekly_plan_id}/approve-all", response_model=WeeklyPlanWithDaysRead)
def approve_all_days(
    weekly_plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Approve all pending-review days in a weekly plan at once."""
    weekly_plan = (
        db.query(WeeklyPlan)
        .options(selectinload(WeeklyPlan.days))
        .filter(WeeklyPlan.id == weekly_plan_id)
        .first()
    )

    if not weekly_plan:
        raise HTTPException(status_code=404, detail="Weekly plan not found")

    approved_count = 0
    for day in weekly_plan.days:
        if day.status == "pending_review":
            day.status = "approved"
            day.reviewed_at = func.now()
            approved_count += 1

            # Also update the linked recommendation
            if day.recommendation_id:
                rec = db.query(Recommendation).filter(Recommendation.id == day.recommendation_id).first()
                if rec and rec.status == "pending_review":
                    rec.status = "approved"
                    rec.reviewed_by = current.id
                    rec.reviewed_at = func.now()
                    rec.review_note = "Approved via Approve All"

                    history = ApprovalHistory(
                        recommendation_id=rec.id,
                        action="approved",
                        action_by=current.id,
                        note="Approved via Approve All",
                    )
                    db.add(history)

    if approved_count == 0:
        raise HTTPException(status_code=409, detail="No pending days to approve")

    weekly_plan.overall_status = _calculate_overall_status(weekly_plan.days)
    db.commit()
    db.refresh(weekly_plan)
    return weekly_plan


# ── Patient Today's Menu (moved from dashboard for weekly-plan-aware logic) ──

@router.get("/patient-view/{patient_code}/today", response_model=TodayMenuResponse)
def patient_today_menu(
    patient_code: str,
    db: Session = Depends(get_db),
):
    """
    Get today's menu for a patient based on their admission date and weekly plan.
    PUBLIC endpoint — no authentication required.
    """
    patient = db.query(Patient).filter(Patient.patient_code == patient_code).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.admission_date or not patient.discharge_date:
        return TodayMenuResponse(
            day_number=0,
            total_days=0,
            status="error",
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            items=[],
            message="Admission dates not set. Please contact your dietitian.",
        )

    today = date.today()
    total_days = (patient.discharge_date - patient.admission_date).days + 1

    # Calculate today's day number
    today_day_number = (today - patient.admission_date).days + 1

    if today > patient.discharge_date:
        return TodayMenuResponse(
            day_number=0,
            total_days=total_days,
            status="discharged",
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            items=[],
            message="You have been discharged. No menu available.",
        )

    if today < patient.admission_date:
        return TodayMenuResponse(
            day_number=0,
            total_days=total_days,
            status="not_started",
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            items=[],
            message="Admission has not started yet.",
        )

    # Find the weekly plan and today's day
    weekly_plan = (
        db.query(WeeklyPlan)
        .options(
            selectinload(WeeklyPlan.days)
            .selectinload(WeeklyPlanDay.recommendation)
            .selectinload(Recommendation.items)
            .selectinload(RecommendationItem.menu_option),
        )
        .filter(WeeklyPlan.patient_id == patient.id)
        .first()
    )

    if not weekly_plan:
        return TodayMenuResponse(
            day_number=today_day_number,
            total_days=total_days,
            status="no_plan",
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            items=[],
            message="No weekly plan has been generated yet. Please contact your dietitian.",
        )

    today_day = next(
        (d for d in weekly_plan.days if d.day_number == today_day_number),
        None
    )

    if not today_day or not today_day.recommendation:
        return TodayMenuResponse(
            day_number=today_day_number,
            total_days=total_days,
            status="pending_review",
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            items=[],
            message="Today's menu is being prepared. Please check again later.",
        )

    rec = today_day.recommendation

    # If not approved, show pending
    if rec.status not in ("approved", "modified"):
        return TodayMenuResponse(
            day_number=today_day_number,
            total_days=total_days,
            status=rec.status,
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            items=[],
            message="Your menu is currently pending dietitian review. Please check again later.",
        )

    # Build meal items
    items = []
    for item in rec.items:
        menu = item.menu_option
        if menu:
            items.append(PatientViewMealItem(
                meal_time=item.meal_time,
                menu_name=menu.menu_name,
                tags=menu.allergy_tags or [],
                reason=item.selection_reason or "Approved by dietitian",
                calories=menu.calories_kcal,
                sugar=menu.sugar_level,
                sodium=menu.sodium_level,
                fat=menu.fat_level,
                friendly_note=_build_friendly_note(item.meal_time, rec.explanation_json or {}, menu.menu_name),
            ))
        else:
            items.append(PatientViewMealItem(
                meal_time=item.meal_time,
                menu_name="No suitable menu — dietitian review required",
                tags=[],
                reason="No safe candidate found",
                calories=None,
                sugar=None,
                sodium=None,
                fat=None,
                friendly_note="A dietitian will personally select the best meal for you.",
            ))

    return TodayMenuResponse(
        day_number=today_day_number,
        total_days=total_days,
        status=rec.status,
        patient_name=patient.full_name,
        patient_code=patient.patient_code,
        ward=patient.ward or "—",
        items=items,
    )
