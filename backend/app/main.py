import os
from dotenv import load_dotenv
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.sql import Base, engine
import app.models


from app.api.ai_groq import router as ai_groq_router
from app.api.ai_hugging import router as hf_text_router
from app.api.ai_gemini_engine import router as ai_gemini_engine_router
from app.api.ai_router import router as mas_router
from app.routers.auth import router as auth_router
from app.routers.user import router as user_router
from app.routers.archive import router as archive_router
from app.api.faith_video_risk import router as video_router

'''
from app.api.verification_history import router as verification_router
from app.api.risk_detail import router as risk_detail_router
from app.api.verify import router as verify_router
from app.api.predict_media import router as predict_media_router
from app.api.ai_gemini import router as ai_gemini_router
from app.api.ai_router import router as mas_router
'''
app = FastAPI()

_default_cors = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
_extra_cors = os.getenv("CORS_ORIGINS", "").strip()
origins = list(_default_cors)
if _extra_cors:
    origins.extend([o.strip() for o in _extra_cors.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(auth_router)
app.include_router(user_router)
app.include_router(archive_router)
app.include_router(ai_groq_router)
app.include_router(hf_text_router)
app.include_router(ai_gemini_engine_router)
app.include_router(mas_router)
app.include_router(video_router)

'''
app.include_router(mas_router)
app.include_router(verification_router)
app.include_router(risk_detail_router)
app.include_router(verify_router)
app.include_router(predict_media_router)
app.include_router(ai_gemini_router)
'''


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def read_root():
    return {"ok": True}
