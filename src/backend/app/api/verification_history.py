from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.sql import get_db
from app.schemas.verification_history import (
    VerificationHistoryCreate, VerificationHistoryUpdate, VerificationHistoryOut
)
from app.crud.verification_history import (
    create_verification, get_verification, list_verifications, update_verification, delete_verification
)

router = APIRouter(prefix="/verifications", tags=["VerificationHistory"])

@router.post("", response_model=VerificationHistoryOut, status_code=201)
def create(data: VerificationHistoryCreate, db: Session = Depends(get_db)):
    return create_verification(db, data)

@router.get("/{verification_id}", response_model=VerificationHistoryOut)
def read(verification_id: int, db: Session = Depends(get_db)):
    return get_verification(db, verification_id)

@router.get("", response_model=list[VerificationHistoryOut])
def read_list(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return list_verifications(db, skip=skip, limit=limit)

@router.patch("/{verification_id}", response_model=VerificationHistoryOut)
def patch(verification_id: int, data: VerificationHistoryUpdate, db: Session = Depends(get_db)):
    return update_verification(db, verification_id, data)

@router.delete("/{verification_id}", status_code=204)
def remove(verification_id: int, db: Session = Depends(get_db)):
    delete_verification(db, verification_id)
    return None
