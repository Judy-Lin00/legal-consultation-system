"""应用配置"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """配置项"""
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "legal_consultation"

    # JWT 认证
    JWT_SECRET: str = "change-me-in-production-use-env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天

    # CORS 跨域（开发时可配 *，生产建议指定前端域名）
    CORS_ORIGINS: str = "*"  # 如 "http://localhost:5173,http://localhost:5174"

    # 大模型 API
    DEEPSEEK_API_KEY: str = ""  # DeepSeek API Key，优先使用
    DIFY_API_URL: str = ""
    DIFY_API_KEY: str = ""
    LLM_API_URL: str = ""
    LLM_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
