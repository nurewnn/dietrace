"""
Pydantic schemas — request/response shapes for the FastAPI layer.

This is intentionally separate from app.models (SQLAlchemy ORM, the DB layer).
models.py = how data lives in Postgres.
schemas.py = how data is allowed to look when it enters/leaves the API.

Naming convention used throughout:
    <Entity>Base    - shared fields, not used directly as a response/request
    <Entity>Create  - what the client sends on POST (no id, no server-generated fields)
    <Entity>Update  - PATCH/PUT body, every field optional (only send what actually changed)
    <Entity>Read    - what the API returns (includes id, timestamps, computed/nested data)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    """Base for any schema that gets built straight from a SQLAlchemy model instance."""
    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────────────────────────────────
# Dietitian
# ─────────────────────────────────────────────────────────────────────────

class DietitianCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    username: str
    password: str


class DietitianRead(ORMBase):
    id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    username: str
    created_at: datetime


class DietitianLogin(BaseModel):
    username: str
    password: str


# ─────────────────────────────────────────────────────────────────────────
# Menu Option
# ─────────────────────────────────────────────────────────────────────────

class MenuOptionBase(BaseModel):
    menu_code: str
    cycle_day: int
    meal_time: str
    menu_name: str
    calories_kcal: Optional[int] = None
    sugar_level: str
    sodium_level: str
    fat_level: str
    allergy_tags: list[str] = Field(default_factory=list)
    vegetarian: bool = False
    suitable_chewing: bool = False
    protein_type: str = "none"
    protein_level: str = "low"
    carbohydrate_type: str = "none"
    carbohydrate_level: str = "low"
    fibre_level: str = "low"
    oil_level: str = "low"
    suitable_pregnant: bool = False
    suitable_preop: bool = False
    suitable_postop: bool = False
    suitability_notes: Optional[str] = None
    is_active: bool = True


class MenuOptionCreate(MenuOptionBase):
    pass


class MenuOptionUpdate(BaseModel):
    """Every field optional — only send what's actually changing."""
    menu_code: Optional[str] = None
    cycle_day: Optional[int] = None
    meal_time: Optional[str] = None
    menu_name: Optional[str] = None
    calories_kcal: Optional[int] = None
    sugar_level: Optional[str] = None
    sodium_level: Optional[str] = None
    fat_level: Optional[str] = None
    allergy_tags: Optional[list[str]] = None
    vegetarian: Optional[bool] = None
    suitable_chewing: Optional[bool] = None
    protein_type: Optional[str] = None
    protein_level: Optional[str] = None
    carbohydrate_type: Optional[str] = None
    carbohydrate_level: Optional[str] = None
    fibre_level: Optional[str] = None
    oil_level: Optional[str] = None
    suitable_pregnant: Optional[bool] = None
    suitable_preop: Optional[bool] = None
    suitable_postop: Optional[bool] = None
    suitability_notes: Optional[str] = None
    is_active: Optional[bool] = None


class MenuOptionRead(MenuOptionBase, ORMBase):
    id: uuid.UUID
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────
# Patient Health Profile
# ─────────────────────────────────────────────────────────────────────────

class PatientHealthProfileBase(BaseModel):
    weight_kg: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    has_diabetes: bool = False
    has_hypertension: bool = False
    has_high_cholesterol: bool = False
    allergies: list[str] = Field(default_factory=list)
    activity_level: str = "sedentary"
    is_vegetarian: bool = False
    has_chewing_problem: bool = False
    preferred_protein: str = "none"
    preferred_carbohydrate: str = "none"
    patient_category: str = "normal"
    pregnancy_trimester: Optional[int] = Field(default=None, ge=1, le=3)
    smokes: bool = False
    sleep_pattern: str = "normal"
    notes: Optional[str] = None


class PatientHealthProfileCreate(PatientHealthProfileBase):
    pass


