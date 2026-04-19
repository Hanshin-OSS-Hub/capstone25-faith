import os
import json
import re
import datetime
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai/hf", tags=["hf-text"])

HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
HF_BASE_URL = os.getenv("HF_BASE_URL", "https://router.huggingface.co/v1").strip()

# 엔진형(HF chat-completions). 설정 없으면 zero-shot fallback
HF_CHAT_MODEL = os.getenv("HF_CHAT_MODEL", "").strip()

# zero-shot 분류 모델(fallback)
HF_ZERO_SHOT_MODEL = os.getenv("HF_MODEL", "facebook/bart-large-mnli").strip()
ZS_LABELS = ["허위정보", "딥페이크", "성적 콘텐츠", "금융 사기", "혐오/폭력", "정상"]


class HFTextIn(BaseModel):
    text: str = Field(..., min_length=1)
    is_logged_in: bool = False
    age: Optional[int] = None
    gender: str = "other"


TEXT_AGENT_PROMPT = """\
'허위정보/유해 콘텐츠 리스크 검증 에이전트'
아래 텍스트를 검증하고, 반드시 유효한 JSON만 출력 (추가 설명/마크다운/코드블록 금지)

점수는 모두 0.0~1.0 실수

[정의]
- text_risk: 선동/혐오/폭력/조작 위험 (문맥 기반 위험)
- fact_risk: 사실 여부 위험 (거짓 가능성/근거 부족/검증 불가)
- synthetic_risk: AI 생성 텍스트 가능성

[라벨]
- fact_check_label: "TRUE" | "FALSE" | "UNCERTAIN"

[위험 플래그] 해당되면 true
- political / violence / hate / sexual
- medical / finance / phishing / deepfake / impersonation

[출력 규칙]
- notes는 반드시 한국어 한 문장(짧게)
- JSON 외 다른 텍스트 출력 금지

[기준 날짜]
{current_date}

[출력 JSON 스키마]
{{
  "text_risk": 0.0,
  "fact_risk": 0.0,
  "synthetic_risk": 0.0,
  "fact_check_label": "UNCERTAIN",
  "flags": {{
    "political": false,
    "violence": false,
    "hate": false,
    "sexual": false,
    "medical": false,
    "finance": false,
    "phishing": false,
    "deepfake": false,
    "impersonation": false
  }},
  "notes": "한국어 근거"
}}

[입력 텍스트]
<<<{text}>>>
"""


WEIGHTS = {"text_risk": 0.45, "effective_fact": 0.55}
RESPONSE_POLICY = {
    "Low": "추가 조치 없이 모니터링",
    "Moderate": "경고 및 관리 필요, 모니터링 진행",
    "High": "전문가 검토, 확산 억제(공유 경고) 고려",
    "Critical": "즉각적 차단/신고 유도, 법적·사회적 대응 안내",
}


def clamp01(x: float) -> float:
    try:
        v = float(x)
    except Exception:
        v = 0.0
    return max(0.0, min(1.0, v))


def normalize_flags(flags: Any) -> Dict[str, bool]:
    keys = [
        "political",
        "violence",
        "hate",
        "sexual",
        "medical",
        "finance",
        "phishing",
        "deepfake",
        "impersonation",
    ]
    src = flags if isinstance(flags, dict) else {}
    return {k: bool(src.get(k, False)) for k in keys}


def classify_category_en(flags: Dict[str, Any]) -> str:
    if flags.get("sexual"):
        return "sexual"
    if flags.get("deepfake") or flags.get("impersonation"):
        return "deepfake"
    if flags.get("phishing") or flags.get("finance"):
        return "finance"
    if flags.get("hate") or flags.get("violence"):
        return "violence"
    if flags.get("medical"):
        return "medical"
    if flags.get("political"):
        return "political"
    return "other"


def level_from_score(s: float) -> str:
    if s >= 1.0:
        return "Critical"
    if s >= 0.7:
        return "High"
    if s >= 0.4:
        return "Moderate"
    return "Low"


def compute_user_coeff(is_logged_in: bool, age: Optional[int], gender: str, flags: Dict[str, Any]) -> float:
    if not is_logged_in:
        return 1.0

    U = 1.0
    gender = (gender or "other").lower()

    violence = bool(flags.get("violence", False))
    hate = bool(flags.get("hate", False))

    medical = bool(flags.get("medical", False))
    finance = bool(flags.get("finance", False))
    phishing = bool(flags.get("phishing", False))

    sexual = bool(flags.get("sexual", False))
    deepfake = bool(flags.get("deepfake", False))
    impersonation = bool(flags.get("impersonation", False))

    if age is not None:
        if age < 20 and (violence or hate):
            U += 0.3
        if age > 65 and (medical or finance or phishing):
            U += 0.3

    if gender == "woman" and (sexual or deepfake or impersonation):
        U += 0.3

    return round(min(U, 1.6), 2)


