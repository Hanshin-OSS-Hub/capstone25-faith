import json
import re
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.models import ArchiveFavorite, ArchiveItem, Member
from app.routers.auth import ALGORITHM, SECRET_KEY, get_current_user

router = APIRouter(prefix="/api/archive", tags=["archive"])

# result_snapshot 전체 JSON 길이 상한. base64 이미지가 포함되므로 과도하게 작으면
# _faith_archive_meta가 잘리거나 JSON이 깨져 검증 대상 미리보기가 비게 된다.
MAX_SNAPSHOT_CHARS = 12_000_000
# 단일 image_data_url 문자열 상한(초과 시 생략 + image_omitted_reason).
MAX_ARCHIVE_IMAGE_DATA_URL_CHARS = 6_000_000
# 디스크에 두는 아카이브 미리보기 이미지 (스냅샷에는 URL만 저장)
ARCHIVE_PREVIEW_DIR = Path(__file__).resolve().parents[2] / "data" / "archive_preview_images"
MAX_PREVIEW_UPLOAD_BYTES = 15 * 1024 * 1024
PREVIEW_BASENAME_RE = re.compile(
    r"^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp)$", re.IGNORECASE
)

RISK_CATEGORY_TO_ARCHIVE = {
    "딥페이크": ("enter", "연예"),
    "허위정보": ("politics", "정치"),
    "금융 사기": ("economy", "경제"),
    "혐오/폭력": ("social", "사회"),
    "성적 콘텐츠": ("etc", "기타"),
    "정상": ("etc", "기타"),
    "기타": ("etc", "기타"),
}


def _map_category(risk_category: Optional[str]) -> tuple[str, str]:
    if not risk_category:
        return ("etc", "기타")
    return RISK_CATEGORY_TO_ARCHIVE.get(risk_category.strip(), ("etc", "기타"))


def _optional_member_from_request(request: Request, db: Session) -> Optional[Member]:
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        mid = payload.get("sub")
        if mid is None:
            return None
        return db.query(Member).filter(Member.member_id == int(mid)).first()
    except (JWTError, ValueError, TypeError):
        return None


class ArchiveSaveBody(BaseModel):
    result: dict[str, Any]


class ArchiveSaveResponse(BaseModel):
    id: int
    message: str = "아카이브에 저장되었습니다."


class ArchivePatchTitleBody(BaseModel):
    title: str


class ArchiveListItem(BaseModel):
    id: int
    category_key: str
    category_label: str
    title: str
    risk_score: float
    created_at: str
    author_name: str


class ArchiveListResponse(BaseModel):
    items: list[ArchiveListItem]
    total_pages: int


class ArchiveDetailResponse(BaseModel):
    id: int
    category_key: str
    category_label: str
    title: str
    risk_score: float
    created_at: str
    author_name: str
    result: dict[str, Any]
    favorited: bool = False
    is_owner: bool = False


def _ensure_archive_preview_dir() -> None:
    ARCHIVE_PREVIEW_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_result_for_snapshot(raw: dict[str, Any]) -> dict[str, Any]:
    out = dict(raw)
    meta = out.get("_faith_archive_meta")
    if isinstance(meta, dict):
        m = dict(meta)
        u = m.get("image_url")
        if isinstance(u, str):
            u = u.strip()
            base = u.rsplit("/", 1)[-1] if u else ""
            if u.startswith("/api/archive/preview-image/") and PREVIEW_BASENAME_RE.fullmatch(
                base
            ):
                m["image_url"] = u
                m.pop("image_data_url", None)
            else:
                m.pop("image_url", None)
        img = m.get("image_data_url")
        if isinstance(img, str) and len(img) > MAX_ARCHIVE_IMAGE_DATA_URL_CHARS:
            m["image_data_url"] = None
            m["image_omitted_reason"] = "too_large"
        txt = m.get("text")
        if isinstance(txt, str) and len(txt) > 32_000:
            m["text"] = txt[:32_000] + "…"
        out["_faith_archive_meta"] = m
    return out


def _build_default_archive_title(
    risk_category: Optional[str], risk_score_100: float
) -> str:
    """아카이브 저장 직후 기본 제목. 사용자가 연필로 수정하기 전까지 이 형식을 쓴다."""
    cat = (risk_category or "기타").strip() or "기타"
    pct = int(round(max(0, min(100, risk_score_100))))
    base = f"[검증] {cat} · 위험 {pct}%"
    return base[:255]


