from datetime import datetime, timedelta
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.models import Member, UserProfile

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "faith-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class SignupRequest(BaseModel):
    login_id: str
    password: str
    name: str
    phone: str
    email: EmailStr
    gender: str
    birth: str


class LoginRequest(BaseModel):
    login_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CheckIdResponse(BaseModel):
    available: bool
    message: Optional[str] = None


class SignupResponse(BaseModel):
    success: bool
    user_id: Optional[int] = None
    message: Optional[str] = None


def hash_password(password: str) -> str:
    """passlib 대신 bcrypt 직접 사용 (bcrypt 4.x와 passlib 1.7 조합 이슈 회피)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.get("/check-id", response_model=CheckIdResponse)
def check_login_id(login_id: str, db: Session = Depends(get_db)):
    """아이디 중복 확인"""
    if not login_id or len(login_id) < 4:
        return CheckIdResponse(available=False, message="아이디는 4자 이상이어야 합니다.")
    
    exists = db.query(Member).filter(Member.login_id == login_id).first()
    if exists:
        return CheckIdResponse(available=False, message="이미 사용 중인 아이디입니다.")
    
    return CheckIdResponse(available=True)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """회원가입"""
    exists = db.query(Member).filter(Member.login_id == payload.login_id).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "DUPLICATE_ID", "message": "이미 존재하는 아이디입니다."}
        )
    
    email_exists = db.query(Member).filter(Member.email == payload.email).first()
    if email_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "DUPLICATE_EMAIL", "message": "이미 사용 중인 이메일입니다."}
        )
    
    hashed_pw = hash_password(payload.password)
    
    from datetime import date as date_type
    birth_date = None
    if payload.birth:
        try:
            birth_date = date_type.fromisoformat(payload.birth)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_DATE", "message": "생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)"}
            )
    
    member = Member(
        login_id=payload.login_id,
        pw_id=hashed_pw,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        gender=payload.gender,
        birth=birth_date,
    )
    
    db.add(member)
    db.commit()
    db.refresh(member)
    
    # user_profile 생성
    def calculate_age_group(birth_date) -> str:
        if not birth_date:
            return None
        from datetime import date as date_type
        today = date_type.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        if age < 20:
            return "10대"
        elif age < 30:
            return "20대"
        elif age < 40:
            return "30대"
        elif age < 50:
            return "40대"
        elif age < 60:
            return "50대"
        else:
            return "60대 이상"
    
    user_profile = UserProfile(
        member_id=member.member_id,
        age_group=calculate_age_group(birth_date),
        occupation=None,
        is_risk=False,
    )
    db.add(user_profile)
    db.commit()
    
    return SignupResponse(success=True, user_id=member.member_id)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """로그인"""
    member = db.query(Member).filter(Member.login_id == payload.login_id).first()
    
    if not member or not verify_password(payload.password, member.pw_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_CREDENTIALS", "message": "아이디 또는 비밀번호가 올바르지 않습니다."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": str(member.member_id), "login_id": member.login_id}
    )
    
    return TokenResponse(access_token=access_token)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Member:
    """현재 로그인한 사용자 정보 가져오기"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error_code": "INVALID_TOKEN", "message": "인증 정보가 유효하지 않습니다."},
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        member_id: str = payload.get("sub")
        if member_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    member = db.query(Member).filter(Member.member_id == int(member_id)).first()
    if member is None:
        raise credentials_exception
    
    return member
