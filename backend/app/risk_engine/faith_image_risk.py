from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any, Dict, Optional

from PIL import Image
from google.genai import types

from .faith_text_risk import (
    UserContext,
    EngineResult,
    clamp01,
    normalize_flags,
    classify_category,
    level_from_score,
    compute_user_coeff,
    get_client,
    extract_json,
    get_model_candidates,
    _is_retryable_client_error,
)

try:
    from google import genai
    from google.genai import errors
except ImportError as e:
    raise SystemExit("google-genai not installed.")

FIXED_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# =========================
# Prompt (Image)
#  - flags 확장: medical/finance/phishing/deepfake/impersonation
# =========================
IMAGE_PROMPT = """\
'이미지 기반 리스크 검증 에이전트'
반드시 유효한 JSON만 출력. 점수 0.0~1.0.

[항목]
- image_risk: 선동/혐오/폭력/성적/조작 위험 (이미지 문맥)
- synthetic_risk: AI 생성/합성 가능성

[플래그] 해당되면 true
- political / violence / hate / sexual
- medical (의료/건강 관련 조작/오정보 가능성)
- finance (금융/투자/사기/대출 등 오정보/사칭 가능성)
- phishing (피싱/링크유도/계정탈취/사기 가능성)
- deepfake (얼굴 합성/딥페이크/합성 인물)
- impersonation (공식기관/유명인/지인 사칭)

[출력 규칙]
- notes는 한국어 한 문장.
- JSON 외 텍스트 금지.

[출력 JSON 스키마]
{
    "image_risk": 0.0,
    "synthetic_risk": 0.0,
    "synthetic_label": "AI_GENERATED",
    "flags": {
        "political": false,
        "violence": false,
        "hate": false,
        "sexual": false,
        "medical": false,
        "finance": false,
        "phishing": false,
        "deepfake": false,
        "impersonation": false
    },
    "notes": "한국어 근거"
}
"""

# v2: 이미지 base 가중치 합 1.0
IMG_WEIGHTS = {
    "image_risk": 0.60,
    "synthetic_risk": 0.40,
}

def run_engine(agent_out: Dict[str, Any], user: UserContext) -> EngineResult:
    img_risk = clamp01(agent_out.get("image_risk", 0.0))
    syn_risk = clamp01(agent_out.get("synthetic_risk", 0.0))
    flags = normalize_flags(agent_out.get("flags"))

    base = clamp01(IMG_WEIGHTS["image_risk"] * img_risk + IMG_WEIGHTS["synthetic_risk"] * syn_risk)

    # v2: compute_user_coeff 내부에서 비로그인 U=1.0 고정
    U = compute_user_coeff(user, flags)
    final = clamp01(base * U)

    level = level_from_score(final)
    policy = {"Low": "모니터링", "Moderate": "주의", "High": "검토", "Critical": "차단"}

    return EngineResult(
        base_score=base,
        effective_fact=syn_risk,  # (이미지에서는 synthetic를 effective_fact 슬롯에 기록)
        user_coeff=U,
        final_score=final,
        final_percent=round(final * 100.0, 1),
        risk_level=level,
        risk_category=classify_category(flags),
        action=policy.get(level, "확인 필요"),
        engine_notes_ko=f"Base={base:.2f}, U={U:.2f} (Login:{user.is_logged_in})",
    )

@dataclass
class ImageRiskReport:
    agent_output: Dict[str, Any]
    engine_result: EngineResult

def normalize_image_output(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {
        "image_risk": 0.0,
        "synthetic_risk": 0.0,
        "synthetic_label": "UNCERTAIN",
        "flags": normalize_flags({}),
        "notes": "",
    }
    if isinstance(d, dict):
        for k in list(out.keys()):
            if k in d:
                out[k] = d[k]
    out["flags"] = normalize_flags(out.get("flags"))
    return out

def analyze_image(image_path: str, user: UserContext, client: Optional["genai.Client"] = None) -> ImageRiskReport:
    client = client or get_client()
    img = Image.open(image_path).convert("RGB")

    # 이미지 검증은 모델 과부하가 잦아 fallback 모델까지 순차 시도한다.
    last_error = None
    resp = None
    for model_name in get_model_candidates():
        try:
            resp = client.models.generate_content(model=model_name, contents=[IMAGE_PROMPT, img])
            break
        except errors.ClientError as e:
            last_error = e
            if _is_retryable_client_error(str(e)):
                continue
            raise

    if resp is None:
        if last_error:
            raise last_error
        raise RuntimeError("Gemini image analysis failed without a specific error.")

    agent_out = normalize_image_output(extract_json(resp.text))
    engine_res = run_engine(agent_out, user)
    return ImageRiskReport(agent_output=agent_out, engine_result=engine_res)
