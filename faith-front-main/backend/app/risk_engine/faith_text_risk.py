from __future__ import annotations

import os, re, json, time, datetime
from dataclasses import dataclass
from typing import Any, Dict, Optional

from google.genai import types

try:
    from google import genai
    from google.genai import errors
except ImportError as e:
    raise SystemExit("google-genai not installed. Run: pip install -U google-genai pillow") from e

FIXED_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def get_model_candidates() -> list[str]:
    primary = (os.getenv("GEMINI_MODEL") or FIXED_MODEL or "").strip()
    fallback_env = (os.getenv("GEMINI_FALLBACK_MODELS") or "").strip()
    fallbacks = [m.strip() for m in fallback_env.split(",") if m.strip()]
    defaults = ["gemini-2.5-flash-lite", "gemini-2.0-flash"]

    ordered: list[str] = []
    for model_name in [primary, *fallbacks, *defaults]:
        if model_name and model_name not in ordered:
            ordered.append(model_name)
    return ordered

# =========================
# Data Models
# =========================
@dataclass
class UserContext:
    is_logged_in: bool = False
    age: Optional[int] = None
    gender: str = "other"

@dataclass
class EngineResult:
    base_score: float
    effective_fact: float
    user_coeff: float
    final_score: float
    final_percent: float
    risk_level: str
    risk_category: str
    action: str
    engine_notes_ko: str

