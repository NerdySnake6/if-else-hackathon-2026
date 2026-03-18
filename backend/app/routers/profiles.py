"""Маршруты для чтения и обновления профилей по ролям пользователей."""

from fastapi import APIRouter, Depends, HTTPException
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
