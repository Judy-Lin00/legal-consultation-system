"""FastAPI 依赖"""
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """从 JWT 解析当前用户 ID"""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="请先登录")
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user_id


async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[str]:
    """可选用户 ID，未登录返回 None"""
    if not credentials or not credentials.credentials:
        return None
    return decode_access_token(credentials.credentials)
