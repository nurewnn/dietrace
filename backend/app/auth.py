"""
auth.py — dietitian authentication.

Per blueprint Section 6.1, patients NEVER log in — they only submit a
patient_code to view their approved menu. This file only gates the
DIETITIAN side: password hashing, JWT issuance/verification, and the
POST /auth/login endpoint.

Drop `Depends(get_current_dietitian)` into any route that only a
dietitian should reach (approve/reject/modify, dashboard, patient CRUD).
Do NOT put it on GET /patient-view/{patient_code} — that route must stay
open to patients with no token.

Requires (add to requirements.txt):
    bcrypt
    pyjwt
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dietitian
from app.schemas import DietitianLogin, DietitianRead, TokenResponse

# ── Config ───────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is required.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours, roughly one shift

# tokenUrl is only used for FastAPI's auto-generated /docs UI — it doesn't
# enforce a form-based login. Our actual /auth/login below takes JSON
# (DietitianLogin), not OAuth2 form data.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Password helpers ───────────────────────────────────────────────────────
def hash_password(plain_password: str) -> str:
    # bcrypt has a hard 72-byte limit on the input — truncate defensively
    # so an unusually long password can never crash this instead of just
    # being handled.
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))


# ── Token helpers ───────────────────────────────────────────────────────────
def create_access_token(dietitian: Dietitian) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(dietitian.id),
        "username": dietitian.username,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired, please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


# ── Core auth logic ─────────────────────────────────────────────────────────
def authenticate_dietitian(db: Session, username: str, password: str) -> Optional[Dietitian]:
    dietitian = db.query(Dietitian).filter(Dietitian.username == username).first()
    if not dietitian:
        return None
    if not verify_password(password, dietitian.password_hash):
        return None
    return dietitian


def get_current_dietitian(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Dietitian:
    """
    Use this as a dependency on any dietitian-only route:

        @router.post("/recommendations/{recommendation_id}/approve")
        def approve(recommendation_id: uuid.UUID, current=Depends(get_current_dietitian)):
            ...
    """
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    payload = decode_access_token(token)

    try:
        dietitian_id = uuid.UUID(payload.get("sub", ""))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")

    dietitian = db.query(Dietitian).filter(Dietitian.id == dietitian_id).first()
    if not dietitian:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Dietitian no longer exists.")

    return dietitian


# ── Route ────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(credentials: DietitianLogin, db: Session = Depends(get_db)):
    dietitian = authenticate_dietitian(db, credentials.username, credentials.password)
    if not dietitian:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    token = create_access_token(dietitian)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        dietitian=DietitianRead.model_validate(dietitian),
    )