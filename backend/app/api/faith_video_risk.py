import asyncio
import ipaddress
import os
import shutil
import socket
import tempfile
from dataclasses import asdict
from typing import Any
from urllib.parse import urlparse

import cv2
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.api.ai_gemini_engine import gemini_engine_analyze_with_image
from app.api.ai_groq import GroqTextIn, groq_classify
from app.api.ai_hugging import hugging_agent
from app.api.ai_router import (
    _agentresult_from_gemini,
    _agentresult_from_groq,
    _agentresult_from_hf,
)
from app.risk_engine.engine import ensemble
from app.risk_engine.schemas import AgentResult

router = APIRouter(prefix="/api/ai/video", tags=["ai-video"])

MAX_DIRECT_BYTES = 200 * 1024 * 1024


def _level_from_score(score: int) -> str:
    if score >= 67:
        return "CRITICAL"
    if score >= 50:
        return "HIGH"
    if score >= 34:
        return "MEDIUM"
    return "LOW"


def _extract_frames(video_path: str, max_frames: int = 3) -> list[bytes]:
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise RuntimeError("영상 파일을 열 수 없습니다.")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    if total_frames <= 0:
        cap.release()
        raise RuntimeError("영상 프레임을 읽을 수 없습니다.")

    step = max(total_frames // max_frames, 1)
    frames: list[bytes] = []

    idx = 0
    while len(frames) < max_frames:
        frame_no = idx * step
        if frame_no >= total_frames:
            break

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        ok, frame = cap.read()

        if ok:
            success, buffer = cv2.imencode(".jpg", frame)
            if success:
                frames.append(buffer.tobytes())

        idx += 1

    cap.release()
    return frames


def _is_youtube_url(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower().rstrip(".")
    except Exception:
        return False
    return host == "youtu.be" or host.endswith(".youtube.com") or host.endswith(".youtube-nocookie.com")


def _ip_blocked(ip: ipaddress._BaseAddress) -> bool:
    if ip.is_private or ip.is_loopback or ip.is_link_local:
        return True
    if ip.is_multicast or ip.is_reserved:
        return True
    if not ip.is_global:
        return True
    return False


def _assert_direct_https_url_safe(url: str) -> None:
    p = urlparse(url.strip())
    if p.scheme != "https":
        raise HTTPException(status_code=400, detail="직링크는 https:// 만 지원합니다.")
    host = p.hostname
    if not host:
        raise HTTPException(status_code=400, detail="URL이 올바르지 않습니다.")
    hl = host.lower()
    if hl == "localhost" or hl.endswith(".local"):
        raise HTTPException(status_code=400, detail="허용되지 않는 호스트입니다.")

    try:
        ip = ipaddress.ip_address(host)
        if _ip_blocked(ip):
            raise HTTPException(status_code=400, detail="허용되지 않는 주소입니다.")
        return
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        raise HTTPException(status_code=400, detail="호스트를 확인할 수 없습니다.")

    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if _ip_blocked(ip):
            raise HTTPException(status_code=400, detail="URL이 사설/내부 네트워크로 해석됩니다.")


def _youtube_download(url: str) -> tuple[str, str]:
    from yt_dlp import YoutubeDL

    work = tempfile.mkdtemp(prefix="ytv_")
    out_tmpl = os.path.join(work, "vid.%(ext)s")
    opts: dict[str, Any] = {
        "format": "best[ext=mp4]/best[height<=720]/best",
        "outtmpl": out_tmpl,
        "quiet": True,
        "no_warnings": True,
        "max_filesize": 400 * 1024 * 1024,
        "noplaylist": True,
    }
    try:
        with YoutubeDL(opts) as ydl:
            ydl.download([url])
        names = [n for n in os.listdir(work) if n.startswith("vid.")]
        if not names:
            raise RuntimeError("유튜브에서 영상 파일을 가져오지 못했습니다.")
        return os.path.join(work, names[0]), work
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise


async def _download_https_video_file(url: str) -> str:
    _assert_direct_https_url_safe(url)
    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    total = 0
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
            follow_redirects=True,
        ) as client:
            async with client.stream("GET", url) as resp:
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=400,
                        detail=f"영상 다운로드 실패 (HTTP {resp.status_code})",
                    )
                with open(path, "wb") as f:
                    async for chunk in resp.aiter_bytes(1024 * 512):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > MAX_DIRECT_BYTES:
                            raise HTTPException(
                                status_code=400,
                                detail=f"파일이 너무 큽니다 (최대 {MAX_DIRECT_BYTES // (1024 * 1024)}MB).",
                            )
                        f.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="다운로드된 데이터가 없습니다.")
        return path
    except HTTPException:
        try:
            os.remove(path)
        except OSError:
            pass
        raise
    except Exception as e:
        try:
            os.remove(path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"다운로드 오류: {e}") from e