def _snapshot_json(result: dict[str, Any]) -> str:
    raw = json.dumps(result, ensure_ascii=False, default=str)
    if len(raw) > MAX_SNAPSHOT_CHARS:
        raw = raw[: MAX_SNAPSHOT_CHARS - 20] + '…"}'
    return raw


_CT_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


@router.post("/preview-image")
async def upload_archive_preview_image(file: UploadFile = File(...)):
    """검증 대상 이미지를 디스크에 저장하고, 스냅샷에는 이 URL만 넣는다."""
    _ensure_archive_preview_dir()
    data = await file.read()
    if len(data) > MAX_PREVIEW_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "FILE_TOO_LARGE",
                "message": "이미지 용량이 너무 큽니다. (최대 15MB)",
            },
        )
    ct = (file.content_type or "").split(";")[0].strip().lower()
    ext = _CT_TO_EXT.get(ct)
    if not ext:
        fn = (file.filename or "").lower()
        for cand in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
            if fn.endswith(cand):
                ext = ".jpg" if cand == ".jpeg" else cand
                break
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_IMAGE_TYPE",
                "message": "JPEG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.",
            },
        )
    name = f"{uuid.uuid4().hex}{ext}"
    path = ARCHIVE_PREVIEW_DIR / name
    path.write_bytes(data)
    return {"ok": True, "image_url": f"/api/archive/preview-image/{name}"}


@router.get("/preview-image/{file_name}")
def get_archive_preview_image(file_name: str):
    if not PREVIEW_BASENAME_RE.fullmatch(file_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "파일을 찾을 수 없습니다."},
        )
    path = (ARCHIVE_PREVIEW_DIR / file_name).resolve()
    try:
        path.relative_to(ARCHIVE_PREVIEW_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "파일을 찾을 수 없습니다."},
        )
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "파일을 찾을 수 없습니다."},
        )
    return FileResponse(path)


@router.post("/save", response_model=ArchiveSaveResponse)
def save_to_archive(
    body: ArchiveSaveBody,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    final = body.result.get("final") or {}
    risk_score_100 = float(final.get("risk_score") or 0)
    risk_level = final.get("risk_level")
    risk_category = final.get("risk_category")
    if isinstance(risk_category, str):
        risk_category = risk_category.strip() or None

    cat_key, cat_label = _map_category(risk_category)
    title = _build_default_archive_title(risk_category, risk_score_100)
    score_01 = max(0.0, min(1.0, risk_score_100 / 100.0))

    author_name = current_user.login_id

    sanitized = _sanitize_result_for_snapshot(dict(body.result))

    row = ArchiveItem(
        member_id=current_user.member_id,
        category_key=cat_key,
        category_label=cat_label,
        title=title,
        risk_score=score_01,
        risk_level=str(risk_level)[:30] if risk_level is not None else None,
        risk_category=risk_category[:80] if risk_category else None,
        author_name=author_name[:80],
        result_snapshot=_snapshot_json(sanitized),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return ArchiveSaveResponse(id=int(row.id))


@router.patch("/{item_id}")
def patch_archive_item_title(
    item_id: int,
    body: ArchivePatchTitleBody,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    t = (body.title or "").strip()
    if not t:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_TITLE", "message": "제목을 입력해 주세요."},
        )
    t = t[:255]

    row = db.query(ArchiveItem).filter(ArchiveItem.id == item_id).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "항목을 찾을 수 없습니다."},
        )
    if row.member_id is None or int(row.member_id) != int(current_user.member_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "FORBIDDEN", "message": "수정 권한이 없습니다."},
        )

    row.title = t
    db.commit()
    return {"ok": True, "title": t}


