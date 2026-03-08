"""咨询会话 API"""
from fastapi import APIRouter, Depends, HTTPException

from app.services.session_service import get_user_sessions, get_session
from app.core.deps import get_current_user_id

router = APIRouter()


@router.get("/sessions")
async def list_sessions(user_id: str = Depends(get_current_user_id)):
    """获取当前用户的历史会话列表"""
    sessions = get_user_sessions(user_id)
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str, user_id: str = Depends(get_current_user_id)):
    """获取会话详情（含消息）"""
    session = get_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session
