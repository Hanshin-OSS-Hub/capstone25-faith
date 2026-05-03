import json
import os
import re
import datetime
import requests
from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai/groq", tags=["ai-groq"])

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


# =========================================================
# Input schema 
# =========================================================
class GroqTextIn(BaseModel):
    text: str = Field(..., min_length=1)

    # (선택) 추후 member profile 붙이면 U 보정 가능
    is_logged_in: bool = False
    age: Optional[int] = None
    gender: str = "other"


# =========================================================
# Groq에게 요구할 "표준 agent_output 스키마"
# =========================================================
TEXT_AGENT_PROMPT = """\
'허위정보/유해 콘텐츠 리스크 검증 에이전트'
아래 텍스트를 검증하고, 반드시 유효한 JSON만 출력 (추가 설명/마크다운/코드블록 금지)

점수는 모두 0.0~1.0 실수

[정의]
- text_risk: 선동/혐오/폭력/조작 위험 (문맥 기반 위험)
- fact_risk: 사실 여부 위험 (거짓 가능성/근거 부족/검증 불가)
- synthetic_risk: AI 생성 텍스트 가능성

[중요 규칙 - fact_risk]
- 아래 텍스트가 "검증 가능한 사실 주장"이 아니면 fact_risk는 반드시 낮게(0.0~0.2) 설정
    예) 감정표현/의견/농담/인사/짧은 캡션/의미 없는 테스트 문구/맥락 없는 단문
- 사실 주장(날짜/수치/인물/사건/원인-결과 등)이 명확할 때만 fact_risk를 올려라.
- "근거 부족/확인 불가" 문장은 사실 주장이 있을 때만 사용한다.

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


# =========================================================
# RiskScoring Engine
# =========================================================
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
    # 내부 엔진용(영문). 최종 리턴은 한국어로 매핑.
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
    """
    백엔드/DB/프론트 안정화를 위해 최종 risk_category는 한국어 표준으로 반환.
    """
    flags = normalize_flags(agent_out.get("flags"))
    fact_label = str(agent_out.get("fact_check_label", "UNCERTAIN")).upper()
    fact_risk = clamp01(agent_out.get("fact_risk", 0.0))

    # 허위정보 강한 신호
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

    # medical/political/other는 프로젝트 정책에 따라 보통 허위정보/정상으로 귀결
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


def run_engine(agent_out: Dict[str, Any], payload: GroqTextIn) -> EngineResult:
    text_risk = clamp01(agent_out.get("text_risk", 0.0))
    fact_risk = clamp01(agent_out.get("fact_risk", 0.0))
    syn_risk = clamp01(agent_out.get("synthetic_risk", 0.0))
    fact_label = str(agent_out.get("fact_check_label", "UNCERTAIN")).upper()

    flags = normalize_flags(agent_out.get("flags"))

    # FALSE면 fact_risk 최소 0.8로 보정
    fact_risk_adj = max(fact_risk, 0.8) if fact_label == "FALSE" else fact_risk
    effective_fact = max(fact_risk_adj, syn_risk)

    base = clamp01(WEIGHTS["text_risk"] * text_risk + WEIGHTS["effective_fact"] * effective_fact)

    U = compute_user_coeff(payload.is_logged_in, payload.age, payload.gender, flags)
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


# =========================================================
# JSON parsing utils
# =========================================================
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


# =========================================================
# API endpoints
# =========================================================
@router.get("/health")
def health():
    return {"has_key": bool(os.getenv("GROQ_API_KEY")), "model": MODEL}


@router.post("/text")
def groq_classify(payload: GroqTextIn):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    # dict/객체 모두를 GroqTextIn으로 통일
    payload_obj = GroqTextIn(**payload) if isinstance(payload, dict) else payload
    text = payload_obj.text

    prompt = TEXT_AGENT_PROMPT.format(
        text=text,
        current_date=datetime.datetime.now().strftime("%Y-%m-%d"),
    )

    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "너는 JSON만 출력한다. JSON 외 텍스트 금지."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "max_tokens": 900,
    }

    try:
        r = requests.post(
            GROQ_CHAT_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
            timeout=35,
        )
        r.raise_for_status()

        content = r.json()["choices"][0]["message"]["content"]

        try:
            raw_data = json.loads(_strip_code_fence(content))
        except json.JSONDecodeError:
            extracted = extract_json_block(content)
            if not extracted:
                raise HTTPException(status_code=502, detail={"msg": "Groq output not JSON", "raw": (content or "")[:500]})
            raw_data = json.loads(extracted)

        agent_out = normalize_agent_output(raw_data)

        eng = run_engine(agent_out, payload_obj)
        category_ko = category_ko_from_agent(agent_out, eng.risk_category_en, eng.final_score)

        return {
            "risk_category": category_ko,
            "risk_score": float(eng.final_score),
            "risk_reason": agent_out.get("notes", ""),
            "agent": "GROQ_ENGINE",
            "details": {
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

    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq engine error: {e}")
