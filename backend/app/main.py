"""
main.py — FastAPI application entrypoint for Supabase deployment.
"""

import logging
import os
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import test_connection, Base, engine
from app.auth import router as auth_router

# Import routers DIRECTLY from their files (not through package __init__)
from app.routers.patients import router as patients_router
from app.routers.menus import router as menus_router
from app.routers.recommendations import router as recommendations_router
from app.routers.dashboard import router as dashboard_router
from app.routers.weekly_plans import router as weekly_plans_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified")
    yield


app = FastAPI(
    title="Dietrace API",
    description="Rule-based expert system for hospital dietary recommendations",
    version="1.0.0",
    lifespan=lifespan,
)
origins = [
    "https://dietrace-jub3g8efo-nurewnns-projects.vercel.app",
    "https://dietrace.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

# ── CORS: fallback to wildcard if FRONTEND_ORIGINS is not set ──
_frontend_origins = os.getenv("FRONTEND_ORIGINS", "")
allow_origins = [o.strip() for o in _frontend_origins.split(",") if o.strip()]
if not allow_origins:
    logger.warning("FRONTEND_ORIGINS not set — allowing all origins (*)")
    allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Catch-all exception handler for 500s ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# Register ALL routers
app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(menus_router)
app.include_router(recommendations_router)
app.include_router(weekly_plans_router)
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