class PatientHealthProfileUpdate(BaseModel):
    weight_kg: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    has_diabetes: Optional[bool] = None
    has_hypertension: Optional[bool] = None
    has_high_cholesterol: Optional[bool] = None
    allergies: Optional[list[str]] = None
    activity_level: Optional[str] = None
    is_vegetarian: Optional[bool] = None
    has_chewing_problem: Optional[bool] = None
    preferred_protein: Optional[str] = None
    preferred_carbohydrate: Optional[str] = None
    patient_category: Optional[str] = None
    pregnancy_trimester: Optional[int] = Field(default=None, ge=1, le=3)
    smokes: Optional[bool] = None
    sleep_pattern: Optional[str] = None
    notes: Optional[str] = None


class PatientHealthProfileRead(PatientHealthProfileBase, ORMBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────
# Recommendation (nested, for PatientRead)
# ─────────────────────────────────────────────────────────────────────────

class LatestRecommendationRead(ORMBase):
    id: uuid.UUID
    cycle_day: int
    status: str
    generated_at: datetime
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────
# Patient
# ─────────────────────────────────────────────────────────────────────────

class PatientBase(BaseModel):
    patient_code: str
    full_name: str
    age: int = Field(ge=0, le=130)
    gender: str
    ward: Optional[str] = None
    admission_date: Optional[date] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    ward: Optional[str] = None
    admission_date: Optional[date] = None


class PatientRead(PatientBase, ORMBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    health_profile: Optional[PatientHealthProfileRead] = None
    latest_recommendation: Optional[LatestRecommendationRead] = None


# ─────────────────────────────────────────────────────────────────────────
# Recommendation Item
# ─────────────────────────────────────────────────────────────────────────

class RecommendationItemRead(ORMBase):
    id: uuid.UUID
    meal_time: str
    menu_option_id: Optional[uuid.UUID] = None
    menu_option: Optional[MenuOptionRead] = None
    selection_reason: Optional[str] = None
    is_modified: bool
    modified_menu_name: Optional[str] = None
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────
# Approval History
# ─────────────────────────────────────────────────────────────────────────

class ApprovalHistoryRead(ORMBase):
    id: uuid.UUID
    action: str
    action_by: Optional[uuid.UUID] = None
    action_at: datetime
    note: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────
# Recommendation
# ─────────────────────────────────────────────────────────────────────────

class RecommendationRead(ORMBase):
    id: uuid.UUID
    patient: PatientRead
    cycle_day: int
    status: str
    generated_at: datetime
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    review_note: Optional[str] = None
    rule_trace_json: list[dict[str, Any]] = Field(default_factory=list)
    explanation_json: dict[str, Any] = Field(default_factory=dict)
    no_suitable_alert_json: dict[str, Any] = Field(default_factory=dict)
    items: list[RecommendationItemRead] = Field(default_factory=list)
    approval_history: list[ApprovalHistoryRead] = Field(default_factory=list)


class RecommendationReviewAction(BaseModel):
    """
    Request body for approve/reject/modify endpoints.
    For swap: include new_menu_option_id, meal_time, and new_menu_name.
    """
    review_note: Optional[str] = None
    new_menu_option_id: Optional[uuid.UUID] = None
    meal_time: Optional[str] = None
    new_menu_name: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────
# Dashboard & Auth
# ─────────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    dietitian: DietitianRead


class DashboardSummary(BaseModel):
    total_patients: int
    pending_review: int
    approved: int
    modified: int
    rejected: int
    no_suitable_alerts: int


class ActivityRead(ORMBase):
    action: str
    patient_code: str
    patient_name: str
    note: Optional[str] = None
    action_at: datetime


class WorkloadSnapshot(BaseModel):
    approved: int = 0
    rejected: int = 0
    modified: int = 0
    reviewed: int = 0  # approved + rejected + modified
    generated: int = 0  # total recommendations generated today
# ─────────────────────────────────────────────────────────────────────────

class PatientViewMealItem(BaseModel):
    meal_time: str
    menu_name: str
    tags: list[str] = Field(default_factory=list)
    reason: str
    calories: Optional[int] = None
    sugar: Optional[str] = None
    sodium: Optional[str] = None
    fat: Optional[str] = None
    friendly_note: str = ""


class PatientViewData(BaseModel):
    patient_name: str
    patient_code: str
    ward: str
    dietitian_name: Optional[str] = None
    status: str
    items: list[PatientViewMealItem] = Field(default_factory=list)