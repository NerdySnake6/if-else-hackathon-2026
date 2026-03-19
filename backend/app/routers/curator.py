"""Маршруты для кабинета куратора и модерации платформы."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.dependencies import require_roles


router = APIRouter(prefix="/curator", tags=["curator"])


@router.get("/users", response_model=List[schemas.CuratorUserOut])
def list_users(
    role: Optional[str] = Query(default=None),
    query: Optional[str] = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("curator", "admin")),
):
    """Возвращает пользователей для модерации с фильтрами по роли и поиску."""
    users_query = (
        db.query(models.User)
        .options(
            joinedload(models.User.applicant_profile),
            joinedload(models.User.employer_profile),
        )
        .order_by(models.User.created_at.desc())
    )

    if role:
        users_query = users_query.filter(models.User.role == role)

    if query:
        pattern = f"%{query.strip()}%"
        users_query = users_query.filter(
            (models.User.email.ilike(pattern))
            | (models.User.display_name.ilike(pattern))
        )

    return users_query.all()


@router.patch("/users/{user_id}", response_model=schemas.CuratorUserOut)
def update_user(
    user_id: int,
    payload: schemas.CuratorUserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("curator", "admin")),
):
    """Обновляет статус пользователя для модерации и верификации."""
    user = (
        db.query(models.User)
        .options(
            joinedload(models.User.applicant_profile),
            joinedload(models.User.employer_profile),
        )
        .filter(models.User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    employer_profile_data = update_data.pop("employer_profile", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    if employer_profile_data is not None:
        if user.role != "employer":
            raise HTTPException(status_code=400, detail="Employer profile can be updated only for employer role")

        employer_profile = user.employer_profile
        if employer_profile is None:
            employer_profile = models.EmployerProfile(user_id=user.id, company_name="")
            db.add(employer_profile)
            user.employer_profile = employer_profile

        if "company_name" in employer_profile_data:
            company_name = (employer_profile_data.get("company_name") or "").strip()
            if not company_name:
                raise HTTPException(status_code=400, detail="Company name is required")
            employer_profile_data["company_name"] = company_name

        for field, value in employer_profile_data.items():
            setattr(employer_profile, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.get("/opportunities", response_model=List[schemas.CuratorOpportunityOut])
def list_opportunities(
    query: Optional[str] = Query(default=None, min_length=1),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("curator", "admin")),
):
    """Возвращает список возможностей для модерации."""
    opportunities_query = (
        db.query(models.Opportunity)
        .options(
            joinedload(models.Opportunity.tags),
            joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .order_by(models.Opportunity.published_at.desc())
    )

    if is_active is not None:
        opportunities_query = opportunities_query.filter(models.Opportunity.is_active.is_(is_active))

    if query:
        pattern = f"%{query.strip()}%"
        opportunities_query = opportunities_query.filter(
            (models.Opportunity.title.ilike(pattern))
            | (models.Opportunity.description.ilike(pattern))
            | (models.Opportunity.location.ilike(pattern))
        )

    opportunities = opportunities_query.all()
    return [
        schemas.CuratorOpportunityOut(
            id=opportunity.id,
            employer_id=opportunity.employer_id,
            employer_name=(
                opportunity.employer.employer_profile.company_name
                if opportunity.employer and opportunity.employer.employer_profile
                else opportunity.employer.display_name if opportunity.employer else "Работодатель"
            ),
            title=opportunity.title,
            description=opportunity.description,
            type=opportunity.type,
            work_format=opportunity.work_format,
            location=opportunity.location,
            lat=opportunity.lat,
            lng=opportunity.lng,
            salary_range=opportunity.salary_range,
            expires_at=opportunity.expires_at,
            event_date=opportunity.event_date,
            is_active=opportunity.is_active,
            published_at=opportunity.published_at,
            tags=opportunity.tags,
        )
        for opportunity in opportunities
    ]


@router.patch("/opportunities/{opp_id}", response_model=schemas.CuratorOpportunityOut)
def update_opportunity(
    opp_id: int,
    payload: schemas.CuratorOpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("curator", "admin")),
):
    """Обновляет статус и наполнение карточки возможности."""
    opportunity = (
        db.query(models.Opportunity)
        .options(
            joinedload(models.Opportunity.tags),
            joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .filter(models.Opportunity.id == opp_id)
        .first()
    )
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(opportunity, field, value)

    db.commit()
    db.refresh(opportunity)

    return schemas.CuratorOpportunityOut(
        id=opportunity.id,
        employer_id=opportunity.employer_id,
        employer_name=(
            opportunity.employer.employer_profile.company_name
            if opportunity.employer and opportunity.employer.employer_profile
            else opportunity.employer.display_name if opportunity.employer else "Работодатель"
        ),
        title=opportunity.title,
        description=opportunity.description,
        type=opportunity.type,
        work_format=opportunity.work_format,
        location=opportunity.location,
        lat=opportunity.lat,
        lng=opportunity.lng,
        salary_range=opportunity.salary_range,
        expires_at=opportunity.expires_at,
        event_date=opportunity.event_date,
        is_active=opportunity.is_active,
        published_at=opportunity.published_at,
        tags=opportunity.tags,
    )
