import asyncio
import os
import tempfile
from typing import Any, Dict, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field

from app.api.ai_gemini_engine import (
    gemini_engine_analyze_only,
    gemini_engine_analyze_with_image,
)
from app.api.ai_hugging import hugging_agent
from app.api.ai_groq import groq_classify

from app.risk_engine.schemas import AgentResult, UserContext
from app.risk_engine.engine import ensemble, clamp01

router = APIRouter(prefix="/api/ai/mas", tags=["mas"])


# -----------------------------
# Input schema
# -----------------------------
class MASTextIn(BaseModel):
    text: Optional[str] = ""
    is_logged_in: bool = False
    age: Optional[int] = None
    gender: str = "other"


# -----------------------------
# Mapping helpers
# -----------------------------
VALID_CATS = ["혐오/폭력", "딥페이크", "금융 사기", "허위정보", "성적 콘텐츠", "정상"]


def _norm_cat(cat: str) -> str:
    c = (cat or "").strip()
    return c if c in VALID_CATS else "정상"


def _agentresult_from_gemini(out: Dict[str, Any]) -> AgentResult:
    s100 = float(out.get("risk_score", 0) or 0)
    s01 = clamp01(s100 / 100.0)
    cats = out.get("categories") or []
    cat = _norm_cat(cats[0] if cats else "정상")
    reason = (out.get("reasons") or [""])[0] if out.get("reasons") else ""
    return AgentResult(agent="gemini", score01=s01, category=cat, reason=reason, raw=out)


def _agentresult_from_hf(out: Dict[str, Any]) -> AgentResult:
    s01 = clamp01(float(out.get("risk_score", 0) or 0))
    cat = _norm_cat(out.get("risk_category", "정상"))
    reason = str(out.get("risk_reason", "") or "")
    if s01 < 0.34:
        cat = "정상"
    return AgentResult(agent="hf", score01=s01, category=cat, reason=reason, raw=out)



def _agentresult_from_groq(out: Dict[str, Any]) -> AgentResult:
    # groq는 risk_score가 0~1로 온다고 했지?
    s01 = clamp01(float(out.get("risk_score", 0) or 0))
    cat = _norm_cat(out.get("risk_category", "정상"))
    reason = str(out.get("risk_reason", "") or "")
    return AgentResult(agent="groq", score01=s01, category=cat, reason=reason, raw=out)


def _ftyp_major_brand_lower(b: bytes) -> bytes | None:
    """ISO BMFF `ftyp` major brand (offset 8..12), lowercased 4-byte token."""
    if len(b) < 12 or b[4:8] != b"ftyp":
        return None
    return b[8:12].lower()


# AVIF/HEIF 등 이미지용 ISOBMFF — `ftyp`만 보고 MP4로 오인하면 영상 분기로 들어가 깨짐
_FTYP_STILL_IMAGE_BRANDS = frozenset(
    {
        b"avif",
        b"avis",
        b"mif1",
        b"msf1",
        b"heic",
        b"heix",
        b"hevc",
        b"hevx",
        b"heim",
        b"heis",
        b"miaf",
        b"mipr",
    }
)


def _bytes_look_like_video(b: bytes) -> bool:
    if not b or len(b) < 12:
        return False
    if b[0:4] == b"\x1a\x45\xdf\xa3":
        return True
    if b[4:8] == b"ftyp":
        brand = _ftyp_major_brand_lower(b)
        if brand and brand in _FTYP_STILL_IMAGE_BRANDS:
            return False
        return True
    return False


def _guess_image_mime_from_filename(name: str | None) -> str | None:
    fn = (name or "").lower()
    if fn.endswith(".avif"):
        return "image/avif"
    if fn.endswith(".heic"):
        return "image/heic"
    if fn.endswith(".heif"):
        return "image/heif"
    return None


def _video_temp_suffix(mime: str, filename: str | None) -> str:
    ml = (mime or "").lower()
    fn = (filename or "").lower()
    if "webm" in ml or fn.endswith(".webm"):
        return ".webm"
    if "quicktime" in ml or "mov" in ml or fn.endswith(".mov"):
        return ".mov"
    return ".mp4"


