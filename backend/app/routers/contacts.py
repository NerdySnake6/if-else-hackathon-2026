"""Маршруты для нетворкинга и профессиональных контактов соискателей."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.dependencies import require_roles

router = APIRouter(prefix="/contacts", tags=["contacts"])


def serialize_contact(contact: models.Contact, current_user_id: int) -> schemas.ContactNetworkOut:
    """Преобразует связь между соискателями в удобный ответ API."""
    is_requester = contact.requester_id == current_user_id
    peer = contact.addressee if is_requester else contact.requester
    return schemas.ContactNetworkOut(
        id=contact.id,
        status=contact.status,
        direction="outgoing" if is_requester else "incoming",
        created_at=contact.created_at,
        accepted_at=contact.accepted_at,
        peer=schemas.ContactApplicantSummary.model_validate(peer),
    )


@router.get("/suggestions", response_model=list[schemas.ContactApplicantSummary])
def list_contact_suggestions(
    query: str | None = Query(default=None, description="Поиск по имени, вузу или навыкам"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant")),
):
    """Возвращает соискателей с публичным профилем для нетворкинга."""
    existing_contact_ids = {
        row[0]
        for row in (
            db.query(models.Contact.requester_id)
            .filter(models.Contact.addressee_id == current_user.id)
            .all()
            + db.query(models.Contact.addressee_id)
            .filter(models.Contact.requester_id == current_user.id)
            .all()
        )
    }

    users_query = (
        db.query(models.User)
        .options(joinedload(models.User.applicant_profile))
        .join(models.User.applicant_profile)
        .filter(models.User.role == "applicant")
        .filter(models.User.id != current_user.id)
        .filter(models.User.is_active.is_(True))
        .filter(models.ApplicantProfile.is_profile_public.is_(True))
    )

    if existing_contact_ids:
        users_query = users_query.filter(~models.User.id.in_(existing_contact_ids))

    if query:
        search = f"%{query}%"
        users_query = users_query.filter(
            models.User.display_name.ilike(search)
            | models.ApplicantProfile.full_name.ilike(search)
            | models.ApplicantProfile.university.ilike(search)
            | models.ApplicantProfile.skills.ilike(search)
        )

    return users_query.order_by(models.User.created_at.desc()).limit(30).all()


@router.get("/", response_model=list[schemas.ContactNetworkOut])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant")),
):
    """Возвращает входящие и исходящие контакты текущего соискателя."""
    contacts = (
        db.query(models.Contact)
        .options(
            joinedload(models.Contact.requester).joinedload(models.User.applicant_profile),
            joinedload(models.Contact.addressee).joinedload(models.User.applicant_profile),
        )
        .filter(
            or_(
                models.Contact.requester_id == current_user.id,
                models.Contact.addressee_id == current_user.id,
            )
        )
        .order_by(models.Contact.created_at.desc())
        .all()
    )
    return [serialize_contact(contact, current_user.id) for contact in contacts]


@router.post("/", response_model=schemas.ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact_request(
    payload: schemas.ContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant")),
):
    """Создает заявку в профессиональные контакты между соискателями."""
    if payload.addressee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot create contact with yourself")

    addressee = (
        db.query(models.User)
        .options(joinedload(models.User.applicant_profile))
        .filter(models.User.id == payload.addressee_id)
        .first()
    )
    if not addressee or addressee.role != "applicant":
        raise HTTPException(status_code=404, detail="Applicant not found")
    if not addressee.is_active:
        raise HTTPException(status_code=400, detail="Applicant is inactive")
    if not addressee.applicant_profile or not addressee.applicant_profile.is_profile_public:
        raise HTTPException(status_code=403, detail="Applicant profile is not public")

    existing = (
        db.query(models.Contact)
        .filter(
            or_(
                (models.Contact.requester_id == current_user.id) & (models.Contact.addressee_id == payload.addressee_id),
                (models.Contact.requester_id == payload.addressee_id) & (models.Contact.addressee_id == current_user.id),
            )
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Contact already exists")

    contact = models.Contact(
        requester_id=current_user.id,
        addressee_id=payload.addressee_id,
        status="pending",
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=schemas.ContactOut)
def update_contact_status(
    contact_id: int,
    payload: schemas.ContactStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("applicant")),
):
    """Позволяет адресату принять или отклонить заявку в контакты."""
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only addressee can update contact")

    contact.status = payload.status
    contact.accepted_at = datetime.utcnow() if payload.status == "accepted" else None
    db.commit()
    db.refresh(contact)
    return contact
