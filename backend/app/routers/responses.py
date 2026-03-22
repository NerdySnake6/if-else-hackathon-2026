"""Маршруты для откликов соискателей и работы работодателя с ними."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_active_user, require_roles

router = APIRouter(prefix="/responses", tags=["responses"])


@router.post("/", response_model=schemas.ResponseOut, status_code=status.HTTP_201_CREATED)
def create_response(
    response_data: schemas.ResponseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant"))
):
    """Создает отклик текущего соискателя на выбранную возможность."""
    opportunity = (
        db.query(models.Opportunity)
        .filter(models.Opportunity.id == response_data.opportunity_id)
        .first()
    )
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    existing_response = (
        db.query(models.Response)
        .filter(
            models.Response.applicant_id == current_user.id,
            models.Response.opportunity_id == response_data.opportunity_id,
        )
        .first()
    )
    if existing_response:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Response already exists")

    db_response = models.Response(
        applicant_id=current_user.id,
        opportunity_id=response_data.opportunity_id,
        cover_letter=response_data.cover_letter,
    )
    db.add(db_response)
    db.commit()
    db.refresh(db_response)
    return db_response


@router.get("/my", response_model=List[schemas.ResponseOut])
def list_my_responses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Возвращает отклики, созданные текущим пользователем."""
    responses = (
        db.query(models.Response)
        .filter(models.Response.applicant_id == current_user.id)
        .order_by(models.Response.created_at.desc())
        .all()
    )
    return responses


@router.get("/employer", response_model=List[schemas.EmployerResponseOut])
def list_employer_responses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("employer", "curator", "admin"))
):
    """Возвращает входящие отклики работодателю или сотруднику платформы."""
    query = (
        db.query(models.Response, models.Opportunity, models.User)
        .join(models.Opportunity, models.Response.opportunity_id == models.Opportunity.id)
        .join(models.User, models.Response.applicant_id == models.User.id)
        .order_by(models.Response.created_at.desc())
    )

    if current_user.role == "employer":
        query = query.filter(models.Opportunity.employer_id == current_user.id)

    rows = query.all()
    return [
        schemas.EmployerResponseOut(
            id=response.id,
            opportunity_id=opportunity.id,
            opportunity_title=opportunity.title,
            applicant_id=applicant.id,
            applicant_name=applicant.display_name,
            applicant_email=applicant.email,
            status=response.status,
            cover_letter=response.cover_letter,
            created_at=response.created_at,
            updated_at=response.updated_at,
        )
        for response, opportunity, applicant in rows
    ]


@router.patch("/{response_id}/status", response_model=schemas.ResponseOut)
def update_response_status(
    response_id: int,
    status_data: schemas.ResponseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("employer", "curator", "admin"))
):
    """Обновляет статус отклика, доступного текущему пользователю."""
    response = (
        db.query(models.Response)
        .join(models.Opportunity, models.Response.opportunity_id == models.Opportunity.id)
        .filter(models.Response.id == response_id)
        .first()
    )
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    opportunity = db.query(models.Opportunity).filter(models.Opportunity.id == response.opportunity_id).first()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    if current_user.role == "employer" and opportunity.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    response.status = status_data.status
    db.commit()
    db.refresh(response)
    return response