@router.delete("/{item_id}")
def delete_archive_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    row = db.query(ArchiveItem).filter(ArchiveItem.id == item_id).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "항목을 찾을 수 없습니다."},
        )
    if row.member_id is None or int(row.member_id) != int(current_user.member_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "FORBIDDEN", "message": "삭제 권한이 없습니다."},
        )
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/items/{item_id}", response_model=ArchiveDetailResponse)
def get_archive_item(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """저장 시 넣은 result_snapshot을 파싱해 검증 결과 화면과 동일한 payload로 반환."""
    row = db.query(ArchiveItem).filter(ArchiveItem.id == item_id).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "항목을 찾을 수 없습니다."},
        )
    if not row.result_snapshot or not str(row.result_snapshot).strip():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NO_SNAPSHOT",
                "message": "저장된 검증 상세 데이터가 없습니다.",
            },
        )
    try:
        parsed: dict[str, Any] = json.loads(row.result_snapshot)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "INVALID_SNAPSHOT",
                "message": "저장 데이터 형식이 올바르지 않습니다.",
            },
        )
    if not isinstance(parsed, dict):
        parsed = {}

    member = _optional_member_from_request(request, db)
    favorited = False
    if member:
        favorited = (
            db.query(ArchiveFavorite)
            .filter(
                ArchiveFavorite.member_id == member.member_id,
                ArchiveFavorite.archive_item_id == item_id,
            )
            .first()
            is not None
        )

    is_owner = bool(
        member
        and row.member_id is not None
        and int(row.member_id) == int(member.member_id)
    )

    return ArchiveDetailResponse(
        id=int(row.id),
        category_key=row.category_key,
        category_label=row.category_label,
        title=row.title,
        risk_score=float(row.risk_score),
        created_at=row.created_at.isoformat() if row.created_at else "",
        author_name=row.author_name,
        result=parsed,
        favorited=favorited,
        is_owner=is_owner,
    )


@router.post("/items/{item_id}/favorite")
def add_archive_favorite(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    item = db.query(ArchiveItem).filter(ArchiveItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "message": "항목을 찾을 수 없습니다."},
        )
    exists = (
        db.query(ArchiveFavorite)
        .filter(
            ArchiveFavorite.member_id == current_user.member_id,
            ArchiveFavorite.archive_item_id == item_id,
        )
        .first()
    )
    if not exists:
        db.add(
            ArchiveFavorite(
                member_id=current_user.member_id,
                archive_item_id=item_id,
            )
        )
        db.commit()
    return {"ok": True, "favorited": True}


@router.delete("/items/{item_id}/favorite")
def remove_archive_favorite(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    db.query(ArchiveFavorite).filter(
        ArchiveFavorite.member_id == current_user.member_id,
        ArchiveFavorite.archive_item_id == item_id,
    ).delete()
    db.commit()
    return {"ok": True, "favorited": False}


@router.get("", response_model=ArchiveListResponse)
def list_archive(
    request: Request,
    db: Session = Depends(get_db),
    category: str = Query("all"),
    page: int = Query(1, ge=1),
    q: str = Query(""),
    sort: str = Query("latest"),
    size: int = Query(6, ge=1, le=50),
):
    qry = db.query(ArchiveItem)

    if category == "my":
        member = _optional_member_from_request(request, db)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error_code": "AUTH_REQUIRED",
                    "message": "MY 아카이브를 보려면 로그인이 필요합니다.",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
        qry = qry.filter(ArchiveItem.member_id == member.member_id)
    elif category == "favorites":
        member = _optional_member_from_request(request, db)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error_code": "AUTH_REQUIRED",
                    "message": "찜한 아카이브를 보려면 로그인이 필요합니다.",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
        qry = qry.join(
            ArchiveFavorite,
            ArchiveFavorite.archive_item_id == ArchiveItem.id,
        ).filter(ArchiveFavorite.member_id == member.member_id)
    elif category and category != "all":
        qry = qry.filter(ArchiveItem.category_key == category)

    qq = (q or "").strip()
    if qq:
        like = f"%{qq}%"
        qry = qry.filter(ArchiveItem.title.ilike(like))

    total = qry.count()
    total_pages = max(1, (total + size - 1) // size)

    if sort == "oldest":
        qry = qry.order_by(ArchiveItem.created_at.asc())
    else:
        qry = qry.order_by(ArchiveItem.created_at.desc())

    offset = (page - 1) * size
    rows = qry.offset(offset).limit(size).all()

    items = [
        ArchiveListItem(
            id=int(r.id),
            category_key=r.category_key,
            category_label=r.category_label,
            title=r.title,
            risk_score=float(r.risk_score),
            created_at=r.created_at.isoformat() if r.created_at else "",
            author_name=r.author_name,
        )
        for r in rows
    ]

    return ArchiveListResponse(items=items, total_pages=total_pages)
