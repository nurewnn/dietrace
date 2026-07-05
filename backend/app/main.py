"""
main.py — FastAPI application entrypoint for Supabase deployment.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
