from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException
from app.models.verification_history import VerificationHistory
from app.schemas.verification_history import VerificationHistoryCreate, VerificationHistoryUpdate

def create_verification(db: Session, data: VerificationHistoryCreate) -> VerificationHistory:
    obj = VerificationHistory(
        member_id=data.member_id,
        input_content=data.input_content,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def get_verification(db: Session, verification_id: int) -> VerificationHistory:
    obj = db.get(VerificationHistory, verification_id)
    if not obj:
        raise HTTPException(status_code=404, detail="VerificationHistory not found")
    return obj

def list_verifications(db: Session, skip: int = 0, limit: int = 20) -> list[VerificationHistory]:
    stmt = select(VerificationHistory).offset(skip).limit(limit).order_by(VerificationHistory.verification_id.desc())
    return list(db.execute(stmt).scalars().all())

def update_verification(db: Session, verification_id: int, data: VerificationHistoryUpdate) -> VerificationHistory:
    obj = get_verification(db, verification_id)

    if data.member_id is not None:
        obj.member_id = data.member_id
    if data.input_content is not None:
        obj.input_content = data.input_content
    if data.final_risk_score is not None:
        obj.final_risk_score = data.final_risk_score
    if data.risk_level is not None:
        obj.risk_level = data.risk_level

    db.commit()
    db.refresh(obj)
    return obj

def delete_verification(db: Session, verification_id: int) -> None:
    obj = get_verification(db, verification_id)
    db.delete(obj)
    db.commit()
