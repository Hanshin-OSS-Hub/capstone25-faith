from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

class MemberCreate(BaseModel):
    login_id: str
    pw_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    birth: Optional[date] = None

class MemberOut(BaseModel):
    member_id: int
    login_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    birth: Optional[date] = None
    created: datetime

    class Config:
        from_attributes = True  # ORM -> Pydantic 변환
