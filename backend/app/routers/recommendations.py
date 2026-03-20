"""Маршруты для рекомендаций вакансий и мероприятий внутри сети контактов."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.dependencies import require_roles

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def serialize_recommendation(
    recommendation: models.Recommendation,
    current_user_id: int,
) -> schemas.RecommendationOut:
    """Преобразует рекомендацию в ответ API с направлением для текущего пользователя."""
    is_sender = recommendation.recommender_id == current_user_id
    peer = recommendation.recommended_user if is_sender else recommendation.recommender
    return schemas.RecommendationOut(
        id=recommendation.id,
        direction="outgoing" if is_sender else "incoming",
        created_at=recommendation.created_at,
        message=recommendation.message,
        peer=schemas.ContactApplicantSummary.model_validate(peer),
        opportunity=schemas.RecommendationOpportunitySummary.model_validate(recommendation.opportunity),
    )


@router.get("/", response_model=list[schemas.RecommendationOut])
def list_recommendations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant")),
):
    """Возвращает входящие и исходящие рекомендации пользователя."""
    recommendations = (
        db.query(models.Recommendation)
        .options(
            joinedload(models.Recommendation.recommender).joinedload(models.User.applicant_profile),
            joinedload(models.Recommendation.recommended_user).joinedload(models.User.applicant_profile),
            joinedload(models.Recommendation.opportunity).joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .filter(
            or_(
                models.Recommendation.recommender_id == current_user.id,
                models.Recommendation.recommended_user_id == current_user.id,
            )
        )
        .order_by(models.Recommendation.created_at.desc())
        .all()
    )
    return [serialize_recommendation(item, current_user.id) for item in recommendations]


@router.post("/", response_model=schemas.RecommendationOut, status_code=status.HTTP_201_CREATED)
def create_recommendation(
    payload: schemas.RecommendationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant")),
):
    """Отправляет рекомендацию возможности одному из подтвержденных контактов."""
    if payload.recommended_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot recommend opportunity to yourself")

    recommended_user = (
        db.query(models.User)
        .options(joinedload(models.User.applicant_profile))
        .filter(models.User.id == payload.recommended_user_id)
        .first()
    )
    if not recommended_user or recommended_user.role != "applicant":
        raise HTTPException(status_code=404, detail="Applicant not found")

    contact = (
        db.query(models.Contact)
        .filter(
            models.Contact.status == "accepted",
            or_(
                (models.Contact.requester_id == current_user.id) & (models.Contact.addressee_id == payload.recommended_user_id),
                (models.Contact.requester_id == payload.recommended_user_id) & (models.Contact.addressee_id == current_user.id),
            ),
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=403, detail="Recommendation is available only for accepted contacts")

    opportunity = (
        db.query(models.Opportunity)
        .options(joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile))
        .filter(models.Opportunity.id == payload.opportunity_id)
        .first()
    )
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    if not opportunity.is_active:
        raise HTTPException(status_code=400, detail="Opportunity is not active")

    recommendation = models.Recommendation(
        recommender_id=current_user.id,
        recommended_user_id=payload.recommended_user_id,
        opportunity_id=payload.opportunity_id,
        message=payload.message,
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    recommendation = (
        db.query(models.Recommendation)
        .options(
            joinedload(models.Recommendation.recommender).joinedload(models.User.applicant_profile),
            joinedload(models.Recommendation.recommended_user).joinedload(models.User.applicant_profile),
            joinedload(models.Recommendation.opportunity).joinedload(models.Opportunity.employer).joinedload(models.User.employer_profile),
        )
        .filter(models.Recommendation.id == recommendation.id)
        .first()
    )
    return serialize_recommendation(recommendation, current_user.id)
