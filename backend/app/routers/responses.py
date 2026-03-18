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
        raise HTTPException(status_code=400, detail="Response already exists")

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
    responses = (
        db.query(models.Response)
        .filter(models.Response.applicant_id == current_user.id)
        .order_by(models.Response.created_at.desc())
        .all()
    )
    return responses
