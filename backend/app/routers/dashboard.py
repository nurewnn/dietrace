"""
app/routers/dashboard.py — Dashboard summary + patient public view.

Endpoints:
    GET /dashboard/summary          → dietitian dashboard stats
    GET /patient-view/{patient_code} → public patient menu view (NO AUTH)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_dietitian
from app.models import Patient, Recommendation, RecommendationItem, Dietitian, ApprovalHistory
from app.schemas import DashboardSummary, PatientViewData, PatientViewMealItem, ActivityRead, WorkloadSnapshot

router = APIRouter(tags=["dashboard"])


def _build_friendly_note(meal_time: str, explanation_json: dict, menu_name: str) -> str:
    """Build a warm, patient-friendly explanation from the recommendation's score reasons."""
    rec = explanation_json.get("recommendations", {}).get(meal_time, {})
    score_reasons = rec.get("score_reasons", [])
    
    meal_time_friendly = {
        "breakfast": "morning",
        "lunch": "midday",
        "dinner": "evening",
    }.get(meal_time, meal_time)
    
    if not score_reasons:
        return f"A wholesome {meal_time_friendly} meal — {menu_name} — selected to support your recovery and wellbeing."
    
    # Map technical reasons to warm, patient-friendly language
    friendly_parts = []
    for reason in score_reasons:
        r = reason.lower()
        if "diabetes" in r or "sugar" in r:
            friendly_parts.append("carefully balanced to help keep your blood sugar steady")
        elif "sodium" in r or "salt" in r or "hypertension" in r or "blood pressure" in r:
            friendly_parts.append("prepared with low salt to protect your heart")
        elif "protein" in r:
            friendly_parts.append("packed with protein to help your body heal and recover")
        elif "fat" in r or "cholesterol" in r:
            friendly_parts.append("made with heart-healthy ingredients")
        elif "chewing" in r or "soft" in r:
            friendly_parts.append("gentle and easy to enjoy")
        elif "vegetarian" in r:
            friendly_parts.append("a nourishing plant-based choice")
        elif "allergy" in r or "allergen" in r:
            friendly_parts.append("prepared safely, free from anything that might cause a reaction")
        elif "pregnant" in r or "pregnancy" in r:
            friendly_parts.append("nutritious and safe for you and your baby")
        elif "calorie" in r or "energy" in r:
            friendly_parts.append("perfectly portioned to give you the right energy")
        elif "fibre" in r or "fiber" in r:
            friendly_parts.append("rich in fiber to keep you comfortable")
        elif "pre-op" in r or "preop" in r or "before surgery" in r:
            friendly_parts.append("light and easy to digest before your procedure")
        elif "post-op" in r or "postop" in r or "after surgery" in r:
            friendly_parts.append("gentle on your stomach while helping you regain strength")
        else:
            friendly_parts.append(reason.lower())
    
    if friendly_parts:
        reasons_text = ", ".join(friendly_parts)
        return f"Your {meal_time_friendly} meal — {menu_name} — is {reasons_text}."
    
    return f"A wholesome {meal_time_friendly} meal — {menu_name} — selected to support your recovery and wellbeing."


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Dietitian dashboard statistics — counts by each patient's LATEST recommendation."""

    total_patients = db.query(Patient).count()

    # Subquery: latest recommendation (max generated_at) per patient
    latest_rec_subq = (
        db.query(
            Recommendation.patient_id,
            func.max(Recommendation.generated_at).label("max_generated_at"),
        )
        .group_by(Recommendation.patient_id)
        .subquery()
    )

    # Join to get the actual status of each patient's latest recommendation
    latest_recs = (
        db.query(Recommendation.status)
        .join(
            latest_rec_subq,
            (Recommendation.patient_id == latest_rec_subq.c.patient_id)
            & (Recommendation.generated_at == latest_rec_subq.c.max_generated_at),
        )
        .all()
    )

    # Count by status
    status_counts = {}
    for (status,) in latest_recs:
        status_counts[status] = status_counts.get(status, 0) + 1

    # Patients with no recommendations at all → treat as pending_review
    patients_with_recs = len(latest_recs)
    no_recs = total_patients - patients_with_recs

    pending_review = status_counts.get("pending_review", 0) + no_recs
    approved = status_counts.get("approved", 0)
    modified = status_counts.get("modified", 0)
    rejected = status_counts.get("rejected", 0)
    no_suitable_alerts = status_counts.get("needs_dietitian_action", 0)

    # Sanity check: these five should always equal total_patients
    # pending_review + approved + modified + rejected + no_suitable_alerts == total_patients

    return DashboardSummary(
        total_patients=total_patients,
        pending_review=pending_review,
        approved=approved,
        modified=modified,
        rejected=rejected,
        no_suitable_alerts=no_suitable_alerts,
    )


