import os
import json
import base64
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from google import genai
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.models.verification_history import VerificationHistory
from app.models.risk_detail import RiskDetail


router = APIRouter(prefix="/api/ai", tags=["ai"])
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class RiskReq(BaseModel):
    member_id: Optional[int] = None
    text: str = Field(..., min_length=1)


class RiskRes(BaseModel):
    verification_id: int
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    categories: List[str]
    reasons: List[str]
    needs_action: bool


SYSTEM_PROMPT = """
너는 입력 텍스트(및 선택적으로 이미지)의 위험도를 평가하는 안전 분류기다.
아래 JSON 스키마로만 출력해라(코드블록 금지, 다른 텍스트 금지).

규칙:
- risk_score: 0~100 정수
- risk_level: LOW(0~33), MEDIUM(34~66), HIGH(67~100)
- categories: 해당되는 위험 카테고리 문자열 배열(없으면 [])
- reasons: 판단 근거 2~5개 (한국어, 짧게)
- needs_action: HIGH면 true, 아니면 false

출력 JSON 예시:
{"risk_score": 12, "risk_level":"LOW", "categories":[], "reasons":["...","..."], "needs_action": false}
""".strip()


def _strip_code_fence(s: str) -> str:    
    s = (s or "").strip()
    if s.startswith("```"):
        s = s.strip("`").strip()
        if "\n" in s:
            s = s.split("\n", 1)[1].strip()
        if s.endswith("```"):
            s = s[:-3].strip()
    return s


@router.post("/risk", response_model=RiskRes)
def analyze_risk(req: RiskReq, db: Session = Depends(get_db)):
    resp = None
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[SYSTEM_PROMPT, f"입력 텍스트:\n{req.text}"],
        )

        raw = _strip_code_fence(resp.text)
        data = json.loads(raw)

        vh = VerificationHistory(
            member_id=req.member_id,
            input_content=req.text[:20],
            final_risk_score=round(float(data["risk_score"]) / 100.0, 2),
            risk_level=data["risk_level"],
        )
        db.add(vh)
        db.flush()

        categories = data.get("categories", []) or []
        detail_rows: List[RiskDetail] = []

        for cat in categories:
            detail_rows.append(
                RiskDetail(
                    verification_id=vh.verification_id,
                    risk_category=str(cat),
                    weight=1.00,
                    individual_risk_score=round(float(data["risk_score"]) / 100.0, 2),
                    final_risk_score=round(float(data["risk_score"]) / 100.0, 2),
                    risk_level=data["risk_level"],
                )
            )

        if detail_rows:
            db.add_all(detail_rows)
            db.flush()
            vh.risk_detail_id = detail_rows[0].risk_detail_id

        db.commit()

        return {
            "verification_id": vh.verification_id,
            **data,
        }

    except json.JSONDecodeError:
        db.rollback()
        raw_text = (resp.text if resp else "")
        raise HTTPException(status_code=500, detail=f"Gemini JSON parse failed: {raw_text}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
def gemini_analyze_only(text: str) -> dict:
    user_text = text.strip() if text and text.strip() else "(텍스트 없음)"

    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[SYSTEM_PROMPT, f"입력 텍스트:\n{user_text}"],
    )

    raw = _strip_code_fence(resp.text)
    return json.loads(raw)


def gemini_analyze_with_image(text: str, image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    user_text = text.strip() if text and text.strip() else "(텍스트 없음)"

    b64 = base64.b64encode(image_bytes).decode("utf-8")

    contents = [
        {
            "role": "user",
            "parts": [
                {"text": SYSTEM_PROMPT},
                {"text": f"입력 텍스트:\n{user_text}"},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": b64,
                    }
                },
            ],
        }
    ]

    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
    )

    raw = _strip_code_fence(resp.text)
    return json.loads(raw)

@router.get("/models")
def list_models():
    return {"models": [m.name for m in client.models.list()]}
