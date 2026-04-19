from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.models import ArchiveFavorite, ArchiveItem, Member, UserProfile, VerificationHistory
from app.routers.auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/user", tags=["user"])


class UserMeResponse(BaseModel):
    login_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    occupation: Optional[str] = None
    gender: Optional[str] = None
    birth: Optional[date] = None

    class Config:
        from_attributes = True


class UserMeUpdateRequest(BaseModel):
    name: str
    email: EmailStr
    occupation: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserDeleteRequest(BaseModel):
    current_password: str


@router.get("/me", response_model=UserMeResponse)
def get_me(
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """내 정보 조회"""
    profile = db.query(UserProfile).filter(UserProfile.member_id == current_user.member_id).first()
    return UserMeResponse(
        login_id=current_user.login_id,
        name=current_user.name,
        phone=current_user.phone,
        email=current_user.email,
        occupation=profile.occupation if profile else None,
        gender=current_user.gender,
        birth=current_user.birth,
    )


@router.patch("/me", response_model=UserMeResponse)
def update_me(
    payload: UserMeUpdateRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """내 정보 수정 (이름, 이메일, 직업, 비밀번호)"""
    # 이메일 중복 확인 (본인 제외)
    email_exists = db.query(Member).filter(
        Member.email == payload.email,
        Member.member_id != current_user.member_id
    ).first()
    if email_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "DUPLICATE_EMAIL", "message": "이미 사용 중인 이메일입니다."}
        )

    # 비밀번호 변경 요청인 경우
    if payload.current_password or payload.new_password:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "MISSING_FIELD", "message": "기존 비밀번호를 입력해 주세요."}
            )
        if not payload.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "MISSING_FIELD", "message": "새 비밀번호를 입력해 주세요."}
            )
        if not verify_password(payload.current_password, current_user.pw_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "INVALID_PASSWORD", "message": "기존 비밀번호가 올바르지 않습니다."}
            )
        if len(payload.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "WEAK_PASSWORD", "message": "새 비밀번호는 최소 8자 이상이어야 합니다."}
            )
        current_user.pw_id = hash_password(payload.new_password)

    # 프로필 수정
    current_user.name = payload.name.strip()
    current_user.email = payload.email.strip()

    # UserProfile occupation 수정
    profile = db.query(UserProfile).filter(UserProfile.member_id == current_user.member_id).first()
    if profile:
        profile.occupation = (payload.occupation or "").strip() or None
    else:
        profile = UserProfile(
            member_id=current_user.member_id,
            occupation=(payload.occupation or "").strip() or None,
            is_risk=False,
        )
        db.add(profile)

    db.commit()
    db.refresh(current_user)

    return UserMeResponse(
        login_id=current_user.login_id,
        name=current_user.name,
        phone=current_user.phone,
        email=current_user.email,
        occupation=profile.occupation if profile else None,
        gender=current_user.gender,
        birth=current_user.birth,
    )


@router.delete("/me")
def delete_me(
    payload: UserDeleteRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """현재 로그인한 회원 탈퇴"""
    if not payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_FIELD", "message": "현재 비밀번호를 입력해 주세요."},
        )

    if not verify_password(payload.current_password, current_user.pw_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_PASSWORD", "message": "현재 비밀번호가 올바르지 않습니다."},
        )

    member_id = current_user.member_id

    db.query(ArchiveFavorite).filter(ArchiveFavorite.member_id == member_id).delete(
        synchronize_session=False
    )
    db.query(ArchiveItem).filter(ArchiveItem.member_id == member_id).delete(
        synchronize_session=False
    )
    db.query(VerificationHistory).filter(
        VerificationHistory.member_id == member_id
    ).delete(synchronize_session=False)
    db.query(UserProfile).filter(UserProfile.member_id == member_id).delete(
        synchronize_session=False
    )

    db.delete(current_user)
    db.commit()

    return {"ok": True, "message": "회원 탈퇴가 완료되었습니다."}
