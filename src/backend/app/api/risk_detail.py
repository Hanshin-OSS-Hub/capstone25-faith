from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.sql import get_db
from app.schemas.risk_detail import RiskDetailCreate, RiskDetailUpdate, RiskDetailOut
from app.crud.risk_detail import (
    create_risk_detail, get_risk_detail, list_risk_details_by_verification, update_risk_detail, delete_risk_detail
)

router = APIRouter(prefix="/risk-details", tags=["RiskDetail"])

@router.post("", response_model=RiskDetailOut, status_code=201)
def create(data: RiskDetailCreate, db: Session = Depends(get_db)):
    return create_risk_detail(db, data)

@router.get("/{risk_detail_id}", response_model=RiskDetailOut)
def read(risk_detail_id: int, db: Session = Depends(get_db)):
    return get_risk_detail(db, risk_detail_id)

@router.get("/by-verification/{verification_id}", response_model=list[RiskDetailOut])
def read_by_verification(verification_id: int, db: Session = Depends(get_db)):
    return list_risk_details_by_verification(db, verification_id)

@router.patch("/{risk_detail_id}", response_model=RiskDetailOut)
def patch(risk_detail_id: int, data: RiskDetailUpdate, db: Session = Depends(get_db)):
    return update_risk_detail(db, risk_detail_id, data)

@router.delete("/{risk_detail_id}", status_code=204)
def remove(risk_detail_id: int, db: Session = Depends(get_db)):
    delete_risk_detail(db, risk_detail_id)
    return None