@router.get("/dashboard/activity", response_model=list[ActivityRead])
def dashboard_activity(
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Recent activity feed for the logged-in dietitian."""
    recent = (
        db.query(ApprovalHistory)
        .options(
            joinedload(ApprovalHistory.recommendation).joinedload(Recommendation.patient)
        )
        .filter(
            ApprovalHistory.action_by == current.id,
            ApprovalHistory.action.in_(["approved", "rejected", "modified"]),
        )
        .order_by(ApprovalHistory.action_at.desc())
        .limit(10)
        .all()
    )

    return [
        ActivityRead(
            action=a.action,
            patient_code=a.recommendation.patient.patient_code if a.recommendation and a.recommendation.patient else "—",
            patient_name=a.recommendation.patient.full_name if a.recommendation and a.recommendation.patient else "Unknown",
            note=a.note,
            action_at=a.action_at,
        )
        for a in recent
    ]


@router.get("/dashboard/workload", response_model=WorkloadSnapshot)
def dashboard_workload(
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Today's workload snapshot for the logged-in dietitian."""
    from datetime import datetime, timezone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Dietitian's own actions today
    my_actions = (
        db.query(
            ApprovalHistory.action,
            func.count(ApprovalHistory.id).label("count"),
        )
        .filter(
            ApprovalHistory.action_by == current.id,
            ApprovalHistory.action_at >= today_start,
        )
        .group_by(ApprovalHistory.action)
        .all()
    )

    my_counts = {action: count for action, count in my_actions}

    # Total recommendations generated today (any dietitian/system)
    generated_today = (
        db.query(func.count(Recommendation.id))
        .filter(Recommendation.generated_at >= today_start)
        .scalar()
    ) or 0

    approved = my_counts.get("approved", 0)
    rejected = my_counts.get("rejected", 0)
    modified = my_counts.get("modified", 0)

    return WorkloadSnapshot(
        approved=approved,
        rejected=rejected,
        modified=modified,
        reviewed=approved + rejected + modified,
        generated=generated_today,
    )


@router.get("/patient-view/{patient_code}", response_model=PatientViewData)
def patient_view(
    patient_code: str,
    db: Session = Depends(get_db),
):
    """
    PUBLIC endpoint — no authentication required.
    Patients enter their code to view approved menu only.
    """
    patient = db.query(Patient).filter(Patient.patient_code == patient_code).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get the latest approved recommendation with eager-loaded relationships
    rec = (
        db.query(Recommendation)
        .options(
            selectinload(Recommendation.items).joinedload(RecommendationItem.menu_option),
            joinedload(Recommendation.reviewer),
        )
        .filter(
            Recommendation.patient_id == patient.id,
            Recommendation.status == "approved",
        )
        .order_by(Recommendation.generated_at.desc())
        .first()
    )

    if not rec:
        # Return pending status — patient sees "check again later"
        return PatientViewData(
            patient_name=patient.full_name,
            patient_code=patient.patient_code,
            ward=patient.ward or "—",
            dietitian_name=None,
            status="pending_review",
            items=[],
        )

    # Build meal items from already-loaded relationships (no extra queries!)
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

    dietitian_name = None
    if rec.reviewer:
        dietitian_name = rec.reviewer.full_name

    return PatientViewData(
        patient_name=patient.full_name,
        patient_code=patient.patient_code,
        ward=patient.ward or "—",
        dietitian_name=dietitian_name,
        status=rec.status,
        items=items,
    )