from pydantic import BaseModel, Field
from typing import Optional

class RiskDetailCreate(BaseModel):
    verification_id: int
    risk_category: str = Field(..., max_length=50)
    weight: float
    individual_risk_score: float
    final_risk_score: Optional[float] = None
    risk_level: Optional[str] = Field(default=None, max_length=20)

class RiskDetailUpdate(BaseModel):
    risk_category: Optional[str] = Field(default=None, max_length=50)
    weight: Optional[float] = None
    individual_risk_score: Optional[float] = None
    final_risk_score: Optional[float] = None
    risk_level: Optional[str] = Field(default=None, max_length=20)

class RiskDetailOut(BaseModel):
    risk_detail_id: int
    verification_id: int
    risk_category: str
    weight: float
    individual_risk_score: float
    final_risk_score: Optional[float]
    risk_level: Optional[str]

    class Config:
        from_attributes = True
