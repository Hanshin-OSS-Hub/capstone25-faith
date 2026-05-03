import os
import sys
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

# ---------------------------------------------------------
# Import 안정화:
# - app/risk_engine/faith_text_risk.py 를 먼저 로드하고,
# - sys.modules["faith_text_risk"] 에 alias 등록
# - 그러면 faith_image_risk.py의 "from faith_text_risk import ..."가 깨지지 않음
# ---------------------------------------------------------
import importlib

_ft = importlib.import_module("app.risk_engine.faith_text_risk")
sys.modules.setdefault("faith_text_risk", _ft)

_fi = importlib.import_module("app.risk_engine.faith_image_risk")

# faith exports
UserContext = _ft.UserContext
analyze_text = _ft.analyze_text

analyze_image = _fi.analyze_image


router = APIRouter(prefix="/api/ai/gemini_engine", tags=["ai-gemini-engine"])


def _map_engine_level_to_backend(level: str) -> str:
    """
    faith 엔진: Low/Moderate/High/Critical
    backend: LOW/MEDIUM/HIGH
    """
    l = (level or "").lower()
    if l == "low":
        return "LOW"
    if l == "moderate":
        return "MEDIUM"
    # high/critical → HIGH
    return "HIGH"


def _category_ko_from_faith(engine_category: str, final01: float, agent_out: dict) -> str:
    """
    faith 엔진의 risk_category(영문) → backend용 한국어 카테고리
    """
    # faith쪽 agent_out에 flags/fact_check_label이 있으면 같이 활용
    flags = agent_out.get("flags") or {}
    fact_label = str(agent_out.get("fact_check_label", "UNCERTAIN")).upper()
    fact_risk = float(agent_out.get("fact_risk", 0.0) or 0.0)

    if fact_label == "FALSE" or fact_risk >= 0.7:
        return "허위정보"

    if flags.get("sexual"):
        return "성적 콘텐츠"
    if flags.get("deepfake") or flags.get("impersonation"):
        return "딥페이크"
    if flags.get("phishing") or flags.get("finance"):
        return "금융 사기"
    if flags.get("hate") or flags.get("violence"):
        return "혐오/폭력"

    # medical/political/other 처리
    if (engine_category in ("medical", "political")) and final01 >= 0.34:
        return "허위정보"

    return "정상" if final01 < 0.34 else "허위정보"


def gemini_engine_analyze_only(
    text: str,
    is_logged_in: bool = False,
    age: Optional[int] = None,
    gender: str = "other",
) -> dict:
    """
    FastAPI 내부에서 재사용 가능한 함수.
    반환 형식은 기존 gemini_analyze_only와 유사하게 맞춤(0~100, categories 등 포함).
    """
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY missing. Set GEMINI_API_KEY in env.")

    user = UserContext(is_logged_in=is_logged_in, age=age, gender=gender)
    report = analyze_text(text=text, user=user)

    agent_out = report.agent_output
    eng = report.engine_result

    final01 = float(getattr(eng, "final_score", 0.0))
    final100 = int(round(final01 * 100))

    level_backend = _map_engine_level_to_backend(getattr(eng, "risk_level", "LOW"))
    cat_ko = _category_ko_from_faith(getattr(eng, "risk_category", "other"), final01, agent_out)

    reasons = []
    # faith agent_out notes를 1순위로
    if agent_out.get("notes"):
        reasons.append(str(agent_out["notes"]))
    # 엔진 노트도 보조로
    if getattr(eng, "engine_notes_ko", None):
        reasons.append(str(getattr(eng, "engine_notes_ko")))
    if getattr(eng, "engine_notes", None) and str(getattr(eng, "engine_notes")) not in reasons:
        reasons.append(str(getattr(eng, "engine_notes")))
    if not reasons:
        reasons = ["엔진 검증 결과"]

    return {
        "risk_score": final100,
        "risk_level": level_backend,
        "categories": [cat_ko] if cat_ko else [],
        "reasons": reasons[:5],
        "needs_action": level_backend == "HIGH",
        "details": {
            "agent_output": agent_out,
            "engine_result": eng.__dict__ if hasattr(eng, "__dict__") else {},
        },
    }


