"""
app/routers/patients.py — Patient CRUD + health profile endpoints.

Endpoints:
    GET    /patients              → list patients
    POST   /patients              → create patient identity
    GET    /patients/{id}         → get patient with health profile
    PUT    /patients/{id}         → update patient identity
    DELETE /patients/{id}         → delete patient + all related records
    PUT    /patients/{id}/health-profile → create/update health profile
"""

from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.auth import get_current_dietitian
from app.models import Patient, PatientHealthProfile, Dietitian, Recommendation
from app.schemas import (
    PatientCreate, PatientRead, PatientUpdate,
    PatientHealthProfileCreate, PatientHealthProfileUpdate, PatientHealthProfileRead,
)

router = APIRouter(prefix="/patients", tags=["patients"])


# ── Helpers ───────────────────────────────────────────────────────────────

def _get_patient_or_404(db: Session, patient_id: str) -> Patient:
    """Look up by UUID or patient_code."""
    patient = None
    try:
        uid = uuid.UUID(patient_id)
        patient = (
            db.query(Patient)
            .options(joinedload(Patient.health_profile))
            .filter(Patient.id == uid)
            .first()
        )
    except ValueError:
        pass
    if not patient:
        patient = (
            db.query(Patient)
            .options(joinedload(Patient.health_profile))
            .filter(Patient.patient_code == patient_id)
            .first()
        )
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PatientRead])
def list_patients(
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
    q: Optional[str] = None,
):
    """List all patients with health profile and latest recommendation."""
    query = db.query(Patient).options(
        joinedload(Patient.health_profile),
        selectinload(Patient.recommendations),
    )
    if q:
        query = query.filter(
            (Patient.full_name.ilike(f"%{q}%")) |
            (Patient.patient_code.ilike(f"%{q}%"))
        )
    patients = query.all()

    # Attach latest recommendation from already-loaded relationships (no extra queries!)
    for patient in patients:
        latest = None
        if patient.recommendations:
            latest = max(patient.recommendations, key=lambda r: r.generated_at)
        patient.latest_recommendation = latest

    return patients


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Create a patient identity record (no health profile yet)."""
    existing = db.query(Patient).filter(Patient.patient_code == payload.patient_code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Patient code already exists")

    patient = Patient(**payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    patient.latest_recommendation = None
    return patient


@router.get("/{patient_id}", response_model=PatientRead)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Get patient by UUID or patient_code, including health profile and latest recommendation."""
    patient = _get_patient_or_404(db, patient_id)
    # Find latest from already-loaded relationships
    latest = None
    if patient.recommendations:
        latest = max(patient.recommendations, key=lambda r: r.generated_at)
    patient.latest_recommendation = latest
    return patient


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(
    patient_id: str,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Update patient identity fields."""
    patient = _get_patient_or_404(db, patient_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    # Re-attach latest recommendation
    latest = None
    if patient.recommendations:
        latest = max(patient.recommendations, key=lambda r: r.generated_at)
    patient.latest_recommendation = latest
    return patient


@router.put("/{patient_id}/health-profile", response_model=PatientHealthProfileRead)
def upsert_health_profile(
    patient_id: str,
    payload: PatientHealthProfileCreate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Create or update a patient's health profile."""
    patient = _get_patient_or_404(db, patient_id)

    profile = db.query(PatientHealthProfile).filter(
        PatientHealthProfile.patient_id == patient.id
    ).first()

    data = payload.model_dump()

    if profile:
        for field, value in data.items():
            setattr(profile, field, value)
    else:
        profile = PatientHealthProfile(patient_id=patient.id, **data)
        db.add(profile)

    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Delete a patient and all related records (health profile, recommendations, items, history)."""
    patient = _get_patient_or_404(db, patient_id)
    db.delete(patient)
    db.commit()
    return None