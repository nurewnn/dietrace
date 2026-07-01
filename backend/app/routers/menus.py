"""
app/routers/menus.py — Menu option CRUD.

Endpoints:
    GET    /menus              → list menu options
    POST   /menus              → create menu option
    PUT    /menus/{id}         → update menu option
"""

from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_dietitian
from app.models import MenuOption, Dietitian
from app.schemas import MenuOptionCreate, MenuOptionRead, MenuOptionUpdate

router = APIRouter(prefix="/menus", tags=["menus"])


@router.get("", response_model=list[MenuOptionRead])
def list_menus(
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
    cycle_day: Optional[int] = None,
    meal_time: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """List menu options with optional filters."""
    query = db.query(MenuOption)
    if cycle_day is not None:
        query = query.filter(MenuOption.cycle_day == cycle_day)
    if meal_time:
        query = query.filter(MenuOption.meal_time == meal_time)
    if is_active is not None:
        query = query.filter(MenuOption.is_active == is_active)
    return query.all()


@router.post("", response_model=MenuOptionRead, status_code=status.HTTP_201_CREATED)
def create_menu(
    payload: MenuOptionCreate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Create a new menu option."""
    existing = db.query(MenuOption).filter(MenuOption.menu_code == payload.menu_code).first()
    if existing:
        raise HTTPException(status_code=409, detail="Menu code already exists")

    menu = MenuOption(**payload.model_dump())
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return menu


@router.put("/{menu_id}", response_model=MenuOptionRead)
def update_menu(
    menu_id: uuid.UUID,
    payload: MenuOptionUpdate,
    db: Session = Depends(get_db),
    current: Dietitian = Depends(get_current_dietitian),
):
    """Update a menu option."""
    menu = db.query(MenuOption).filter(MenuOption.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(menu, field, value)

    db.commit()
    db.refresh(menu)
    return menu