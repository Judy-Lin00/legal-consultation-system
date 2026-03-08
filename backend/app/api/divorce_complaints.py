"""离婚纠纷起诉状 API"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.divorce_complaint_service import (
    parse_and_create,
    add_version,
    get_user_complaints,
    get_complaint,
)
from app.core.deps import get_current_user_id

router = APIRouter()


class CreateComplaintRequest(BaseModel):
    raw_input: str
    session_id: Optional[str] = None


class AddVersionRequest(BaseModel):
    raw_input: str


@router.post("/divorce-complaints")
async def create_complaint(
    req: CreateComplaintRequest,
    user_id: str = Depends(get_current_user_id),
):
    """创建离婚起诉状（AI 解析案情与起草要求，排除当事人信息）"""
    if not req.raw_input.strip():
        raise HTTPException(status_code=400, detail="请输入案情概要与起草要求")
    return await parse_and_create(user_id, req.raw_input, req.session_id)


@router.post("/divorce-complaints/{complaint_id}/versions")
async def create_version(
    complaint_id: str,
    req: AddVersionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """为已有起诉状添加新版本"""
    if not req.raw_input.strip():
        raise HTTPException(status_code=400, detail="请输入案情概要与起草要求")
    result = await add_version(user_id, complaint_id, req.raw_input)
    if not result:
        raise HTTPException(status_code=404, detail="未找到该起诉状")
    return result


@router.get("/divorce-complaints")
async def list_complaints(user_id: str = Depends(get_current_user_id)):
    """获取当前用户的离婚起诉状列表"""
    return {"complaints": get_user_complaints(user_id)}


@router.get("/divorce-complaints/{complaint_id}")
async def get_complaint_detail(
    complaint_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """获取离婚起诉状详情（含所有版本）"""
    doc = get_complaint(user_id, complaint_id)
    if not doc:
        raise HTTPException(status_code=404, detail="未找到该起诉状")
    return doc