async def _mas_media_video_branch(
    video_bytes: bytes,
    mime: str,
    filename: str | None,
    clean_text: str,
    payload: MASTextIn,
) -> Dict[str, Any]:
    """MAS /media 에 영상이 실려 온 경우(필드명 image) — 영상 MAS 파이프라인 후 동일 형태로 반환."""
    from app.api.faith_video_risk import _analyze_video_full_async

    suffix = _video_temp_suffix(mime, filename)
    video_path: str | None = None
    try:
        fd, video_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as f:
            f.write(video_bytes)
        video_payload = await _analyze_video_full_async(
            video_path,
            clean_text,
            payload.age,
            payload.gender,
            payload.is_logged_in,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"영상 분석 처리 중 오류: {e}",
        ) from e
    finally:
        if video_path:
            try:
                os.remove(video_path)
            except OSError:
                pass

    out: Dict[str, Any] = {
        "_router_version": video_payload.get("_router_version", "MAS_MEDIA_v7_video_mux"),
        "final": video_payload["final"],
        "agents": video_payload["agents"],
    }
    # 영상 전용 파이프라인 메타(MAS 기본 응답에도 노출 — 프레임 요약 확인용)
    for key in ("summary", "final_video"):
        if key in video_payload:
            out[key] = video_payload[key]
    return out


async def _safe(name: str, coro):
    try:
        return name, await coro
    except Exception as e:
        return name, {"error": str(e)}


async def _run_gemini_text(payload: MASTextIn):
    return await asyncio.to_thread(
        gemini_engine_analyze_only,
        text=payload.text,
        is_logged_in=payload.is_logged_in,
        age=payload.age,
        gender=payload.gender,
    )


async def _run_gemini_media(text: str, image_bytes: bytes, mime: str, payload: MASTextIn):
    return await asyncio.to_thread(
        gemini_engine_analyze_with_image,
        text=text,
        image_bytes=image_bytes,
        mime_type=mime,
        is_logged_in=payload.is_logged_in,
        age=payload.age,
        gender=payload.gender,
    )


async def _run_groq_text(payload: MASTextIn):
    return await asyncio.to_thread(groq_classify, payload.dict())


async def _run_hf_text(payload: MASTextIn):
    return await hugging_agent(payload.text)


def _is_retryable_gemini_error_message(message: str) -> bool:
    msg = str(message or "")
    return (
        "RESOURCE_EXHAUSTED" in msg or "429" in msg or
        "UNAVAILABLE" in msg or "503" in msg or
        "502" in msg or "504" in msg
    )


@router.post("/text")
async def mas_text(payload: MASTextIn):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    results = await asyncio.gather(
        _safe("gemini", _run_gemini_text(payload)),
        _safe("groq", _run_groq_text(payload)),
        _safe("hf", _run_hf_text(payload)),
    )

    agents_raw = {k: v for k, v in results}

    # error는 제외하고 AgentResult로 변환
    agents: Dict[str, AgentResult] = {}
    if "gemini" in agents_raw and not agents_raw["gemini"].get("error"):
        agents["gemini"] = _agentresult_from_gemini(agents_raw["gemini"])
    if "groq" in agents_raw and not agents_raw["groq"].get("error"):
        agents["groq"] = _agentresult_from_groq(agents_raw["groq"])
    if "hf" in agents_raw and not agents_raw["hf"].get("error"):
        agents["hf"] = _agentresult_from_hf(agents_raw["hf"])

    if not agents:
        return {
            "_router_version": "MAS_TEXT_v2_degraded_no_agents",
            "degraded": True,
            "detail": {
                "message": "현재 AI 모델 응답이 지연되어 검증 결과를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                "degraded": True,
                "agents": agents_raw,
            },
            "final": {
                "risk_score": 0,
                "risk_level": "UNKNOWN",
                "risk_category": "기타",
                "reasons_by_category": [],
            },
            "agents": agents_raw,
        }

    final = ensemble(agents)

    return {"final": final.__dict__, "agents": agents_raw}

import re

_ZERO_WIDTH_RE = re.compile(r"[\u200B-\u200D\uFEFF]")  # zero-width space/joiner/BOM

