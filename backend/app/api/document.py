"""
文书生成 API - 按流程图实现
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List

from app.services.document_service import (
    get_sessions_with_confirmed_case,
    get_case_info_from_session,
    get_user_documents,
    match_templates_for_case,
    check_case_sufficient_for_doc,
    generate_document_draft,
    save_document_for_download,
    get_document_for_download,
    create_word_document,
)
from app.core.deps import get_optional_user_id, get_current_user_id

router = APIRouter()


class MatchTemplatesRequest(BaseModel):
    session_id: Optional[str] = None
    case_summary: Optional[str] = None


class GenerateRequest(BaseModel):
    template_key: str
    session_id: Optional[str] = None
    case_input: Optional[str] = None
    case_summary: Optional[str] = None


@router.get("/document/sessions-with-case")
async def list_sessions_with_case(user_id: str = Depends(get_current_user_id)):
    """B: 是否已有已确认的案情分析？返回有 analysis_done 的会话列表"""
    return {"sessions": get_sessions_with_confirmed_case(user_id)}


@router.get("/document/list")
async def list_user_documents(user_id: str = Depends(get_current_user_id)):
    """获取用户的文书记录列表"""
    return {"documents": get_user_documents(user_id)}


@router.get("/document/case-info/{session_id}")
async def get_case_info(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """C: 读取结构化案情信息与法律分析结果"""
    info = get_case_info_from_session(user_id, session_id)
    if not info:
        raise HTTPException(status_code=404, detail="未找到已确认的案情分析")
    return info


@router.post("/document/match-templates")
async def match_templates(
    req: MatchTemplatesRequest,
    user_id: str = Depends(get_optional_user_id),
):
    """D/S: 系统匹配推荐文书模板"""
    case_summary = ""
    analysis = None
    if req.session_id and user_id:
        info = get_case_info_from_session(user_id, req.session_id)
        if info:
            case_summary = info.get("case_summary", "")
            analysis = info.get("analysis_result")
    if req.case_summary:
        case_summary = req.case_summary
    templates = await match_templates_for_case(case_summary, analysis)
    return {"templates": templates}


class CheckCaseRequest(BaseModel):
    case_input: Optional[str] = None
    case_summary: Optional[str] = None


@router.post("/document/check-case")
async def check_case(
    req: CheckCaseRequest,
    user_id: str = Depends(get_optional_user_id),
):
    """P: 信息是否足以支持文书生成？"""
    case_input = (req.case_input or req.case_summary or "").strip()
    if not case_input:
        raise HTTPException(status_code=400, detail="请输入案情概要")
    return await check_case_sufficient_for_doc(case_input)


@router.post("/document/generate")
async def generate_document(
    req: GenerateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """G/U: 生成文书初稿，进行格式/完整性校验"""
    case_info = {}
    if req.session_id:
        info = get_case_info_from_session(user_id, req.session_id)
        if info:
            case_info = info
    if req.case_summary or req.case_input:
        case_info["case_summary"] = req.case_summary or req.case_input
        case_info["case_input"] = req.case_input or req.case_summary
    if not case_info.get("case_summary") and not case_info.get("case_input"):
        raise HTTPException(status_code=400, detail="请提供案情信息或选择已有案情会话")
    draft, missing = await generate_document_draft(req.template_key, case_info)
    doc_id = save_document_for_download(user_id, req.template_key, draft)
    return {
        "draft": draft,
        "missing_fields": missing,
        "doc_id": doc_id,
        "can_download": len(missing) == 0,
    }


@router.get("/document/download/{doc_id}")
async def download_document(
    doc_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """K/L/Y/Z: 用户下载文书"""
    content = get_document_for_download(user_id, doc_id)
    if not content:
        raise HTTPException(status_code=404, detail="文档不存在或已过期")
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="legal_document_{doc_id[:8]}.docx"'},
    )


class ExportDocxRequest(BaseModel):
    draft_text: str
    template_key: str


@router.post("/document/export-docx")
async def export_docx(
    req: ExportDocxRequest,
    user_id: str = Depends(get_current_user_id),
):
    """将用户编辑后的文书内容转为 DOCX 并返回供下载"""
    draft_text = (req.draft_text or "").strip()
    if not draft_text:
        raise HTTPException(status_code=400, detail="文书内容不能为空")
    content = create_word_document(draft_text, req.template_key, f"{req.template_key}.docx")
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="legal_document.docx"'},
    )
