# backend/app/schemas.py
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- User ----------
class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=2, max_length=100)
    role: Literal["applicant", "employer", "curator", "admin"] = "applicant"


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserOut(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Applicant Profile ----------
class ApplicantProfileBase(BaseModel):
    full_name: Optional[str] = None
    university: Optional[str] = None
    course_or_year: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    is_profile_public: bool = False
    show_responses: bool = False


class ApplicantProfileCreate(ApplicantProfileBase):
    pass


class ApplicantProfileOut(ApplicantProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Employer Profile ----------
class EmployerProfileBase(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class EmployerProfileCreate(EmployerProfileBase):
    pass


class EmployerProfileOut(EmployerProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Tag ----------
class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    category: Literal["tech", "level", "employment_type", "format"]


class TagCreate(TagBase):
    pass


class TagOut(TagBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Opportunity ----------
class OpportunityBase(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=20)
    type: Literal["internship", "job", "mentorship", "event"]
    work_format: Literal["office", "hybrid", "remote"]
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    salary_range: Optional[str] = None
    expires_at: Optional[datetime] = None
    event_date: Optional[datetime] = None
    is_active: bool = True


class OpportunityCreate(OpportunityBase):
    tag_ids: Optional[List[int]] = None  # список ID тегов


class OpportunityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[Literal["internship", "job", "mentorship", "event"]] = None
    work_format: Optional[Literal["office", "hybrid", "remote"]] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    salary_range: Optional[str] = None
    expires_at: Optional[datetime] = None
    event_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    tag_ids: Optional[List[int]] = None


class OpportunityOut(OpportunityBase):
    id: int
    employer_id: int
    published_at: datetime
    tags: List[TagOut] = []

    model_config = ConfigDict(from_attributes=True)


# ---------- Response (отклик) ----------
class ResponseBase(BaseModel):
    cover_letter: Optional[str] = None


class ResponseCreate(ResponseBase):
    opportunity_id: int


class ResponseOut(ResponseBase):
    id: int
    applicant_id: int
    opportunity_id: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Contact (нетворкинг) ----------
class ContactBase(BaseModel):
    pass


class ContactCreate(ContactBase):
    addressee_id: int


class ContactOut(ContactBase):
    id: int
    requester_id: int
    addressee_id: int
    status: str
    created_at: datetime
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Token (JWT) ----------
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


# ---------- Login ----------
class LoginRequest(BaseModel):
    username: str  # email
    password: str
