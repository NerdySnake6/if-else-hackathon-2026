# backend/app/models.py
from datetime import datetime
from typing import List, Optional

from sqlalchemy import ForeignKey, String, Text, DateTime, Float, Boolean, Table, Column
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Базовый класс для всех моделей"""
    pass


# Связующая таблица многие-ко-многим: Opportunity <-> Tag
opportunity_tag = Table(
    "opportunity_tag",
    Base.metadata,
    Column("opportunity_id", ForeignKey("opportunities.id"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id"), primary_key=True),
)


class User(Base):
    """Пользователь платформы (соискатель, работодатель, куратор)"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    
    # Роль: applicant (соискатель), employer (работодатель), curator (куратор), admin (админ)
    role: Mapped[str] = mapped_column(String(20), default="applicant")
    
    # Статусы
    is_active: Mapped[bool] = mapped_column(default=True)
    is_verified: Mapped[bool] = mapped_column(default=False)  # для работодателей
    
    # Метаданные
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Связи
    # Профиль соискателя (если роль applicant)
    applicant_profile: Mapped[Optional["ApplicantProfile"]] = relationship(back_populates="user", uselist=False)
    
    # Профиль работодателя (если роль employer)
    employer_profile: Mapped[Optional["EmployerProfile"]] = relationship(back_populates="user", uselist=False)
    
    # Вакансии/мероприятия созданные пользователем (для работодателей)
    opportunities: Mapped[List["Opportunity"]] = relationship(back_populates="employer")
    
    # Отклики пользователя (для соискателей)
    responses: Mapped[List["Response"]] = relationship(back_populates="applicant")
    
    # Нетворкинг: контакты, где пользователь инициатор
    sent_contacts: Mapped[List["Contact"]] = relationship(foreign_keys="Contact.requester_id", back_populates="requester")
    
    # Нетворкинг: контакты, где пользователь получатель
    received_contacts: Mapped[List["Contact"]] = relationship(foreign_keys="Contact.addressee_id", back_populates="addressee")


class ApplicantProfile(Base):
    """Профиль соискателя (студента/выпускника)"""
    __tablename__ = "applicant_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    
    # Основная информация
    full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    university: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    course_or_year: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "3 курс" или "2024 выпуск"
    
    # Резюме/портфолио
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    skills: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON строка или просто текст
    experience: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Приватность
    is_profile_public: Mapped[bool] = mapped_column(default=False)  # виден ли профиль другим соискателям
    show_responses: Mapped[bool] = mapped_column(default=False)    # видны ли отклики другим
    
    # Связь
    user: Mapped["User"] = relationship(back_populates="applicant_profile")


class EmployerProfile(Base):
    """Профиль работодателя (компании)"""
    __tablename__ = "employer_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    
    # Информация о компании
    company_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # сфера деятельности
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    social_links: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON с ссылками
    
    # Локация (для карты)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    
    # Связь
    user: Mapped["User"] = relationship(back_populates="employer_profile")


class Tag(Base):
    """Теги для навыков, технологий, уровней"""
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(30))  # "tech", "level", "employment_type", "format"
    
    # Связь многие-ко-многим с возможностями
    opportunities: Mapped[List["Opportunity"]] = relationship(secondary=opportunity_tag, back_populates="tags")


class Opportunity(Base):
    """Вакансия, стажировка, менторство или мероприятие"""
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    
    # Основная информация
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    
    # Тип: internship, job, mentorship, event
    type: Mapped[str] = mapped_column(String(20))
    
    # Формат: office, hybrid, remote
    work_format: Mapped[str] = mapped_column(String(20))
    
    # Локация
    location: Mapped[str] = mapped_column(String(300))  # адрес или "Удаленно"
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # широта для карты
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # долгота для карты
    
    # Зарплата/вознаграждение
    salary_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Даты
    published_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # срок действия
    event_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # для мероприятий
    
    # Статус
    is_active: Mapped[bool] = mapped_column(default=True)
    is_featured: Mapped[bool] = mapped_column(default=False)  # выделенная на главной
    
    # Связи
    employer: Mapped["User"] = relationship(back_populates="opportunities")
    tags: Mapped[List["Tag"]] = relationship(secondary=opportunity_tag, back_populates="opportunities")
    responses: Mapped[List["Response"]] = relationship(back_populates="opportunity")


class Response(Base):
    """Отклик соискателя на вакансию/мероприятие"""
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"))
    
    # Статус: pending, accepted, rejected, reserve
    status: Mapped[str] = mapped_column(String(20), default="pending")
    
    # Сопроводительное письмо/комментарий
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    applicant: Mapped["User"] = relationship(back_populates="responses")
    opportunity: Mapped["Opportunity"] = relationship(back_populates="responses")


class Contact(Base):
    """Нетворкинг: связь между соискателями"""
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    addressee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    
    # Статус: pending, accepted, declined
    status: Mapped[str] = mapped_column(String(20), default="pending")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Связи
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id], back_populates="sent_contacts")
    addressee: Mapped["User"] = relationship(foreign_keys=[addressee_id], back_populates="received_contacts")