def gemini_engine_analyze_with_image(
    text: str,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    is_logged_in: bool = False,
    age: Optional[int] = None,
    gender: str = "other",
) -> dict:
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY missing. Set GEMINI_API_KEY in env.")

    # 확장자 결정
    ext = ".jpg"
    mt = (mime_type or "").lower()
    if "png" in mt:
        ext = ".png"
    elif "webp" in mt:
        ext = ".webp"
    elif "avif" in mt:
        ext = ".avif"
    elif "heic" in mt or "heif" in mt:
        ext = ".heic"

    user = UserContext(is_logged_in=is_logged_in, age=age, gender=gender)

    # Windows 안전: mkstemp 사용 + 파일 닫고 다시 열게 하기
    fd, path = tempfile.mkstemp(suffix=ext)
    report = None
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(image_bytes)

        report = analyze_image(image_path=path, user=user)

    finally:
        try:
            os.remove(path)
        except Exception:
            pass

    if report is None:
        raise RuntimeError("Image analysis failed before producing report.")

    agent_out = report.agent_output
    eng = report.engine_result

    final01 = float(getattr(eng, "final_score", 0.0))
    final100 = int(round(final01 * 100))

    level_backend = _map_engine_level_to_backend(getattr(eng, "risk_level", "LOW"))
    cat_ko = _category_ko_from_faith(getattr(eng, "risk_category", "other"), final01, agent_out)

    reasons = []
    if agent_out.get("notes"):
        reasons.append(str(agent_out["notes"]))
    if getattr(eng, "engine_notes_ko", None):
        reasons.append(str(getattr(eng, "engine_notes_ko")))
    if getattr(eng, "engine_notes", None) and str(getattr(eng, "engine_notes")) not in reasons:
        reasons.append(str(getattr(eng, "engine_notes")))
    if not reasons:
        reasons = ["엔진 검증 결과"]

    return {
        "risk_score": final100,
        "risk_level": level_backend,
        "categories": [cat_ko] if cat_ko else [],
        "reasons": reasons[:5],
        "needs_action": level_backend == "HIGH",
        "details": {
            "agent_output": agent_out,
            "engine_result": eng.__dict__ if hasattr(eng, "__dict__") else {},
        },
    }

def _is_retryable_gemini_error(e: Exception) -> bool:
    msg = str(e)
    return (
        "429" in msg or "RESOURCE_EXHAUSTED" in msg or
        "503" in msg or "UNAVAILABLE" in msg or
        "502" in msg or "504" in msg
    )

# -----------------------------
# Optional: REST endpoints
# -----------------------------
@router.post("/text")
async def api_text(
    text: str = Form(...),
    member_id: int | None = Form(default=None),
    age: int | None = Form(default=None),
    gender: str = Form(default="other"),
    is_logged_in: bool = Form(default=False),
):
    try:
        return gemini_engine_analyze_only(text=text, is_logged_in=is_logged_in, age=age, gender=gender)
    except Exception as e:
        if _is_retryable_gemini_error(e):
            return {
                "degraded": True,
                "degraded_level": "partial",
                "message": "Gemini temporarily unavailable (quota/high demand).",
                "agents": {
                    "gemini": {
                        "error": str(e)
                    }
                }
            }
        raise HTTPException(status_code=500, detail=f"gemini_engine(text) error: {e}")


@router.post("/media")
async def api_media(
    text: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    age: int | None = Form(default=None),
    gender: str = Form(default="other"),
    is_logged_in: bool = Form(default=False),
):
    if image is None:
        # 텍스트만
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Provide text and/or image")
        try:
            return gemini_engine_analyze_only(text=text, is_logged_in=is_logged_in, age=age, gender=gender)
        except Exception as e:
            if _is_retryable_gemini_error(e):
                return {
                    "degraded": True,
                    "degraded_level": "partial",
                    "message": "Gemini temporarily unavailable (quota/high demand).",
                    "agents": {
                        "gemini": {
                            "error": str(e)
                        }
                    }
                }
            raise HTTPException(status_code=500, detail=f"gemini_engine(text) error: {e}")

    # 이미지 포함
    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    mime = (image.content_type or "image/jpeg").lower()
    try:
        return gemini_engine_analyze_with_image(
            text=text or "",
            image_bytes=img_bytes,
            mime_type=mime,
            is_logged_in=is_logged_in,
            age=age,
            gender=gender,
        )
    except Exception as e:
        if _is_retryable_gemini_error(e):
            return {
                "degraded": True,
                "degraded_level": "insufficient" if not (text or "").strip() else "partial",
                "message": "Gemini temporarily unavailable (quota/high demand).",
                "agents": {
                    "gemini": {
                        "error": str(e)
                    }
                }
            }
        raise HTTPException(status_code=500, detail=f"gemini_engine(media) error: {e}")