def category_ko_from_agent(agent_out: Dict[str, Any], eng_category_en: str, final_score: float) -> str:
    flags = normalize_flags(agent_out.get("flags"))
    fact_label = str(agent_out.get("fact_check_label", "UNCERTAIN")).upper()
    fact_risk = clamp01(agent_out.get("fact_risk", 0.0))

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

    if eng_category_en in ("medical", "political") and final_score >= 0.34:
        return "허위정보"

    return "정상" if final_score < 0.34 else "허위정보"


@dataclass
class EngineResult:
    base_score: float
    effective_fact: float
    user_coeff: float
    final_score: float
    final_percent: float
    risk_level: str
    risk_category_en: str
    action: str
    engine_notes: str


def run_engine(agent_out: Dict[str, Any], is_logged_in: bool, age: Optional[int], gender: str) -> EngineResult:
    text_risk = clamp01(agent_out.get("text_risk", 0.0))
    fact_risk = clamp01(agent_out.get("fact_risk", 0.0))
    syn_risk = clamp01(agent_out.get("synthetic_risk", 0.0))
    fact_label = str(agent_out.get("fact_check_label", "UNCERTAIN")).upper()

    flags = normalize_flags(agent_out.get("flags"))

    fact_risk_adj = max(fact_risk, 0.8) if fact_label == "FALSE" else fact_risk
    effective_fact = max(fact_risk_adj, syn_risk)

    base = clamp01(WEIGHTS["text_risk"] * text_risk + WEIGHTS["effective_fact"] * effective_fact)

    U = compute_user_coeff(is_logged_in, age, gender, flags)
    final = clamp01(base * U)

    level = level_from_score(final)
    category_en = classify_category_en(flags)

    notes = f"fact_adj={fact_risk_adj:.2f}, effective={effective_fact:.2f}, base={base:.4f}, U={U:.2f}"
    return EngineResult(
        base_score=base,
        effective_fact=effective_fact,
        user_coeff=U,
        final_score=final,
        final_percent=round(final * 100.0, 1),
        risk_level=level,
        risk_category_en=category_en,
        action=RESPONSE_POLICY[level],
        engine_notes=notes,
    )


def _strip_code_fence(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s).strip()
    return s


