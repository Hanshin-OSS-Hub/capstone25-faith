from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class VerificationHistoryCreate(BaseModel):
    member_id: Optional[int] = None
    input_content: str = Field(..., max_length=20)

class VerificationHistoryUpdate(BaseModel):
    member_id: Optional[int] = None
    input_content: Optional[str] = Field(default=None, max_length=20)
    final_risk_score: Optional[float] = None
    risk_level: Optional[str] = Field(default=None, max_length=20)

class VerificationHistoryOut(BaseModel):
    verification_id: int
    member_id: Optional[int]
    input_content: str
    risk_detail_id: Optional[int]
    final_risk_score: Optional[float]
    risk_level: Optional[str]
    verified_at: datetime

    class Config:
        from_attributes = True
