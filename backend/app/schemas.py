"""Pydantic-схемы для запросов и ответов API."""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict

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

class EmployerProfileBase(BaseModel):
    company_name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class EmployerProfileCreate(EmployerProfileBase):
    company_name: str = Field(min_length=1, max_length=200)


class ApplicantProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    university: Optional[str] = None
    course_or_year: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    is_profile_public: Optional[bool] = None
    show_responses: Optional[bool] = None


class EmployerProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class EmployerProfileOut(EmployerProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class CuratorUserOut(UserOut):
    applicant_profile: Optional[ApplicantProfileOut] = None
    employer_profile: Optional[EmployerProfileOut] = None


class CuratorUserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    employer_profile: Optional[EmployerProfileUpdate] = None

class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    category: Literal["tech", "level", "employment_type", "format"]


class TagCreate(TagBase):
    pass


class TagOut(TagBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

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
    tag_ids: Optional[List[int]] = None


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
    employer_name: str
    published_at: datetime
    tags: List[TagOut] = []

    model_config = ConfigDict(from_attributes=True)


class CuratorOpportunityOut(OpportunityOut):
    employer_name: str


class CuratorOpportunityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[Literal["internship", "job", "mentorship", "event"]] = None
    work_format: Optional[Literal["office", "hybrid", "remote"]] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    expires_at: Optional[datetime] = None
    event_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class GeocodeResult(BaseModel):
    lat: float
    lng: float
    formatted_address: str
    precision: Optional[str] = None

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


class EmployerResponseOut(BaseModel):
    id: int
    opportunity_id: int
    opportunity_title: str
    applicant_id: int
    applicant_name: str
    applicant_email: EmailStr
    status: str
    cover_letter: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ResponseStatusUpdate(BaseModel):
    status: Literal["pending", "accepted", "rejected", "reserve"]

class ContactBase(BaseModel):
    pass


class ContactCreate(ContactBase):
    addressee_id: int


class ContactStatusUpdate(BaseModel):
    status: Literal["accepted", "declined"]


class ContactApplicantSummary(BaseModel):
    id: int
    display_name: str
    applicant_profile: Optional[ApplicantProfileOut] = None

    model_config = ConfigDict(from_attributes=True)


class ContactNetworkOut(ContactBase):
    id: int
    status: str
    direction: Literal["incoming", "outgoing"]
    created_at: datetime
    accepted_at: Optional[datetime] = None
    peer: ContactApplicantSummary


class RecommendationCreate(BaseModel):
    recommended_user_id: int
    opportunity_id: int
    message: Optional[str] = None


class RecommendationOpportunitySummary(BaseModel):
    id: int
    title: str
    type: str
    work_format: str
    location: str
    employer_name: str

    model_config = ConfigDict(from_attributes=True)


class RecommendationOut(BaseModel):
    id: int
    direction: Literal["incoming", "outgoing"]
    created_at: datetime
    message: Optional[str] = None
    peer: ContactApplicantSummary
    opportunity: RecommendationOpportunitySummary


class ContactOut(ContactBase):
    id: int
    requester_id: int
    addressee_id: int
    status: str
    created_at: datetime
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


class ProfileMeOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    applicant_profile: Optional[ApplicantProfileOut] = None
    employer_profile: Optional[EmployerProfileOut] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileMeUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    applicant_profile: Optional[ApplicantProfileUpdate] = None
    employer_profile: Optional[EmployerProfileUpdate] = None

class LoginRequest(BaseModel):
    username: str
    password: str
