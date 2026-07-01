"""
app/routers/recommendations.py — Expert system recommendation endpoints.

Endpoints:
    POST   /recommendations/generate/{patient_id}?date=2026-06-24  → run inference engine
    GET    /recommendations/{id}                  → view recommendation
    GET    /recommendations/patient/{patient_id}  → list history
    POST   /recommendations/{id}/approve           → dietitian approves
    POST   /recommendations/{id}/reject            → dietitian rejects
    POST   /recommendations/{id}/modify            → dietitian modifies (supports swap)
"""

from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_dietitian
from app.models import (
    Patient, Recommendation, RecommendationItem, ApprovalHistory,
    MenuOption, Dietitian,
)
from app.schemas import (
    RecommendationRead, RecommendationReviewAction, PatientViewData, PatientViewMealItem,
)
from app.rules import passes_constraints
from app.inference_engine import generate_recommendation

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# ── Helpers ───────────────────────────────────────────────────────────────

def _get_recommendation_or_404(db: Session, rec_id: uuid.UUID) -> Recommendation:
    rec = (
        db.query(Recommendation)
        .options(
            joinedload(Recommendation.patient).joinedload(Patient.health_profile),
            selectinload(Recommendation.items).joinedload(RecommendationItem.menu_option),
            joinedload(Recommendation.reviewer),
            selectinload(Recommendation.approval_history),
        )
        .filter(Recommendation.id == rec_id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/generate/{patient_id}", response_model=RecommendationRead)
def generate_recommendation_endpoint(
    patient_id: str,
    date: Optional[str] = Query(None, description="Menu date from calendar picker (ISO format: 2026-06-24)"),
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """
    Run the forward chaining expert system for a patient.

    Frontend should send the date from calendar picker as ?date=2026-06-24.
    Backend extracts the weekday and maps to cycle day (R41-R44).
    """
    # Resolve patient_id (UUID or patient_code)
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

    try:
        recommendation = generate_recommendation(db, patient.id, menu_date=date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return recommendation


@router.get("/{recommendation_id}", response_model=RecommendationRead)
def get_recommendation(
    recommendation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Get a recommendation with items, rule trace, and explanation."""
    return _get_recommendation_or_404(db, recommendation_id)


@router.get("/patient/{patient_id}", response_model=list[RecommendationRead])
def list_patient_recommendations(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """List recommendation history for a patient."""
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

    return (
        db.query(Recommendation)
        .options(
            joinedload(Recommendation.patient).joinedload(Patient.health_profile),
            selectinload(Recommendation.items).joinedload(RecommendationItem.menu_option),
            joinedload(Recommendation.reviewer),
            selectinload(Recommendation.approval_history),
        )
        .filter(Recommendation.patient_id == patient.id)
        .order_by(Recommendation.generated_at.desc())
        .all()
    )


@router.post("/{recommendation_id}/approve", response_model=RecommendationRead)
def approve_recommendation(
    recommendation_id: uuid.UUID,
    payload: RecommendationReviewAction,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Dietitian approves a recommendation. Patient can now view it."""
    rec = _get_recommendation_or_404(db, recommendation_id)

    if rec.status == "approved":
        raise HTTPException(status_code=409, detail="Already approved")

    rec.status = "approved"
    rec.reviewed_by = current.id
    rec.reviewed_at = func.now()
    rec.review_note = payload.review_note or "Approved by dietitian"

    history = ApprovalHistory(
        recommendation_id=rec.id,
        action="approved",
        action_by=current.id,
        note=payload.review_note,
    )
    db.add(history)
    db.commit()
    db.refresh(rec)
    return rec


@router.post("/{recommendation_id}/reject", response_model=RecommendationRead)
def reject_recommendation(
    recommendation_id: uuid.UUID,
    payload: RecommendationReviewAction,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Dietitian rejects a recommendation."""
    rec = _get_recommendation_or_404(db, recommendation_id)

    if rec.status == "approved":
        raise HTTPException(status_code=409, detail="Cannot reject an approved recommendation")

    rec.status = "rejected"
    rec.reviewed_by = current.id
    rec.reviewed_at = func.now()
    rec.review_note = payload.review_note or "Rejected by dietitian"

    history = ApprovalHistory(
        recommendation_id=rec.id,
        action="rejected",
        action_by=current.id,
        note=payload.review_note,
    )
    db.add(history)
    db.commit()
    db.refresh(rec)
    return rec


@router.post("/{recommendation_id}/modify", response_model=RecommendationRead)
def modify_recommendation(
    recommendation_id: uuid.UUID,
    payload: RecommendationReviewAction,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """
    Dietitian modifies a recommendation.

    Supports two modes:
    1. General modify: just updates review_note and marks as modified
    2. Swap mode: when new_menu_option_id + meal_time + new_menu_name are provided,
       swaps the specific meal item to the new menu option.
    """
    rec = _get_recommendation_or_404(db, recommendation_id)

    # Guard: cannot modify already approved or rejected recommendations
    if rec.status in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot modify a recommendation that is already {rec.status}",
        )

    # ── SWAP MODE: actually swap the menu item ──
    if payload.new_menu_option_id and payload.meal_time and payload.new_menu_name:
        # Find the item to update
        item_found = False
        for item in rec.items:
            if item.meal_time.lower() == payload.meal_time.lower():
                # Verify the new menu exists
                new_menu = db.query(MenuOption).filter(MenuOption.id == payload.new_menu_option_id).first()
                if not new_menu:
                    raise HTTPException(status_code=404, detail="New menu option not found")

                # Safety check: verify new menu is safe for this patient
                passed, reject_reasons = passes_constraints(new_menu, rec.patient.health_profile)
                if not passed:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"New menu violates patient safety constraints: {', '.join(reject_reasons)}"
                    )

                # Update the item
                item.menu_option_id = payload.new_menu_option_id
                item.is_modified = True
                item.modified_menu_name = payload.new_menu_name
                item.selection_reason = f"Swapped to {payload.new_menu_name} by dietitian (manual override)"
                item_found = True
                break

        if not item_found:
            raise HTTPException(
                status_code=404, 
                detail=f"No {payload.meal_time} item found in this recommendation"
            )

    # ── GENERAL MODIFY: just update note and status ──
    rec.status = "modified"
    rec.reviewed_by = current.id
    rec.reviewed_at = func.now()

    # Build review note
    if payload.new_menu_option_id and payload.meal_time and payload.new_menu_name:
        swap_note = f"Swapped {payload.meal_time} to {payload.new_menu_name}"
        if payload.review_note:
            rec.review_note = f"{payload.review_note}\n\n{swap_note}"
        else:
            rec.review_note = swap_note
    else:
        rec.review_note = payload.review_note or "Modified by dietitian"

    history = ApprovalHistory(
        recommendation_id=rec.id,
        action="modified",
        action_by=current.id,
        note=rec.review_note,
    )
    db.add(history)
    db.commit()
    db.refresh(rec)
    return rec