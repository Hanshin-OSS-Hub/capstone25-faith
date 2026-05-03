import argparse
import json
import os
import re
import time
import datetime
from dataclasses import dataclass
from typing import Any, Dict, Optional
from google.genai import types

from PIL import Image

# ---- Gemini SDK (google-genai) ----
try:
    from google import genai
    from google.genai import errors
except ImportError as e:
    raise SystemExit("google-genai not installed. Run: pip install google-genai") from e


# =========================
# Prompts (Korean notes enforced)
# =========================

TEXT_PROMPT = """\
너는 '허위정보/유해 콘텐츠 리스크 분석 에이전트'야.
아래 텍스트를 분석하고, 반드시 **유효한 JSON만** 출력해. (추가 설명/마크다운 금지)

점수는 모두 0.0~1.0 실수 (소수 허용)로 출력해.

[정의]
- text_risk: 문맥 위험(선동/조작, 혐오, 폭력 조장, 피싱/사기 유도 등)
- fact_risk: 사실성 위험(거짓 가능성, 근거 부족, 검증 불가 등)
- synthetic_risk: 텍스트가 AI 생성/합성일 가능성 (스타일/일관성 신호 기반, 과신 금지)

[라벨]
- fact_check_label: "TRUE" | "FALSE" | "UNCERTAIN"
- fact_confidence: 0.0~1.0 (라벨에 대한 신뢰도)

[콘텐츠 유형 플래그]
- political: 정치 이슈/정치인/정책/선거/정당 관련이면 true
- violence: 폭력/잔혹/살상/폭력 선동 관련이면 true
- hate: 혐오/차별/비하/집단 공격이면 true
- sexual: 성적 묘사/노골적 성적 콘텐츠/음란물이면 true

[출력 규칙]
- notes는 반드시 **한국어**로 짧게(한 문장) 근거를 써.
- 확실하지 않으면 fact_check_label="UNCERTAIN"로 두고, notes에 "불확실"을 명시해.

[기준 날짜]
{{current_date}}

[출력 JSON 스키마]
{{
  "text_risk": 0.0,
  "image_risk": 0.0,
  "fact_risk": 0.0,
  "synthetic_risk": 0.0,

  "fact_check_label": "UNCERTAIN",
  "fact_confidence": 0.0,

  "synthetic_label": "UNCERTAIN",
  "synthetic_confidence": 0.0,

  "flags": {{
    "political": false,
    "violence": false,
    "hate": false,
    "sexual": false,

    "synthetic_detected": false,
    "ai_generated_image": false
  }},

  "notes": "한국어 근거"
}}

[입력 텍스트]
<<<{text}>>>
"""


IMAGE_PROMPT = """\
너는 '이미지 리스크 분석 에이전트'야.
입력 이미지를 분석하고, 반드시 **유효한 JSON만** 출력해. (추가 설명/마크다운 금지)

점수는 모두 0.0~1.0 실수 (소수 허용)로 출력해.

[정의]
- image_risk: 이미지 자체 위험(폭력/혐오/성적/사기유도/선동성 편집 등)
- fact_risk: 이미지의 조작/편집/왜곡 가능성(사실성 자체 판단이 아니라 '조작 위험'으로 한정)
- synthetic_risk: AI 생성/합성 이미지일 가능성 (확실치 않으면 0.4~0.6 근처)

[라벨]
- synthetic_label: "AI_GENERATED" | "REAL" | "UNCERTAIN"
- synthetic_confidence: 0.0~1.0 (라벨 신뢰도)

[콘텐츠 유형 플래그]
- political / violence / hate / sexual: 해당되면 true

[출력 규칙]
- notes는 반드시 **한국어**로 짧게(한 문장) 근거를 써.
- synthetic_detected는 synthetic_risk >= 0.8이면 true
- ai_generated_image는 synthetic_label == "AI_GENERATED"이면 true

[출력 JSON 스키마]
{{
  "text_risk": 0.0,
  "image_risk": 0.0,
  "fact_risk": 0.0,
  "synthetic_risk": 0.0,

  "fact_check_label": "UNCERTAIN",
  "fact_confidence": 0.0,

  "synthetic_label": "UNCERTAIN",
  "synthetic_confidence": 0.0,

  "flags": {{
    "political": false,
    "violence": false,
    "hate": false,
    "sexual": false,

    "synthetic_detected": false,
    "ai_generated_image": false
  }},

  "notes": "한국어 근거"
}}
"""


# =========================
# Risk engine
# =========================

WEIGHTS = {"text_risk": 0.3, "image_risk": 0.3, "fact_risk": 0.4}


