"""Маршруты для чтения и обновления профилей по ролям пользователей."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_active_user

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me", response_model=schemas.ProfileMeOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Возвращает текущего пользователя вместе с его ролевым профилем."""
    user = (
        db.query(models.User)
        .options(
            joinedload(models.User.applicant_profile),
            joinedload(models.User.employer_profile),
        )
        .filter(models.User.id == current_user.id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=schemas.ProfileMeOut)
def update_my_profile(
    profile_data: schemas.ProfileMeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Обновляет пользователя и профиль, соответствующий его роли."""
    user = (
        db.query(models.User)
        .options(
            joinedload(models.User.applicant_profile),
            joinedload(models.User.employer_profile),
        )
        .filter(models.User.id == current_user.id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if profile_data.display_name is not None:
        user.display_name = profile_data.display_name

    if user.role == "applicant":
        if profile_data.employer_profile is not None:
            raise HTTPException(status_code=400, detail="Employer profile is not allowed for applicant role")
        applicant_profile = user.applicant_profile
        if applicant_profile is None:
            applicant_profile = models.ApplicantProfile(user_id=user.id)
            db.add(applicant_profile)
            user.applicant_profile = applicant_profile
        applicant_updates = (profile_data.applicant_profile.model_dump(exclude_unset=True)
                             if profile_data.applicant_profile else {})
        for field, value in applicant_updates.items():
            setattr(applicant_profile, field, value)

    elif user.role == "employer":
        if profile_data.applicant_profile is not None:
            raise HTTPException(status_code=400, detail="Applicant profile is not allowed for employer role")
        employer_profile = user.employer_profile
        if employer_profile is None:
            employer_profile = models.EmployerProfile(user_id=user.id, company_name="")
            db.add(employer_profile)
            user.employer_profile = employer_profile
        employer_updates = (profile_data.employer_profile.model_dump(exclude_unset=True)
                            if profile_data.employer_profile else {})
        if "company_name" in employer_updates:
            company_name = (employer_updates.get("company_name") or "").strip()
            if not company_name:
                raise HTTPException(status_code=400, detail="Company name is required")
            employer_updates["company_name"] = company_name
        for field, value in employer_updates.items():
            setattr(employer_profile, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.get("/applicants/{user_id}", response_model=schemas.ApplicantProfileVisibilityOut)
def get_applicant_profile_for_network(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Возвращает профиль соискателя с учетом приватности и контактов."""
    if current_user.role not in {"applicant", "curator", "admin"}:
        raise HTTPException(status_code=403, detail="Only applicants and curators can view applicant profiles")

    user = (
        db.query(models.User)
        .options(
            joinedload(models.User.applicant_profile),
            joinedload(models.User.responses),
        )
        .filter(models.User.id == user_id, models.User.role == "applicant")
        .first()
    )
    if not user or not user.applicant_profile:
        raise HTTPException(status_code=404, detail="Applicant profile not found")

    is_self = current_user.id == user.id
    is_contact = False
    if current_user.role == "applicant" and not is_self:
        is_contact = (
            db.query(models.Contact)
            .filter(
                models.Contact.status == "accepted",
                or_(
                    (models.Contact.requester_id == current_user.id) & (models.Contact.addressee_id == user.id),
                    (models.Contact.requester_id == user.id) & (models.Contact.addressee_id == current_user.id),
                ),
            )
            .first()
            is not None
        )

    can_view_profile = (
        is_self
        or current_user.role in {"curator", "admin"}
        or user.applicant_profile.is_profile_public
        or is_contact
    )
    if not can_view_profile:
        raise HTTPException(status_code=403, detail="Applicant profile is private")

    visible_responses: list[models.Response] = []
    if is_self or current_user.role in {"curator", "admin"}:
        visible_responses = user.responses
    elif user.applicant_profile.show_responses and (user.applicant_profile.is_profile_public or is_contact):
        visible_responses = user.responses

    return schemas.ApplicantProfileVisibilityOut(
        id=user.id,
        display_name=user.display_name,
        is_contact=is_contact,
        applicant_profile=schemas.ApplicantProfileOut.model_validate(user.applicant_profile),
        visible_responses=[schemas.ResponseOut.model_validate(response) for response in visible_responses],
    )
