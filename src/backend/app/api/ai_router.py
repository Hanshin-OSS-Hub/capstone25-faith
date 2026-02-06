import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.api.ai_gemini import gemini_analyze_only, gemini_analyze_with_image
from app.api.ai_groq import groq_classify, GroqTextIn
from app.api.ai_hugging import hugging_agent

router = APIRouter(prefix="/api/ai", tags=["AI-MAS"])


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


@router.post("/verify")
async def verify(
    text: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
):
    try:
        if (not text or not text.strip()) and image is None:
            raise HTTPException(status_code=400, detail="Provide text and/or image")

        tasks = []
        names = []

        clean_text = (text or "").strip()

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

        gemini_score = results["gemini"].get("risk_score", 0)
        gemini01 = float(gemini_score) / 100.0

        if "groq" in results:
            groq01 = float(results["groq"].get("risk_score", 0.0))
            final01 = max(0.0, min(1.0, 0.6 * gemini01 + 0.4 * groq01))

            final_category = results["groq"].get("risk_category") or "정상"
        else:
            final01 = gemini01
            cats = results["gemini"].get("categories") or []
            final_category = cats[0] if cats else "정상"

        return {
            "final": {
                "risk_score": int(round(final01 * 100)),
                "risk_category": final_category,
            },
            "agents": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"verify error: {repr(e)}")
