from fastapi import APIRouter, UploadFile, File, Form
import asyncio

from app.api.ai_groq import groq_classify, GroqTextIn
from app.api.ai_hugging import hugging_agent
from app.api.ai_gemini_engine import gemini_engine_analyze  # 너가 만든 함수/라우터 구조에 맞게 조정

router = APIRouter(prefix="/api/test", tags=["test"])

@router.post("/mas")
async def test_mas(
    text: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
):
    text = (text or "").strip()

    tasks = []
    names = []

    names.append("gemini")
    tasks.append(gemini_engine_analyze(text=text if text else None, image=image))

    if text:
        names.append("groq")
        tasks.append(asyncio.to_thread(groq_classify, GroqTextIn(text=text)))

        names.append("hf")
        tasks.append(hugging_agent(text))

    outs = await asyncio.gather(*tasks)
    return dict(zip(names, outs))
