"""Маршруты для просмотра и управления возможностями на платформе."""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.dependencies import require_roles, get_current_active_user
from app.geocoder import GeocodingError, geocode_address, geocoder_is_configured

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def should_geocode(location: Optional[str], work_format: Optional[str]) -> bool:
    """Определяет, нужно ли выполнять геокодирование локации."""
    if not location:
        return False
    if work_format == "remote":
        return False
    return "удален" not in location.lower()


def resolve_coordinates(
    location: Optional[str],
    work_format: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
) -> tuple[Optional[float], Optional[float]]:
    """Возвращает координаты из входных данных или из геокодера."""
    if lat is not None and lng is not None:
        return lat, lng

    if not should_geocode(location, work_format):
        return None, None

    if not geocoder_is_configured():
        return lat, lng

    try:
        result = geocode_address(location)
    except GeocodingError:
        return lat, lng

    if not result:
        return lat, lng

    return result["lat"], result["lng"]

@router.post("/", response_model=schemas.OpportunityOut)
def create_opportunity(
    opp_data: schemas.OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("employer", "curator", "admin"))
):
    """Создает возможность и при необходимости автозаполняет координаты."""
    if current_user.role == "employer" and not current_user.is_verified:
        raise HTTPException(status_code=403, detail="Employer not verified")

    lat, lng = resolve_coordinates(
        opp_data.location,
        opp_data.work_format,
        opp_data.lat,
        opp_data.lng,
    )
    opp_payload = opp_data.model_dump(exclude={"tag_ids"})
    opp_payload["lat"] = lat
    opp_payload["lng"] = lng

    db_opp = models.Opportunity(
        **opp_payload,
        employer_id=current_user.id
    )
    db.add(db_opp)
    db.commit()
    db.refresh(db_opp)
    
    if opp_data.tag_ids:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(opp_data.tag_ids)).all()
        db_opp.tags = tags
        db.commit()
        db.refresh(db_opp)
    
    return db_opp

@router.get("/", response_model=List[schemas.OpportunityOut])
def list_opportunities(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = Query(None, description="Filter by type"),
    work_format: Optional[str] = Query(None, description="Filter by work format"),
    location: Optional[str] = Query(None, description="Filter by location (city)"),
    tag_ids: Optional[List[int]] = Query(None, description="Filter by tag IDs"),
    db: Session = Depends(get_db)
):
    """Возвращает активные публичные возможности с учетом фильтров."""
    now = datetime.utcnow()
    query = (
        db.query(models.Opportunity)
        .options(
            joinedload(models.Opportunity.tags),
            joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .filter(models.Opportunity.is_active.is_(True))
        .filter(
            (models.Opportunity.expires_at.is_(None))
            | (models.Opportunity.expires_at >= now)
        )
    )
    
    if type:
        query = query.filter(models.Opportunity.type == type)
    if work_format:
        query = query.filter(models.Opportunity.work_format == work_format)
    if location:
        query = query.filter(models.Opportunity.location.contains(location))
    if tag_ids:
        for tag_id in tag_ids:
            query = query.filter(models.Opportunity.tags.any(id=tag_id))
    
    opportunities = query.offset(skip).limit(limit).all()
    return opportunities

@router.get("/{opp_id}", response_model=schemas.OpportunityOut)
def get_opportunity(opp_id: int, db: Session = Depends(get_db)):
    """Возвращает одну возможность по ее идентификатору."""
    opp = (
        db.query(models.Opportunity)
        .options(
            joinedload(models.Opportunity.tags),
            joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .filter(models.Opportunity.id == opp_id)
        .first()
    )
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp

@router.put("/{opp_id}", response_model=schemas.OpportunityOut)
def update_opportunity(
    opp_id: int,
    opp_data: schemas.OpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Обновляет возможность и пересчитывает координаты при необходимости."""
    opp = (
        db.query(models.Opportunity)
        .options(
            joinedload(models.Opportunity.tags),
            joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .filter(models.Opportunity.id == opp_id)
        .first()
    )
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    if current_user.role not in ["curator", "admin"] and opp.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_data = opp_data.model_dump(exclude_unset=True, exclude={"tag_ids"})

    location = update_data.get("location", opp.location)
    work_format = update_data.get("work_format", opp.work_format)
    lat = update_data.get("lat", opp.lat)
    lng = update_data.get("lng", opp.lng)

    if (
        "location" in update_data
        or "work_format" in update_data
        or ("lat" in update_data and "lng" in update_data)
    ):
        lat, lng = resolve_coordinates(location, work_format, lat, lng)
        update_data["lat"] = lat
        update_data["lng"] = lng

    for field, value in update_data.items():
        setattr(opp, field, value)
    
    if opp_data.tag_ids is not None:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(opp_data.tag_ids)).all()
        opp.tags = tags
    
    db.commit()
    db.refresh(opp)
    return opp

@router.delete("/{opp_id}")
def delete_opportunity(
    opp_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Удаляет возможность, доступную текущему пользователю по правам."""
    opp = db.query(models.Opportunity).filter(models.Opportunity.id == opp_id).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    if current_user.role not in ["curator", "admin"] and opp.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db.delete(opp)
    db.commit()
    return {"ok": True}
