import json
import os
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai/groq", tags=["ai-groq"])

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

ALLOWED_CATEGORIES = [
    "허위정보",
    "딥페이크",
    "성적 콘텐츠",
    "금융 사기",
    "혐오/폭력",
    "정상",
]



class GroqTextIn(BaseModel):
    text: str = Field(..., min_length=1)


def extract_json_block(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return ""
    return text[start:end+1]


@router.get("/health")
def health():
    return {
        "has_key": bool(os.getenv("GROQ_API_KEY")),
        "model": MODEL
    }


@router.post("")
def groq_classify(payload: GroqTextIn):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    system_prompt = """
You are a risk classification agent.

Classify the text into ONE of these categories only:
- 허위정보
- 딥페이크
- 성적 콘텐츠
- 금융 사기
- 혐오/폭력
- 정상

Return JSON ONLY:

{
    "risk_category": "<one of the categories above>",
    "risk_score": number between 0 and 1,
    "risk_reason": "short explanation in Korean"
}

No extra text. JSON only.
""".strip()


    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": payload.text},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    try:
        r = requests.post(
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
        r.raise_for_status()

        content = r.json()["choices"][0]["message"]["content"]

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            extracted = extract_json_block(content)
            if not extracted:
                raise HTTPException(
                    status_code=502,
                    detail={"msg": "Groq output not JSON", "raw": content[:500]},
                )
            data = json.loads(extracted)

        if not all(k in data for k in ("risk_category", "risk_score", "risk_reason")):
            raise HTTPException(
                status_code=502,
                detail={"msg": "Missing keys in Groq output", "raw": data},
            )

        category = data["risk_category"]

        if category not in ALLOWED_CATEGORIES:
            category = "정상"

        score = float(data["risk_score"])
        score = max(0.0, min(1.0, score))

        return {
            "risk_category": category,
            "risk_score": score,
            "risk_reason": data["risk_reason"],
            "agent": "GROQ"
        }

    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e}")