@dataclass
class EngineResult:
    base_score: float
    user_coeff: float
    final_score: float
    final_percent: float
    level: str


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def level_from_score(s: float) -> str:
    if s >= 1.0:
        return "Critical"
    if s >= 0.7:
        return "High"
    if s >= 0.4:
        return "Moderate"
    return "Low"


def any_true(flags: Dict[str, Any], keys) -> bool:
    return any(bool(flags.get(k, False)) for k in keys)


def compute_user_coeff(age: Optional[int], gender: str, flags: Dict[str, Any]) -> float:
    """
    사용자 맞춤 U 규칙 (요구사항 반영)

    - 청소년(age<20): 정치/폭력/혐오 -> U=1.5
    - 중장년(age>55): 정치/폭력/혐오 -> U=1.5
    - 여성(gender="woman"): 성적(sexual) -> U=1.5
    """
    U = 1.0
    political_violence_hate = any_true(flags, ["political", "violence", "hate"])
    sexual = bool(flags.get("sexual", False))

    if age is not None and age < 20 and political_violence_hate:
        U = 1.5
    if age is not None and age > 55 and political_violence_hate:
        U = 1.5
    if (gender or "").lower() == "woman" and sexual:
        U = 1.5

    return U


def apply_fact_floor_if_false(fact_risk: float, fact_check_label: str) -> float:
    """
    '허위로 판정되면 fact_risk 최소 0.8' 하한 룰 적용
    """
    if (fact_check_label or "").upper() == "FALSE":
        return max(fact_risk, 0.8)
    return fact_risk


def run_engine(agent_out: Dict[str, Any], age: Optional[int], gender: str) -> EngineResult:
    text_risk = clamp01(float(agent_out.get("text_risk", 0.0) or 0.0))
    image_risk = clamp01(float(agent_out.get("image_risk", 0.0) or 0.0))
    fact_risk = clamp01(float(agent_out.get("fact_risk", 0.0) or 0.0))
    synthetic_risk = clamp01(float(agent_out.get("synthetic_risk", 0.0) or 0.0))

    fact_check_label = str(agent_out.get("fact_check_label", "UNCERTAIN") or "UNCERTAIN")
    flags = agent_out.get("flags") or {}

    # 1) 허위 판정이면 fact_risk 하한 적용
    fact_risk = apply_fact_floor_if_false(fact_risk, fact_check_label)

    # 2) 합성은 사실성/조작 리스크로 반영 (effective_fact)
    effective_fact = max(fact_risk, synthetic_risk)

    base = (
        WEIGHTS["text_risk"] * text_risk
        + WEIGHTS["image_risk"] * image_risk
        + WEIGHTS["fact_risk"] * effective_fact
    )

    # 3) 사용자 맞춤 U 적용
    U = compute_user_coeff(age=age, gender=gender, flags=flags)

    final = base * U
    final_percent = round(final * 100.0, 1)

    return EngineResult(
        base_score=base,
        user_coeff=U,
        final_score=final,
        final_percent=final_percent,
        level=level_from_score(final),
    )


# =========================
# JSON parsing
# =========================

def extract_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        pass

    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        raise ValueError(f"No JSON object found. Raw response:\n{text}")
    return json.loads(m.group(0))


