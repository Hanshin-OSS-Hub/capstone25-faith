import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session

from app.db.sql import get_db
from app.models.verification_history import VerificationHistory
from app.models.risk_detail import RiskDetail

from app.api.ai_gemini import gemini_analyze_only, gemini_analyze_with_image
from app.api.ai_groq import groq_classify, GroqTextIn
from app.api.ai_hugging import hugging_agent

router = APIRouter(prefix="/verify", tags=["Verify+Save"])


def _safe_image_mime(upload: UploadFile | None) -> str:
    if not upload:
        return "image/jpeg"
    ct = (upload.content_type or "").lower().strip()
    if ct.startswith("image/"):
        return ct
    filename = (upload.filename or "").lower()
    if filename.endswith(".png"):
        return "image/png"
    if filename.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def _risk_level(score01: float) -> str:
    if score01 >= 0.67:
        return "HIGH"
    if score01 >= 0.34:
        return "MEDIUM"
    return "LOW"


@router.post("")
async def verify_and_save(
    member_id: int | None = Form(default=None),
    text: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    clean_text = (text or "").strip()

    if (not clean_text) and image is None:
        raise HTTPException(status_code=400, detail="Provide text and/or image")

    if clean_text and image is not None:
        input_content = "mixed"
    elif image is not None:
        input_content = "image"
    else:
        input_content = "text"

    tasks = []
    names = []

    if image is not None:
        img_bytes = await image.read()
        if not img_bytes:
            raise HTTPException(status_code=400, detail="Empty image file")
        mime = _safe_image_mime(image)

        g_task = asyncio.to_thread(
            gemini_analyze_with_image,
            clean_text,
            img_bytes,
            mime,
        )
    else:
        if not clean_text:
            raise HTTPException(status_code=400, detail="Text is required when no image is provided")
        g_task = asyncio.to_thread(gemini_analyze_only, clean_text)

    names.append("gemini")
    tasks.append(g_task)

    if clean_text:
        names.append("groq")
        tasks.append(asyncio.to_thread(groq_classify, GroqTextIn(text=clean_text)))

        names.append("hf")
        tasks.append(hugging_agent(clean_text))

    outs = await asyncio.gather(*tasks)
    results = dict(zip(names, outs))

    gemini_score100 = float(results["gemini"].get("risk_score", 0))
    gemini01 = max(0.0, min(1.0, gemini_score100 / 100.0))

    if "groq" in results:
        groq01 = float(results["groq"].get("risk_score", 0.0))
        final01 = max(0.0, min(1.0, 0.6 * gemini01 + 0.4 * groq01))
        final_category = results["groq"].get("risk_category") or "정상"
        weights = {"gemini": 0.6, "groq": 0.4, "hf": 0.0}
    else:
        final01 = gemini01
        cats = results["gemini"].get("categories") or []
        final_category = cats[0] if cats else "정상"
        weights = {"gemini": 1.0, "hf": 0.0}

    final_level = _risk_level(final01)

    try:
        vh = VerificationHistory(
            member_id=member_id,
            input_content=input_content,
            final_risk_score=round(final01, 2),
            risk_level=final_level,
        )
        db.add(vh)
        db.flush() 

        detail_rows: list[RiskDetail] = []

        g_cat = (results["gemini"].get("categories") or [])
        gemini_cat = g_cat[0] if g_cat else "정상"
        detail_rows.append(
            RiskDetail(
                verification_id=vh.verification_id,
                risk_category=f"gemini:{gemini_cat}",
                weight=round(weights.get("gemini", 0.0), 2),
                individual_risk_score=round(gemini01, 2),
                final_risk_score=round(final01, 2),
                risk_level=final_level,
            )
        )

        if "groq" in results:
            detail_rows.append(
                RiskDetail(
                    verification_id=vh.verification_id,
                    risk_category=f"groq:{results['groq'].get('risk_category','정상')}",
                    weight=round(weights.get("groq", 0.0), 2),
                    individual_risk_score=round(float(results["groq"].get("risk_score", 0.0)), 2),
                    final_risk_score=round(final01, 2),
                    risk_level=final_level,
                )
            )

        if "hf" in results:
            detail_rows.append(
                RiskDetail(
                    verification_id=vh.verification_id,
                    risk_category=f"hf:{results['hf'].get('risk_category','정상')}",
                    weight=round(weights.get("hf", 0.0), 2),
                    individual_risk_score=round(float(results["hf"].get("risk_score", 0.0)), 2),
                    final_risk_score=round(final01, 2),
                    risk_level=final_level,
                )
            )

        db.add_all(detail_rows)
        db.flush()

        vh.risk_detail_id = detail_rows[0].risk_detail_id

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB save failed: {repr(e)}")

    return {
        "verification_id": vh.verification_id,
        "final": {
            "risk_score": int(round(final01 * 100)),
            "risk_level": final_level,
            "risk_category": final_category,
        },
        "agents": results,
        "saved": {
            "verification_history": True,
            "risk_detail_count": len(detail_rows),
        }
    }
