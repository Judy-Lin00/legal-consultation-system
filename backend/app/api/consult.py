"""法律咨询 API"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

from app.services.llm_service import get_llm_answer, stream_llm_answer
from app.services.session_service import create_session, append_to_session
from app.core.deps import get_optional_user_id

router = APIRouter()


class ConsultRequest(BaseModel):
    question: str
    history: Optional[list] = []
    session_id: Optional[str] = None


class ConsultResponse(BaseModel):
    answer: str
    session_id: Optional[str] = None


@router.post("/consult", response_model=ConsultResponse)
async def consult(req: ConsultRequest, user_id: Optional[str] = Depends(get_optional_user_id)):
    """
    法律咨询接口
    - 已登录：持久化到数据库，返回 session_id
    - 未登录：仅返回回答，不持久化
    """
    answer = await get_llm_answer(req.question, req.history)

    if user_id:
        if req.session_id:
            ok = append_to_session(user_id, req.session_id, req.question, answer)
            if ok:
                return ConsultResponse(answer=answer, session_id=req.session_id)
        session_id = create_session(user_id, req.question, answer)
        return ConsultResponse(answer=answer, session_id=session_id)

    return ConsultResponse(answer=answer)


@router.post("/consult/stream")
async def consult_stream(req: ConsultRequest, user_id: Optional[str] = Depends(get_optional_user_id)):
    """
    法律咨询流式接口 - 逐字返回回答，减少用户等待焦虑
    """
    full_answer = []

    async def generate():
        nonlocal full_answer
        async for chunk in stream_llm_answer(req.question, req.history):
            yield chunk
            # 解析并累积完整回答（用于后续持久化）
            if chunk.startswith("data: "):
                try:
                    data = json.loads(chunk[6:].strip())
                    full_answer.append(data.get("content", ""))
                except json.JSONDecodeError:
                    pass
        # 持久化到数据库（已登录时）
        if user_id and full_answer:
            answer = "".join(full_answer)
            if req.session_id:
                ok = append_to_session(user_id, req.session_id, req.question, answer)
                if ok:
                    yield f'data: {{"session_id": {json.dumps(req.session_id)}}}\n\n'
            else:
                sid = create_session(user_id, req.question, answer)
                yield f'data: {{"session_id": {json.dumps(sid)}}}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