def normalize_agent_output(d: Dict[str, Any], mode: str) -> Dict[str, Any]:
    """
    엔진이 안정적으로 쓰도록 기본값 채우기 + flags/라벨 파생값 정리
    """
    out = {
        "text_risk": 0.0,
        "image_risk": 0.0,
        "fact_risk": 0.0,
        "synthetic_risk": 0.0,

        "fact_check_label": "UNCERTAIN",
        "fact_confidence": 0.0,

        "synthetic_label": "UNCERTAIN",
        "synthetic_confidence": 0.0,

        "flags": {
            "political": False,
            "violence": False,
            "hate": False,
            "sexual": False,
            "synthetic_detected": False,
            "ai_generated_image": False,
        },

        "notes": "",
    }

    # Copy primitive fields if present
    for k in ["text_risk", "image_risk", "fact_risk", "synthetic_risk",
              "fact_check_label", "fact_confidence",
              "synthetic_label", "synthetic_confidence",
              "notes"]:
        if k in d:
            out[k] = d[k]

    # Flags merge
    if "flags" in d and isinstance(d["flags"], dict):
        for fk in out["flags"].keys():
            if fk in d["flags"]:
                out["flags"][fk] = bool(d["flags"].get(fk, False))

    # Mode enforcement
    if mode == "text":
        out["image_risk"] = 0.0
        # 이미지 라벨은 텍스트일 때 의미 약함 -> 기본 유지
        out["synthetic_label"] = out.get("synthetic_label") or "UNCERTAIN"
        out["synthetic_confidence"] = float(out.get("synthetic_confidence", 0.0) or 0.0)
    elif mode == "image":
        out["text_risk"] = 0.0
        # 이미지에서는 synthetic 라벨 중요
    else:
        raise ValueError("mode must be 'text' or 'image'")

    # Derive synthetic flags
    try:
        sr = clamp01(float(out.get("synthetic_risk", 0.0) or 0.0))
        out["synthetic_risk"] = sr
        out["flags"]["synthetic_detected"] = bool(out["flags"].get("synthetic_detected", False)) or (sr >= 0.8)
    except Exception:
        pass

    syn_label = str(out.get("synthetic_label", "UNCERTAIN") or "UNCERTAIN").upper()
    out["synthetic_label"] = syn_label
    out["flags"]["ai_generated_image"] = bool(out["flags"].get("ai_generated_image", False)) or (syn_label == "AI_GENERATED")

    # Clamp numeric fields
    for k in ["text_risk", "image_risk", "fact_risk", "synthetic_risk", "fact_confidence", "synthetic_confidence"]:
        try:
            out[k] = clamp01(float(out.get(k, 0.0) or 0.0))
        except Exception:
            out[k] = 0.0

    # Normalize label fields
    out["fact_check_label"] = str(out.get("fact_check_label", "UNCERTAIN") or "UNCERTAIN").upper()
    if out["fact_check_label"] not in ["TRUE", "FALSE", "UNCERTAIN"]:
        out["fact_check_label"] = "UNCERTAIN"

    if out["synthetic_label"] not in ["AI_GENERATED", "REAL", "UNCERTAIN"]:
        out["synthetic_label"] = "UNCERTAIN"

    return out


# =========================
# Gemini calling (retry)
# =========================

def get_client() -> "genai.Client":
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Missing GEMINI_API_KEY env var.")
    return genai.Client(api_key=api_key)


def call_gemini_with_retry(client, model: str, contents, retries: int = 3):
    # [수정 1] 구글 검색(Grounding) 도구 설정 생성
    # 이 설정이 있으면 모델이 필요할 때 자동으로 구글 검색을 수행합니다.
    google_search_tool = types.Tool(
        google_search=types.GoogleSearch()
    )
    search_config = types.GenerateContentConfig(
        tools=[google_search_tool],
        response_modalities=["TEXT"] # 텍스트 응답 명시 (선택사항)
    )

    attempt = 0
    while attempt < retries:
        try:
            # [수정 2] config 인자에 위에서 만든 search_config 전달
            return client.models.generate_content(
                model=model, 
                contents=contents,
                config=search_config 
            )
        except errors.ClientError as e:
            # 429: quota / rate limit
            code = getattr(e, "code", None)
            if code == 429:
                wait_time = 10
                print(f"[!] 429(사용량/쿼터). {wait_time}초 대기 후 재시도... ({attempt+1}/{retries})")
                time.sleep(wait_time)
                attempt += 1
                continue
            raise
    raise RuntimeError("최대 재시도 횟수를 초과했습니다.")


def gemini_analyze_text(client: "genai.Client", model: str, text: str) -> Dict[str, Any]:
    # 오늘 날짜 가져오기 (예: 2025-12-16)
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")

    prompt = TEXT_PROMPT.format(text=text, current_date=today_str)

    resp = call_gemini_with_retry(client, model, prompt)
    raw = resp.text or ""
    data = extract_json(raw)
    return normalize_agent_output(data, mode="text")


def gemini_analyze_image(client: "genai.Client", model: str, image_path: str) -> Dict[str, Any]:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    img = Image.open(image_path).convert("RGB")
    resp = call_gemini_with_retry(client, model, [IMAGE_PROMPT, img])
    raw = resp.text or ""
    data = extract_json(raw)
    return normalize_agent_output(data, mode="image")


# =========================
# Notes translation (optional)
# =========================

_KOREAN_RE = re.compile(r"[가-힣]")


def looks_korean(s: str) -> bool:
    s = s or ""
    return bool(_KOREAN_RE.search(s))


def translate_note_to_korean(client: "genai.Client", model: str, note: str) -> str:
    """
    notes가 영어로 들어왔을 때만(보험용) Gemini로 한국어 번역 시도.
    쿼터/에러 나면 원문 그대로 반환.
    """
    if not note or looks_korean(note):
        return note

    prompt = f"""\
다음 문장을 자연스러운 한국어로 번역해줘. 출력은 번역문 한 줄만.
문장:
{note}
"""
    try:
        resp = call_gemini_with_retry(client, model, prompt, retries=1)
        out = (resp.text or "").strip()
        return out if out else note
    except Exception:
        return note