def _sanitize_text(t: str | None) -> str:
    if not t:
        return ""
    s = _ZERO_WIDTH_RE.sub("", t) 
    s = s.strip()
    # 프론트에서 자주 오는 쓰레기 문자열 방어
    if s.lower() in ("undefined", "null", "none", "nan"):
        return ""
    return s


from fastapi import Response

@router.post("/media")
async def mas_media(
    text: str | None = Form(default="", description="optional text"),
    image: UploadFile | None = File(default=None),
    age: int | None = Form(default=None),
    gender: str = Form(default="other"),
    is_logged_in: bool = Form(default=False),
):
    clean_text = _sanitize_text(text)   
    has_text = bool(clean_text)

    payload = MASTextIn(
        text=clean_text if has_text else "",
        is_logged_in=is_logged_in,
        age=age,
        gender=gender,
    )

    # 1) 이미지 없이 텍스트만
    if image is None:
        if not has_text:
            raise HTTPException(status_code=400, detail="Provide text and/or image")
        return await mas_text(payload)

    # 2) 이미지 포함
    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    mime = (image.content_type or "image/jpeg").lower()
    if not mime.startswith("image/"):
        guessed = _guess_image_mime_from_filename(image.filename)
        if guessed:
            mime = guessed

    # 브라우저가 image/* 로 주면 바이트 스니핑과 무관하게 이미지 파이프라인(영상 오인 방지)
    if mime.startswith("image/"):
        pass
    elif mime.startswith("video/") or _bytes_look_like_video(img_bytes):
        return await _mas_media_video_branch(
            img_bytes,
            mime,
            image.filename,
            clean_text if has_text else "",
            payload,
        )

    gemini_result = await _safe(
        "gemini", _run_gemini_media(clean_text if has_text else "", img_bytes, mime, payload)
    )
    # gemini_result는 ("gemini", {...}) 형태
    agents_raw: Dict[str, Any] = {gemini_result[0]: gemini_result[1]}

    degraded = False
    degraded_msg = None

    if agents_raw["gemini"].get("error"):
        err = agents_raw["gemini"]["error"]
        if _is_retryable_gemini_error_message(err):
            degraded = True
            degraded_msg = "현재 Gemini 응답이 지연되어 이미지 검증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."

    if has_text:
        groq_k, groq_v = await _safe("groq", _run_groq_text(payload))
        hf_k, hf_v = await _safe("hf", _run_hf_text(payload))
        agents_raw[groq_k] = groq_v
        agents_raw[hf_k] = hf_v
    else:
        agents_raw["groq"] = {"skipped": True, "reason": "no text"}
        agents_raw["hf"] = {"skipped": True, "reason": "no text"}

    agents: Dict[str, AgentResult] = {}
    if "gemini" in agents_raw and not agents_raw["gemini"].get("error"):
        agents["gemini"] = _agentresult_from_gemini(agents_raw["gemini"])
    if "groq" in agents_raw and not agents_raw["groq"].get("error") and not agents_raw["groq"].get("skipped"):
        agents["groq"] = _agentresult_from_groq(agents_raw["groq"])
    if "hf" in agents_raw and not agents_raw["hf"].get("error") and not agents_raw["hf"].get("skipped"):
        agents["hf"] = _agentresult_from_hf(agents_raw["hf"])

    if not agents:
        return {
            "_router_version": "MAS_MEDIA_v7_degraded_no_agents",
            "degraded": True,
            "detail": {
                "message": degraded_msg or "현재 AI 모델 응답이 지연되어 검증 결과를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                "degraded": True,
                "agents": agents_raw,
            },
            "final": {
                "risk_score": 0,
                "risk_level": "UNKNOWN",
                "risk_category": "기타",
                "reasons_by_category": [],
            },
            "agents": agents_raw,
        }

    final = ensemble(agents)

    if degraded:
        return {
            "_router_version": "MAS_MEDIA_v7_degraded_partial",
            "degraded": True,
            "detail": {
                "message": degraded_msg,
                "degraded": True,
                "agents": agents_raw,
            },
            "final": final.__dict__,
            "agents": agents_raw,
        }

    return {
        "_router_version": "MAS_MEDIA_v7_fallback_models_and_degrade503",
        "final": final.__dict__,
        "agents": agents_raw,
    }
