# SQLAlchemy ORM models
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Dietitian(Base):
    __tablename__ = "dietitians"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(Text, unique=True)
    username: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )

    reviewed_recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="reviewer"
    )
    approval_actions: Mapped[list["ApprovalHistory"]] = relationship(
        back_populates="action_by_dietitian"
    )


class MenuOption(Base):
    __tablename__ = "menu_options"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    menu_code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    cycle_day: Mapped[int] = mapped_column(Integer, nullable=False)
    meal_time: Mapped[str] = mapped_column(Text, nullable=False)
    menu_name: Mapped[str] = mapped_column(Text, nullable=False)
    calories_kcal: Mapped[Optional[int]] = mapped_column(Integer)
    sugar_level: Mapped[str] = mapped_column(Text, nullable=False)
    sodium_level: Mapped[str] = mapped_column(Text, nullable=False)
    fat_level: Mapped[str] = mapped_column(Text, nullable=False)
    allergy_tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    vegetarian: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    suitable_chewing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    protein_type: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'none'::text")
    )
    protein_level: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'low'::text")
    )
    carbohydrate_type: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'none'::text")
    )
    carbohydrate_level: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'low'::text")
    )
    fibre_level: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'low'::text")
    )
    oil_level: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'low'::text")
    )
    suitable_pregnant: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    suitable_preop: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    suitable_postop: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    suitability_notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )

    recommendation_items: Mapped[list["RecommendationItem"]] = relationship(
        back_populates="menu_option"
    )


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    patient_code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(Text, nullable=False)
    ward: Mapped[Optional[str]] = mapped_column(Text)
    admission_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )

    health_profile: Mapped[Optional["PatientHealthProfile"]] = relationship(
        back_populates="patient", uselist=False, cascade="all, delete-orphan"
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class PatientHealthProfile(Base):
    __tablename__ = "patient_health_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, unique=True
    )
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    height_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    has_diabetes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    has_hypertension: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    has_high_cholesterol: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    allergies: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    activity_level: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'sedentary'::text")
    )
    is_vegetarian: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    has_chewing_problem: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    preferred_protein: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'none'::text")
    )
    preferred_carbohydrate: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'none'::text")
    )
    patient_category: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'normal'::text")
    )
    pregnancy_trimester: Mapped[Optional[int]] = mapped_column(Integer)
    smokes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    sleep_pattern: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'normal'::text")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )

    patient: Mapped["Patient"] = relationship(back_populates="health_profile")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    cycle_day: Mapped[int] = mapped_column(Integer, nullable=False)
    menu_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'pending_review'::text")
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dietitians.id")
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    review_note: Mapped[Optional[str]] = mapped_column(Text)
    rule_trace_json: Mapped[Any] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    explanation_json: Mapped[Any] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    no_suitable_alert_json: Mapped[Any] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )

    patient: Mapped["Patient"] = relationship(back_populates="recommendations")
    reviewer: Mapped[Optional["Dietitian"]] = relationship(
        back_populates="reviewed_recommendations"
    )
    items: Mapped[list["RecommendationItem"]] = relationship(
        back_populates="recommendation", cascade="all, delete-orphan"
    )
    approval_history: Mapped[list["ApprovalHistory"]] = relationship(
        back_populates="recommendation", cascade="all, delete-orphan"
    )


class RecommendationItem(Base):
    __tablename__ = "recommendation_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id"), nullable=False
    )
    meal_time: Mapped[str] = mapped_column(Text, nullable=False)
    menu_option_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_options.id")
    )
    selection_reason: Mapped[Optional[str]] = mapped_column(Text)
    is_modified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    modified_menu_name: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )

    recommendation: Mapped["Recommendation"] = relationship(back_populates="items")
    menu_option: Mapped[Optional["MenuOption"]] = relationship(
        back_populates="recommendation_items"
    )


class ApprovalHistory(Base):
    __tablename__ = "approval_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id"), nullable=False
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    action_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dietitians.id")
    )
    action_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
    note: Mapped[Optional[str]] = mapped_column(Text)

    recommendation: Mapped["Recommendation"] = relationship(
        back_populates="approval_history"
    )
    action_by_dietitian: Mapped[Optional["Dietitian"]] = relationship(
        back_populates="approval_actions"
    )