def _is_gemini_quota_exhausted(exc: BaseException) -> bool:
    """429 / RESOURCE_EXHAUSTED 등 Gemini 할당량 초과 시 True (해당 프레임만 스킵)."""
    msg = str(exc)
    return "RESOURCE_EXHAUSTED" in msg or "429" in msg


def _gemini_frames_sync(
    video_path: str,
    text: str | None,
    age: int | None,
    gender: str,
    is_logged_in: bool,
) -> tuple[list[dict[str, Any]], int, int, str, list[str]]:
    """프레임 추출 + Gemini. (frame_results, max_score, avg_score, final_category, reasons)."""
    frames = _extract_frames(video_path)
    if not frames:
        raise HTTPException(status_code=400, detail="No frames extracted")

    frame_results: list[dict[str, Any]] = []
    for i, frame_bytes in enumerate(frames):
        try:
            result = gemini_engine_analyze_with_image(
                text=text or "",
                image_bytes=frame_bytes,
                mime_type="image/jpeg",
                is_logged_in=is_logged_in,
                age=age,
                gender=gender,
            )
            frame_results.append({"frame_index": i, "result": result})
        except Exception as e:
            kind = (
                "gemini_rate_limit"
                if _is_gemini_quota_exhausted(e)
                else "gemini_error"
            )
            frame_results.append(
                {
                    "frame_index": i,
                    "error": str(e),
                    "error_kind": kind,
                }
            )
            continue

    ok_rows = [r for r in frame_results if "result" in r]
    if not ok_rows:
        return (
            frame_results,
            0,
            0,
            "정상",
            [
                "Gemini 프레임 분석이 모두 실패했습니다. "
                "텍스트 기반 에이전트 결과를 참고하세요."
            ],
        )

    scores = [int(r["result"].get("risk_score", 0) or 0) for r in ok_rows]
    max_score = max(scores)
    avg_score = round(sum(scores) / len(scores))
    categories: list[str] = []
    reasons: list[str] = []
    for r in ok_rows:
        result = r["result"]
        cats = result.get("categories") or []
        rs = result.get("reasons") or []
        if cats:
            categories.append(cats[0])
        if rs:
            reasons.append(rs[0])
    final_category = max(set(categories), key=categories.count) if categories else "정상"
    return frame_results, max_score, avg_score, final_category, reasons


async def _analyze_video_full_async(
    video_path: str,
    user_text: str | None,
    age: int | None,
    gender: str,
    is_logged_in: bool,
) -> dict[str, Any]:
    """
    1) tempfile 영상 (호출측에서 보관)
    2) 프레임 + Gemini
    3) 사용자 텍스트로 Groq / HF (텍스트 없으면 스킵)
    4) ensemble → MAS 형태 final + agents
    """
    ut = (user_text or "").strip()

    frame_results, max_score, avg_score, final_category, reasons = await asyncio.to_thread(
        _gemini_frames_sync,
        video_path,
        ut or None,
        age,
        gender,
        is_logged_in,
    )

    combined = ut[:32000]

    gemini_raw: dict[str, Any] = {
        "risk_score": int(max_score),
        "risk_level": _level_from_score(int(max_score)),
        "categories": [final_category],
        "reasons": reasons[:5] if reasons else ["프레임 기반 Gemini 분석"],
    }

    agents: dict[str, AgentResult] = {"gemini": _agentresult_from_gemini(gemini_raw)}
    agents_raw: dict[str, Any] = {"gemini": gemini_raw}

    if len(combined) >= 1:
        g_in = GroqTextIn(
            text=combined,
            is_logged_in=is_logged_in,
            age=age,
            gender=gender,
        )
        try:
            groq_out = await asyncio.to_thread(groq_classify, g_in)
            agents["groq"] = _agentresult_from_groq(groq_out)
            agents_raw["groq"] = groq_out
        except Exception as e:
            agents_raw["groq"] = {"error": str(e)}
        try:
            hf_out = await hugging_agent(combined)
            agents["hf"] = _agentresult_from_hf(hf_out)
            agents_raw["hf"] = hf_out
        except Exception as e:
            agents_raw["hf"] = {"error": str(e)}
    else:
        agents_raw["groq"] = {"skipped": True, "reason": "no_user_text"}
        agents_raw["hf"] = {"skipped": True, "reason": "no_user_text"}

    usable = {k: v for k, v in agents.items() if v is not None}
    if not usable:
        raise HTTPException(status_code=500, detail="No usable agents after video pipeline")
    final = ensemble(usable)

    legacy_final = {
        "risk_score": final.risk_score,
        "risk_level": final.risk_level,
        "risk_category": final.risk_category,
        "avg_frame_score": avg_score,
        "max_frame_score": max_score,
    }

    return {
        "_router_version": "VIDEO_MAS_ENSEMBLE_v1",
        "final": asdict(final),
        "final_video": legacy_final,
        "agents": agents_raw,
        "frames": frame_results,
        "summary": {
            "analyzed_frame_count": len(frame_results),
            "reason_summary": reasons[:5],
            "avg_frame_score": avg_score,
            "max_frame_score": max_score,
        },
    }


