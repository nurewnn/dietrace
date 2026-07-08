"""
app/routers/patients.py -- Patient CRUD + health profile endpoints.

Endpoints:
    GET    /patients              -> list patients
    POST   /patients              -> create patient identity
    GET    /patients/{id}         -> get patient with health profile
    PUT    /patients/{id}         -> update patient identity
    DELETE /patients/{id}         -> delete patient + all related records
    PUT    /patients/{id}/health-profile -> create/update health profile
"""

from typing import Optional
import uuid
import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.auth import get_current_dietitian
from app.models import Patient, PatientHealthProfile, Dietitian, Recommendation
from app.schemas import (
    PatientCreate, PatientRead, PatientUpdate,
    PatientHealthProfileCreate, PatientHealthProfileUpdate, PatientHealthProfileRead,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/patients", tags=["patients"])


# -- Helpers --------------------------------------------------------------

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


# -- Routes ---------------------------------------------------------------

@router.get("", response_model=list[PatientRead])
def list_patients(
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
    q: Optional[str] = None,
):
    """List all patients with health profile and latest recommendation."""
    try:
        logger.info(f"GET /patients called by dietitian: {current.username}")

        query = db.query(Patient).options(
            joinedload(Patient.health_profile),
        )
        if q:
            query = query.filter(
                (Patient.full_name.ilike(f"%{q}%")) |
                (Patient.patient_code.ilike(f"%{q}%"))
            )
        patients = query.all()
        logger.info(f"Found {len(patients)} patients")

        # Get latest recommendation per patient using subquery + JOIN (avoids IN clause)
        latest_rec_subq = (
            db.query(
                Recommendation.patient_id,
                func.max(Recommendation.generated_at).label("max_generated_at"),
            )
            .group_by(Recommendation.patient_id)
            .subquery()
        )

        latest_recs = (
            db.query(Recommendation)
            .join(
                latest_rec_subq,
                (Recommendation.patient_id == latest_rec_subq.c.patient_id)
                & (Recommendation.generated_at == latest_rec_subq.c.max_generated_at),
            )
            .all()
        )

        latest_map = {r.patient_id: r for r in latest_recs}

        # FIX: Build response manually to avoid Pydantic validation issues with computed properties
        result = []
        for patient in patients:
            patient_dict = {
                "id": patient.id,
                "patient_code": patient.patient_code,
                "full_name": patient.full_name,
                "age": patient.age,
                "gender": patient.gender,
                "ward": patient.ward,
                "admission_date": patient.admission_date,
                "discharge_date": patient.discharge_date,
                "created_at": patient.created_at,
                "updated_at": patient.updated_at,
                "health_profile": patient.health_profile,
                "latest_recommendation": latest_map.get(patient.id),
            }
            result.append(patient_dict)

        return result
    except Exception as e:
        logger.error(f"ERROR in list_patients: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Create a patient identity record (no health profile yet)."""
    try:
        existing = db.query(Patient).filter(Patient.patient_code == payload.patient_code).first()
        if existing:
            raise HTTPException(status_code=409, detail="Patient code already exists")

        patient = Patient(**payload.model_dump())
        db.add(patient)
        db.commit()
        db.refresh(patient)

        # FIX: Return as dict to match PatientRead schema
        return {
            "id": patient.id,
            "patient_code": patient.patient_code,
            "full_name": patient.full_name,
            "age": patient.age,
            "gender": patient.gender,
            "ward": patient.ward,
            "admission_date": patient.admission_date,
            "discharge_date": patient.discharge_date,
            "created_at": patient.created_at,
            "updated_at": patient.updated_at,
            "health_profile": None,
            "latest_recommendation": None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in create_patient: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{patient_id}", response_model=PatientRead)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Get patient by UUID or patient_code, including health profile and latest recommendation."""
    try:
        patient = _get_patient_or_404(db, patient_id)
        # Find latest from already-loaded relationships
        latest = None
        if patient.recommendations:
            latest = max(patient.recommendations, key=lambda r: r.generated_at)

        # FIX: Return as dict to match PatientRead schema
        return {
            "id": patient.id,
            "patient_code": patient.patient_code,
            "full_name": patient.full_name,
            "age": patient.age,
            "gender": patient.gender,
            "ward": patient.ward,
            "admission_date": patient.admission_date,
            "discharge_date": patient.discharge_date,
            "created_at": patient.created_at,
            "updated_at": patient.updated_at,
            "health_profile": patient.health_profile,
            "latest_recommendation": latest,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in get_patient: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(
    patient_id: str,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Update patient identity fields."""
    try:
        patient = _get_patient_or_404(db, patient_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(patient, field, value)
        db.commit()
        db.refresh(patient)

        # Re-attach latest recommendation
        latest = None
        if patient.recommendations:
            latest = max(patient.recommendations, key=lambda r: r.generated_at)

        # FIX: Return as dict to match PatientRead schema
        return {
            "id": patient.id,
            "patient_code": patient.patient_code,
            "full_name": patient.full_name,
            "age": patient.age,
            "gender": patient.gender,
            "ward": patient.ward,
            "admission_date": patient.admission_date,
            "discharge_date": patient.discharge_date,
            "created_at": patient.created_at,
            "updated_at": patient.updated_at,
            "health_profile": patient.health_profile,
            "latest_recommendation": latest,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in update_patient: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{patient_id}/health-profile", response_model=PatientHealthProfileRead)
def upsert_health_profile(
    patient_id: str,
    payload: PatientHealthProfileCreate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Create or update a patient's health profile."""
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in upsert_health_profile: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Delete a patient and all related records (health profile, recommendations, items, history)."""
    try:
        patient = _get_patient_or_404(db, patient_id)
        db.delete(patient)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ERROR in delete_patient: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))