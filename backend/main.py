"""
法律咨询系统 - FastAPI 后端
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import consult, auth, sessions, divorce_complaints, case_consult, document
from app.core.config import settings

app = FastAPI(
    title="法律咨询系统 API",
    description="基于大模型的法律智能咨询接口",
    version="1.0.0",
)

_cors_origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(consult.router, prefix="/api", tags=["咨询"])
app.include_router(sessions.router, prefix="/api", tags=["会话"])
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(divorce_complaints.router, prefix="/api", tags=["离婚起诉状"])
app.include_router(case_consult.router, prefix="/api", tags=["案情咨询"])
app.include_router(document.router, prefix="/api", tags=["文书生成"])


@app.get("/")
def root():
    return {"message": "法律咨询系统 API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
