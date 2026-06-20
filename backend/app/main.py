"""
main.py — FastAPI application entrypoint.

Wires together the database health check, CORS, and routers. Right now
only the auth router is included since that's all that's built.

HANDOFF NOTE FOR WHOEVER PICKS THIS UP NEXT:
Add the patient / menu / recommendation / dashboard routers below using the
exact same pattern as auth_router — import it, then app.include_router(...).
The expert system itself (rules.py, inference_engine.py, explanation.py)
plugs into the recommendation router's POST /recommendations/generate/{id}
endpoint — see SYSTEM_DEVELOPMENT_BLUEPRINT.md Section 7 and Section 16.

STARTUP PASSWORD FIX (see _fix_unhashed_dietitian_passwords below):
Some dietitian rows were inserted with a plaintext password sitting in
password_hash instead of a real bcrypt hash. This runs once per server
start, fixes any row that isn't a real bcrypt hash yet, and is a no-op on
every run after the first. Convenience over correctness — fine for a
5-row prototype, would not do this in a real production app (that's what
a proper migration script is for).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import test_connection, SessionLocal
from app.models import Dietitian
from app.auth import router as auth_router, hash_password

# TODO: uncomment as each router gets built (same pattern as auth_router).
# from app.routers.patients import router as patients_router
# from app.routers.menus import router as menus_router
# from app.routers.recommendations import router as recommendations_router
# from app.routers.dashboard import router as dashboard_router

BCRYPT_PREFIXES = ("$2b$", "$2a$", "$2y$")


def _fix_unhashed_dietitian_passwords() -> None:
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
    _fix_unhashed_dietitian_passwords()
    yield


app = FastAPI(title="Dietrace API", lifespan=lifespan)

# CORS: required so the Vite dev server can call this API from the browser.
# Default Vite port is 5173 — update/add origins here once deployed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
# app.include_router(patients_router)
# app.include_router(menus_router)
# app.include_router(recommendations_router)
# app.include_router(dashboard_router)


@app.get("/health")
def health_check():
    db_connected = test_connection()
    return {
        "status": "ok" if db_connected else "error",
        "database": "connected" if db_connected else "disconnected",
    }
