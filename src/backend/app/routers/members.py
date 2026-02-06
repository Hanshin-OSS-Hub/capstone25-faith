from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.models import Member
from app.schemas import MemberCreate, MemberOut

router = APIRouter(prefix="/members", tags=["members"])

@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(payload: MemberCreate, db: Session = Depends(get_db)):
    # login_id 중복 체크
    exists = db.query(Member).filter(Member.login_id == payload.login_id).first()
    if exists:
        raise HTTPException(status_code=409, detail="login_id already exists")

    m = Member(**payload.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m

@router.get("", response_model=list[MemberOut])
def list_members(db: Session = Depends(get_db)):
    return db.query(Member).order_by(Member.member_id.desc()).all()

@router.get("/{member_id}", response_model=MemberOut)
def get_member(member_id: int, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.member_id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="member not found")
    return m

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.member_id == member_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="member not found")
    db.delete(m)
    db.commit()