# =========================
# Mock mode (for safe demos)
# =========================

def mock_agent_output(mode: str) -> Dict[str, Any]:
    if mode == "text":
        return {
            "text_risk": 0.25,
            "image_risk": 0.0,
            "fact_risk": 0.55,
            "synthetic_risk": 0.10,
            "fact_check_label": "UNCERTAIN",
            "fact_confidence": 0.4,
            "synthetic_label": "UNCERTAIN",
            "synthetic_confidence": 0.0,
            "flags": {
                "political": True,
                "violence": False,
                "hate": False,
                "sexual": False,
                "synthetic_detected": False,
                "ai_generated_image": False
            },
            "notes": "정치 관련 주장으로 보이며 사실 여부가 불확실함"
        }
    else:
        return {
            "text_risk": 0.0,
            "image_risk": 0.35,
            "fact_risk": 0.20,
            "synthetic_risk": 0.88,
            "fact_check_label": "UNCERTAIN",
            "fact_confidence": 0.0,
            "synthetic_label": "AI_GENERATED",
            "synthetic_confidence": 0.85,
            "flags": {
                "political": False,
                "violence": False,
                "hate": False,
                "sexual": False,
                "synthetic_detected": True,
                "ai_generated_image": True
            },
            "notes": "합성 이미지로 의심되는 시각적 패턴이 강함"
        }


# =========================
# CLI
# =========================

def main():
    p = argparse.ArgumentParser(description="Risk-Scoring Engine CLI Demo (Gemini + personalized coefficient U)")
    p.add_argument("--model", default="gemini-flash-latest", help="Gemini model name (e.g., gemini-flash-latest)")
    p.add_argument("--age", type=int, default=None, help="User age")
    p.add_argument("--gender", type=str, default="other", help='User gender: "woman" | "man" | "other"')
    p.add_argument("--mock", action="store_true", help="Run without Gemini API (use mock outputs)")
    p.add_argument("--translate_notes", action="store_true", help="Translate notes to Korean if needed (uses Gemini)")

    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--text", type=str, help="Text input")
    g.add_argument("--image", type=str, help="Local image path")

    args = p.parse_args()

    client = None
    if not args.mock:
        client = get_client()

    if args.text:
        mode = "TEXT"
        if args.mock:
            agent_out = normalize_agent_output(mock_agent_output("text"), mode="text")
        else:
            agent_out = gemini_analyze_text(client, args.model, args.text)
    else:
        mode = "IMAGE"
        if args.mock:
            agent_out = normalize_agent_output(mock_agent_output("image"), mode="image")
        else:
            agent_out = gemini_analyze_image(client, args.model, args.image)

    # notes Korean output (prompt already enforces Korean)
    note_out = agent_out.get("notes", "")
    if args.translate_notes and (not args.mock) and client is not None:
        note_out = translate_note_to_korean(client, args.model, note_out)

    # Engine run
    res = run_engine(agent_out, age=args.age, gender=args.gender)

    # Print
    print(f"\n=== INPUT MODE: {mode} ===")
    if args.age is not None:
        print(f"User Age: {args.age}")
    print(f"User Gender: {args.gender}")

    print("\n[Agent Output]")
    print(f" text_risk           : {agent_out['text_risk']}")
    print(f" image_risk          : {agent_out['image_risk']}")
    print(f" fact_risk           : {agent_out['fact_risk']}")
    print(f" synthetic_risk      : {agent_out['synthetic_risk']}")
    print(f" fact_check_label    : {agent_out.get('fact_check_label')}")
    print(f" fact_confidence     : {agent_out.get('fact_confidence')}")
    print(f" synthetic_label     : {agent_out.get('synthetic_label')}")
    print(f" synthetic_confidence: {agent_out.get('synthetic_confidence')}")
    print(f" flags               : {agent_out.get('flags')}")
    print(f" notes(한국어)        : {note_out}")

    # Show engine detail
    flags = agent_out.get("flags") or {}
    political_violence_hate = any_true(flags, ["political", "violence", "hate"])
    print("\n[Engine Calculation]")
    print(f" weights: text=0.3, image=0.3, fact=0.4")
    print(f" content: PVH={political_violence_hate}, sexual={bool(flags.get('sexual', False))}")
    print(f" base_score     : {res.base_score:.4f}")
    print(f" user_coeff (U) : {res.user_coeff:.2f}")
    print("\n[Final Result]")
    print(f" final_score    : {res.final_score:.4f}")
    print(f" final_percent  : {res.final_percent:.1f}%")
    print(f" risk_level     : {res.level}")
    print("\nDone.\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[Fatal Error] 프로그램 실행 중 오류:\n{e}")