def _analyze_video_path(
    video_path: str,
    text: str | None,
    age: int | None,
    gender: str,
    is_logged_in: bool,
) -> dict[str, Any]:
    """동기 호출부(ai_router to_thread 등) 호환: Groq·HF 없이 프레임+Gemini만."""
    frame_results, max_score, avg_score, final_category, reasons = _gemini_frames_sync(
        video_path, text, age, gender, is_logged_in
    )
    return {
        "_router_version": "VIDEO_FRAME_ANALYSIS_v1",
        "final": {
            "risk_score": max_score,
            "risk_level": _level_from_score(max_score),
            "risk_category": final_category,
            "avg_frame_score": avg_score,
            "max_frame_score": max_score,
        },
        "frames": frame_results,
        "summary": {
            "analyzed_frame_count": len(frame_results),
            "reason_summary": reasons[:5],
        },
    }


@router.post("/media")
async def analyze_video(
    video: UploadFile | None = File(default=None),
    video_url: str | None = Form(default=None),
    text: str | None = Form(default=""),
    age: int | None = Form(default=None),
    gender: str = Form(default="other"),
    is_logged_in: bool = Form(default=False),
):
    url_clean = (video_url or "").strip()
    has_url = bool(url_clean)
    has_file = video is not None

    if has_url and has_file:
        raise HTTPException(
            status_code=400,
            detail="영상 파일과 video_url 중 하나만 보내주세요.",
        )
    if not has_url and not has_file:
        raise HTTPException(
            status_code=400,
            detail="영상 파일(video) 또는 video_url(https)을 제공해주세요.",
        )

    video_path: str | None = None
    cleanup_files: list[str] = []
    cleanup_dirs: list[str] = []

    try:
        if has_url:
            if not url_clean.startswith("https://"):
                raise HTTPException(
                    status_code=400,
                    detail="https:// 로 시작하는 URL만 지원합니다.",
                )
            if _is_youtube_url(url_clean):
                try:
                    video_path, work_dir = await asyncio.to_thread(_youtube_download, url_clean)
                    cleanup_dirs.append(work_dir)
                except HTTPException:
                    raise
                except Exception as e:
                    raise HTTPException(
                        status_code=502,
                        detail=f"유튜브 다운로드에 실패했습니다: {e}",
                    ) from e
            else:
                video_path = await _download_https_video_file(url_clean)
                cleanup_files.append(video_path)
        else:
            assert video is not None
            content_type = (video.content_type or "").lower()
            if not content_type.startswith("video/"):
                raise HTTPException(status_code=400, detail="Video file is required (video/*)")

            suffix = os.path.splitext(video.filename or "")[-1] or ".mp4"
            fd, video_path = tempfile.mkstemp(suffix=suffix)
            cleanup_files.append(video_path)
            try:
                with os.fdopen(fd, "wb") as f:
                    body = await video.read()
                    if not body:
                        raise HTTPException(status_code=400, detail="Empty video file")
                    f.write(body)
            except Exception:
                try:
                    os.remove(video_path)
                except OSError:
                    pass
                cleanup_files.remove(video_path)
                raise

        assert video_path is not None
        return await _analyze_video_full_async(
            video_path,
            text or "",
            age,
            gender,
            is_logged_in,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"video analysis error: {e}") from e

    finally:
        for p in cleanup_files:
            try:
                os.remove(p)
            except OSError:
                pass
        for d in cleanup_dirs:
            shutil.rmtree(d, ignore_errors=True)
