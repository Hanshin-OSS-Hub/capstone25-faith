from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException
from app.models.risk_detail import RiskDetail
from app.schemas.risk_detail import RiskDetailCreate, RiskDetailUpdate

def create_risk_detail(db: Session, data: RiskDetailCreate) -> RiskDetail:
    obj = RiskDetail(
        verification_id=data.verification_id,
        risk_category=data.risk_category,
        weight=data.weight,
        individual_risk_score=data.individual_risk_score,
        final_risk_score=data.final_risk_score,
        risk_level=data.risk_level,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def get_risk_detail(db: Session, risk_detail_id: int) -> RiskDetail:
    obj = db.get(RiskDetail, risk_detail_id)
    if not obj:
        raise HTTPException(status_code=404, detail="RiskDetail not found")
    return obj

def list_risk_details_by_verification(db: Session, verification_id: int) -> list[RiskDetail]:
    stmt = select(RiskDetail).where(RiskDetail.verification_id == verification_id).order_by(RiskDetail.risk_detail_id.asc())
    return list(db.execute(stmt).scalars().all())

def update_risk_detail(db: Session, risk_detail_id: int, data: RiskDetailUpdate) -> RiskDetail:
    obj = get_risk_detail(db, risk_detail_id)

    if data.risk_category is not None:
        obj.risk_category = data.risk_category
    if data.weight is not None:
        obj.weight = data.weight
    if data.individual_risk_score is not None:
        obj.individual_risk_score = data.individual_risk_score
    if data.final_risk_score is not None:
        obj.final_risk_score = data.final_risk_score
    if data.risk_level is not None:
        obj.risk_level = data.risk_level

    db.commit()
    db.refresh(obj)
    return obj

def delete_risk_detail(db: Session, risk_detail_id: int) -> None:
    obj = get_risk_detail(db, risk_detail_id)
    db.delete(obj)
    db.commit()