def extract_json_block(text: str) -> str:
    text = _strip_code_fence(text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return ""
    return text[start : end + 1]


def normalize_agent_output(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {
        "text_risk": 0.0,
        "fact_risk": 0.0,
        "synthetic_risk": 0.0,
        "fact_check_label": "UNCERTAIN",
        "flags": normalize_flags({}),
        "notes": "",
    }
    if isinstance(d, dict):
        for k in list(out.keys()):
            if k in d:
                out[k] = d[k]
    out["flags"] = normalize_flags(out.get("flags"))
    out["text_risk"] = clamp01(out.get("text_risk", 0.0))
    out["fact_risk"] = clamp01(out.get("fact_risk", 0.0))
    out["synthetic_risk"] = clamp01(out.get("synthetic_risk", 0.0))
    out["fact_check_label"] = str(out.get("fact_check_label", "UNCERTAIN")).upper()
    out["notes"] = str(out.get("notes", "") or "")
    return out


def _hf_headers_json() -> Dict[str, str]:
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN missing. Set HF_TOKEN in env.")
    return {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}


@router.get("/health")
def health():
    return {
        "has_token": bool(HF_TOKEN),
        "chat_engine_enabled": bool(HF_CHAT_MODEL),
        "hf_chat_model": HF_CHAT_MODEL or None,
        "hf_zero_shot_model": HF_ZERO_SHOT_MODEL,
    }


async def hugging_agent(text: str) -> dict:
    """
    verify.py / ai_router.py가 await hugging_agent(clean_text)로 호출.
    반환 키:
      - risk_category(한국어), risk_score(0~1), risk_reason, agent
      - details
    """
    if not HF_TOKEN:
        # 401 애매하게 터지지 않게 명확히
        raise RuntimeError("HF_TOKEN missing. Set HF_TOKEN in env.")

    # =========================
    # Mode A) HF chat-completions → faith 스키마 → 엔진 점수
    # =========================
    if HF_CHAT_MODEL:
        prompt = TEXT_AGENT_PROMPT.format(
            text=(text or "").strip(),
            current_date=datetime.datetime.now().strftime("%Y-%m-%d"),
        )

        url = f"{HF_BASE_URL}/chat/completions"
        payload = {
            "model": HF_CHAT_MODEL,
            "messages": [
                {"role": "system", "content": "너는 JSON만 출력한다. JSON 외 텍스트 금지."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 900,
        }

        async with httpx.AsyncClient(timeout=80) as client:
            res = await client.post(url, headers=_hf_headers_json(), json=payload)
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]

        try:
            raw_data = json.loads(_strip_code_fence(content))
        except json.JSONDecodeError:
            extracted = extract_json_block(content)
            if not extracted:
                raise RuntimeError(f"HF chat output not JSON: {content[:500]}")
            raw_data = json.loads(extracted)

        agent_out = normalize_agent_output(raw_data)

        # verify.py 흐름은 HF에 유저정보를 안 넘기므로 기본값 1.0
        eng = run_engine(agent_out, is_logged_in=False, age=None, gender="other")
        category_ko = category_ko_from_agent(agent_out, eng.risk_category_en, eng.final_score)

        return {
            "risk_category": category_ko,
            "risk_score": float(eng.final_score),
            "risk_reason": agent_out.get("notes", ""),
            "agent": "HF_ENGINE",
            "details": {
                "mode": "chat_engine",
                "model": HF_CHAT_MODEL,
                "agent_output": agent_out,
                "engine_result": {
                    "base_score": eng.base_score,
                    "effective_fact": eng.effective_fact,
                    "user_coeff": eng.user_coeff,
                    "final_score": eng.final_score,
                    "final_percent": eng.final_percent,
                    "risk_level": eng.risk_level,
                    "risk_category_en": eng.risk_category_en,
                    "risk_category_ko": category_ko,
                    "action": eng.action,
                    "engine_notes": eng.engine_notes,
                },
            },
        }

    # =========================
    # Mode B) zero-shot fallback (엔진형 신호 없음)
    # =========================
    url = f"https://router.huggingface.co/hf-inference/models/{HF_ZERO_SHOT_MODEL}"
    zs_payload = {
        "inputs": (text or "").strip(),
        "parameters": {"candidate_labels": ZS_LABELS},
        "options": {"wait_for_model": True},
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, headers={"Authorization": f"Bearer {HF_TOKEN}"}, json=zs_payload)
        res.raise_for_status()
        raw = res.json()

    # 다양한 포맷 대응
    if isinstance(raw, dict) and isinstance(raw.get("labels"), list) and isinstance(raw.get("scores"), list):
        top_label = str(raw["labels"][0])
        top_score = clamp01(raw["scores"][0])
    elif isinstance(raw, list) and raw and isinstance(raw[0], dict) and "labels" in raw[0] and "scores" in raw[0]:
        top_label = str(raw[0]["labels"][0])
        top_score = clamp01(raw[0]["scores"][0])
    elif isinstance(raw, list) and raw and isinstance(raw[0], dict) and "label" in raw[0] and "score" in raw[0]:
        raw_sorted = sorted(raw, key=lambda x: float(x.get("score", 0.0)), reverse=True)
        top_label = str(raw_sorted[0].get("label", "정상"))
        top_score = clamp01(raw_sorted[0].get("score", 0.0))
    else:
        raise RuntimeError(f"Unexpected HF zero-shot response format: {raw}")

    return {
        "risk_category": top_label,
        "risk_score": float(top_score),
        "risk_reason": "HF zero-shot classification top label",
        "agent": "HF_ZEROSHOT",
        "details": {"mode": "zero_shot", "model": HF_ZERO_SHOT_MODEL, "raw": raw},
    }


@router.post("/text")
async def classify_text(payload: HFTextIn):
    try:
        # (직접 호출 시) 향후 userinfo를 반영하려면 여기서 hugging_agent 확장하면 됨.
        return await hugging_agent(payload.text)
    except httpx.HTTPStatusError as e:
        body = None
        try:
            body = e.response.json()
        except Exception:
            body = (e.response.text or "")[:500]
        raise HTTPException(status_code=e.response.status_code, detail={"msg": "HF API error", "body": body})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HF error: {e}")
