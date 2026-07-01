"""
main.py — FastAPI application entrypoint for Supabase deployment.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import test_connection, SessionLocal, Base, engine
from app.models import Dietitian
from app.auth import router as auth_router, hash_password

# Import routers DIRECTLY from their files (not through package __init__)
from app.routers.patients import router as patients_router
from app.routers.menus import router as menus_router
from app.routers.recommendations import router as recommendations_router
from app.routers.dashboard import router as dashboard_router

BCRYPT_PREFIXES = ("$2b$", "$2a$", "$2y$")


def _fix_unhashed_dietitian_passwords() -> None:
    """One-time fix for plaintext passwords in Supabase."""
    db = SessionLocal()
    try:
        dietitians = db.query(Dietitian).all()
        fixed = []
        for d in dietitians:
            if d.password_hash and not d.password_hash.startswith(BCRYPT_PREFIXES):
                plaintext = d.password_hash
                d.password_hash = hash_password(plaintext)
                fixed.append(d.username)
        if fixed:
            db.commit()
            print(f"[startup] Re-hashed plaintext passwords for: {fixed}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("[startup] Database tables verified")

    # _fix_unhashed_dietitian_passwords()  # Run once as a migration, not on every startup
    yield


app = FastAPI(
    title="Dietrace API",
    description="Rule-based expert system for hospital dietary recommendations",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *[origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "").split(",") if origin.strip()],
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register ALL routers
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(menus_router)
app.include_router(recommendations_router)
app.include_router(dashboard_router)


@app.get("/health")
def health_check():
    db_connected = test_connection()
    return {
        "status": "ok" if db_connected else "error",
        "database": "connected" if db_connected else "disconnected",
    }


@app.get("/")
def root():
    return {
        "message": "Dietrace API",
        "docs": "/docs",
        "health": "/health",
    }
