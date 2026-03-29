"""Маршруты для регистрации, входа и получения текущего пользователя."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import secrets

from app import models, schemas, auth
from app.database import get_db
from app.email_service import send_verification_email, check_email_domain


router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрирует пользователя и создает пустой профиль по его роли."""

    # Проверка на существующего пользователя
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Хэширование пароля
    hashed_password = auth.get_password_hash(user_data.password)

    # Генерация токена подтверждения
    verification_token = secrets.token_urlsafe(32)

    # Создание пользователя (is_verified=False)
    db_user = models.User(
        email=user_data.email,
        hashed_password=hashed_password,
        display_name=user_data.display_name,
        role=user_data.role,
        is_active=True,
        is_verified=False,
        verification_token=verification_token
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Создание профиля по роли
    if user_data.role == "applicant":
        profile = models.ApplicantProfile(user_id=db_user.id)
        db.add(profile)
    elif user_data.role == "employer":
        profile = models.EmployerProfile(user_id=db_user.id, company_name="")
        db.add(profile)
    db.commit()


    # ОТПРАВКА ПИСЬМА С ПОДТВЕРЖДЕНИЕМ
    email_sent = send_verification_email(db_user.email, db_user.display_name, verification_token)
    if not email_sent:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Can't send email. Check SMTP settings.")

    return db_user

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    """Подтверждает email по токену из письма."""
    
    user = db.query(models.User).filter(models.User.verification_token == token).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный токен подтверждения")
    
    if user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email уже подтверждён")
    
    user.is_verified = True
    user.verification_token = None  # Очищаем токен
    db.commit()
    
    return {"message": "Email успешно подтверждён! Теперь войдите в систему."}

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Проверяет учетные данные и возвращает bearer-токен."""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserOut)
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Возвращает пользователя, извлеченного из access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user