# =========================
# Prompt (Text)
#  - flags 확장: medical/finance/phishing/deepfake/impersonation
# =========================
TEXT_PROMPT = """\
'허위정보/유해 콘텐츠 리스크 검증 에이전트'
아래 텍스트를 검증하고, 반드시 유효한 JSON만 출력 (추가 설명/마크다운 금지)

점수는 모두 0.0~1.0 실수로 출력

[정의]
- text_risk: 선동, 혐오, 폭력, 조작 위험 (문맥 위험)
- fact_risk: 사실 여부 위험 (거짓 가능성/근거 부족/검증 불가)
- synthetic_risk: AI 생성 텍스트 가능성

[라벨]
- fact_check_label: "TRUE" | "FALSE" | "UNCERTAIN"

[위험 플래그] 해당되면 true
- political / violence / hate / sexual
- medical (의료/건강 허위정보 가능성)
- finance (금융/투자/대출/보험 등 사기/오정보 가능성)
- phishing (피싱/사칭/링크 유도/계정 탈취 가능성)
- deepfake (딥페이크/합성 사칭 서술 가능성)
- impersonation (공식기관/유명인/지인 사칭 가능성)

[출력 규칙]
- notes는 반드시 **한국어 한 문장**으로 근거를 씀
- JSON 외 다른 텍스트를 출력하지 않음

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

# v2: base 가중치 합 1.0로 재조정
WEIGHTS = {
    "text_risk": 0.45,
    "effective_fact": 0.55,
}

RESPONSE_POLICY = {
    "Low": "추가 조치 없이 모니터링",
    "Moderate": "경고 및 관리 필요, 모니터링 진행",
    "High": "전문가 검토, 확산 억제(공유 경고) 고려",
    "Critical": "즉각적 차단/신고 유도, 법적·사회적 대응 안내",
}

# =========================
# Utilities
# =========================
def clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))

def any_true(flags: Dict[str, Any], keys) -> bool:
    return any(bool(flags.get(k, False)) for k in keys)

def classify_category(flags: Dict[str, Any]) -> str:
    # 우선순위 카테고리 (필요 시 정책에 맞게 조정 가능)
    if flags.get("sexual"): return "sexual"
    if flags.get("hate"): return "hate"
    if flags.get("violence"): return "violence"
    if flags.get("phishing"): return "phishing"
    if flags.get("finance"): return "finance"
    if flags.get("medical"): return "medical"
    if flags.get("deepfake"): return "deepfake"
    if flags.get("impersonation"): return "impersonation"
    if flags.get("political"): return "political"
    return "other"

def level_from_score(s: float) -> str:
    # 기존 레벨 기준 유지
    if s >= 1.0: return "Critical"
    if s >= 0.7: return "High"
    if s >= 0.4: return "Moderate"
    return "Low"

def normalize_flags(flags: Any) -> Dict[str, bool]:
    keys = [
        "political", "violence", "hate", "sexual",
        "medical", "finance", "phishing", "deepfake", "impersonation"
    ]
    src = flags if isinstance(flags, dict) else {}
    return {k: bool(src.get(k, False)) for k in keys}

def compute_user_coeff(user: UserContext, flags: Dict[str, Any]) -> float:
    """
    v2 보정 계수 (U) 산출 기준 (문서 방향 반영):

    - 비로그인: 개인정보 기반 개인화 미적용 → U=1.0 고정
    - 로그인 사용자에 한해, 취약군 + 특정 위험 조합에서만 보정
      * 청소년(<20) + (violence/hate) : +0.3
      * 고령(>65) + (medical/finance/phishing) : +0.3
      * 여성 + (sexual/deepfake/impersonation) : +0.3
    - U 상한: 1.6 (과도한 튐 방지)
    """
    # 핵심: 비로그인은 개인화 미적용
    if not user.is_logged_in:
        return 1.0

    U = 1.0
    age = user.age
    gender = (user.gender or "other").lower()

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

def run_engine(agent_out: Dict[str, Any], user: UserContext) -> EngineResult:
    text_risk = clamp01(agent_out.get("text_risk", 0.0))
    fact_risk = clamp01(agent_out.get("fact_risk", 0.0))
    syn_risk  = clamp01(agent_out.get("synthetic_risk", 0.0))
    fact_label = str(agent_out.get("fact_check_label", "UNCERTAIN")).upper()
    flags = normalize_flags(agent_out.get("flags"))

    # 허위(FALSE) 판정 시 최소 fact_risk 하한 보정
    fact_risk_adj = max(fact_risk, 0.8) if fact_label == "FALSE" else fact_risk
    effective_fact = max(fact_risk_adj, syn_risk)

    # v2: base 가중치 합 1.0
    base = clamp01(WEIGHTS["text_risk"] * text_risk + WEIGHTS["effective_fact"] * effective_fact)

    U = compute_user_coeff(user, flags)
    final = clamp01(base * U)
    final_percent = round(final * 100.0, 1)

    level = level_from_score(final)
    category = classify_category(flags)

    notes = (
        f"fact_adj={fact_risk_adj:.2f}, effective={effective_fact:.2f}, "
        f"base={base:.4f}, U={U:.2f} (Login:{user.is_logged_in})"
    )

    return EngineResult(
        base_score=base,
        effective_fact=effective_fact,
        user_coeff=U,
        final_score=final,
        final_percent=final_percent,
        risk_level=level,
        risk_category=category,
        action=RESPONSE_POLICY[level],
        engine_notes_ko=notes,
    )

# =========================
# Gemini Client
# =========================
def get_client() -> "genai.Client":
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Missing GEMINI_API_KEY.")
    return genai.Client(api_key=api_key)

def _is_retryable_client_error(msg: str) -> bool:
    return (
        "429" in msg or "RESOURCE_EXHAUSTED" in msg or
        "503" in msg or "UNAVAILABLE" in msg or
        "502" in msg or "504" in msg
    )


def call_gemini_with_retry(client, prompt: str, retries: int = 3):
    # tools 제거 (쿼터/레이트리밋 훨씬 안정적)
    cfg = types.GenerateContentConfig(response_modalities=["TEXT"])
    last_error = None

    for model_name in get_model_candidates():
        for attempt in range(retries):
            try:
                return client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=cfg,
                )
            except errors.ClientError as e:
                msg = str(e)
                last_error = e
                if _is_retryable_client_error(msg) and attempt < retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                if _is_retryable_client_error(msg):
                    break
                raise

    if last_error:
        raise last_error
    raise RuntimeError("Gemini request failed without a specific error.")


def extract_json(text: str) -> Dict[str, Any]:
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", (text or "").strip())
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, flags=re.DOTALL)
        if not m:
            raise ValueError("No JSON found.")
        return json.loads(m.group(0))

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
    return out

# =========================
# Public API
# =========================
@dataclass
class TextRiskReport:
    agent_output: Dict[str, Any]
    engine_result: EngineResult

def analyze_text(text: str, user: UserContext, client: Optional["genai.Client"] = None) -> TextRiskReport:
    client = client or get_client()
    prompt = TEXT_PROMPT.format(
        text=text,
        current_date=datetime.datetime.now().strftime("%Y-%m-%d"),
    )
    resp = call_gemini_with_retry(client, prompt)
    agent_out = normalize_agent_output(extract_json(resp.text))
    engine_res = run_engine(agent_out, user)
    return TextRiskReport(agent_output=agent_out, engine_result=engine_res)
