from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.api.verify import verify_and_save

router = APIRouter(prefix="/api/predict", tags=["predict"])


@router.post("/media")
async def predict_media(
    file: UploadFile = File(...),
    text: str | None = Form(default=None), 
    member_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
):


    try:
        core = await verify_and_save(
            member_id=member_id,
            text=text,
            image=file,   
            db=db,
        )
    except HTTPException as e:
        detail = e.detail
        msg = detail if isinstance(detail, str) else str(detail)
        raise HTTPException(
            status_code=e.status_code,
            detail={"error_code": "VERIFY_FAILED", "message": msg},
        )

    verification_id = core.get("verification_id")
    final = core.get("final") or {}
    agents = core.get("agents") or {}

    gemini = agents.get("gemini") or {}
    reasons = gemini.get("reasons")
    if isinstance(reasons, list):
        analysis_details = reasons
    else:
        cats = gemini.get("categories") or []
        analysis_details = cats if isinstance(cats, list) and cats else ["분석 상세 정보가 없습니다."]

    return {
        "prediction_id": str(verification_id),       
        "risk_score": final.get("risk_score", 0),    
        "risk_level": final.get("risk_level", "LOW"),
        "risk_category": final.get("risk_category", "정상"),
        "analysis_details": analysis_details,

    }
