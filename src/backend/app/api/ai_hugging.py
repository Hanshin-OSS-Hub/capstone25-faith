import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai/hf", tags=["hf-text"])

HF_MODEL = os.getenv("HF_MODEL", "facebook/bart-large-mnli")

LABELS = ["허위정보", "딥페이크", "성적 콘텐츠", "금융 사기", "혐오/폭력", "정상"]


class HFTextIn(BaseModel):
    text: str = Field(..., min_length=1)


class HFHealth(BaseModel):
    has_key: bool
    token_prefix: str
    token_len: int
    model: str


@router.get("/health", response_model=HFHealth)
def health():
    t = os.getenv("HF_TOKEN") or ""
    model = os.getenv("HF_MODEL", HF_MODEL)
    return {
        "has_key": bool(t),
        "token_prefix": t[:3],
        "token_len": len(t),
        "model": model,
    }


def _normalize_hf_response(data):
    if isinstance(data, list):
        if len(data) == 0:
            return {}
        if isinstance(data[0], dict) and ("labels" in data[0] or "label" in data[0]):
            return data[0]
        return {"_list": data}

    if isinstance(data, dict):
        return data

    return {}


async def hugging_agent(text: str) -> dict:
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN missing. Put HF_TOKEN in .env or env vars.")

    hf_model = os.getenv("HF_MODEL", HF_MODEL)

    url = f"https://router.huggingface.co/hf-inference/models/{hf_model}"
    headers = {"Authorization": f"Bearer {hf_token}"}

    payload = {
        "inputs": text,
        "parameters": {"candidate_labels": LABELS},
        "options": {"wait_for_model": True},
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        raw = res.json()

    data = _normalize_hf_response(raw)

    labels = data.get("labels") if isinstance(data, dict) else None
    scores = data.get("scores") if isinstance(data, dict) else None

    if labels and scores:
        top_label = labels[0]
        top_score = float(scores[0])
        return {
            "risk_category": top_label,
            "risk_score": max(0.0, min(1.0, top_score)),
            "risk_reason": "HF zero-shot classification top label",
            "agent": "HF_TEXT",
            "raw": raw,
        }

    if isinstance(data, dict) and "_list" in data and isinstance(data["_list"], list) and data["_list"]:
        first = data["_list"][0]
        if isinstance(first, dict) and "label" in first and "score" in first:
            return {
                "risk_category": first["label"],
                "risk_score": max(0.0, min(1.0, float(first["score"]))),
                "risk_reason": "HF classification top label (label/score format)",
                "agent": "HF_TEXT",
                "raw": raw,
            }

    if isinstance(raw, list) and raw:
        sorted_items = sorted(
            raw,
            key=lambda x: float(x.get("score", 0.0)),
            reverse=True
        )
        top = sorted_items[0]

        return {
            "risk_category": top.get("label"),
            "risk_score": max(0.0, min(1.0, float(top.get("score", 0.0)))),
            "risk_reason": "HF zero-shot classification (label/score list)",
            "agent": "HF_TEXT",
            "raw": raw,
        }

    raise RuntimeError(f"Unexpected HF response format: {raw}")
    


@router.post("/text")
async def classify_text(payload: HFTextIn):
    try:
        return await hugging_agent(payload.text)

    except httpx.HTTPStatusError as e:
        body = None
        try:
            body = e.response.json()
        except Exception:
            body = (e.response.text or "")[:500]

        raise HTTPException(
            status_code=e.response.status_code,
            detail={"msg": "HF API error", "status": e.response.status_code, "body": body},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HF error: {e}")
