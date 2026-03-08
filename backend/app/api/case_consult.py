"""
案情咨询 API - 按流程图实现多步骤流程
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.services.case_consultation_service import (
    check_completeness_and_respond,
    execute_action,
    run_compliance_analysis,
)
from app.db.connection import get_db
from app.core.deps import get_optional_user_id

router = APIRouter()


class CaseConsultRequest(BaseModel):
    user_input: str
    session_id: Optional[str] = None
    action: Optional[str] = None  # 文书生成 | 行动指引 | 风险评估
    # 前端状态（无会话时用于确认流程）
    client_case_status: Optional[str] = None
    client_case_summary: Optional[str] = None
    client_case_input: Optional[str] = None


class CaseConsultResponse(BaseModel):
    type: str  # follow_up | summary | analysis | action_result
    message: str
    session_id: Optional[str] = None
    case_input: Optional[str] = None
    case_status: Optional[str] = None
    case_summary: Optional[str] = None
    follow_up_questions: Optional[List[str]] = None
    analysis: Optional[dict] = None
    action_options: Optional[List[str]] = None


def _get_or_create_session_case_state(user_id: Optional[str], session_id: Optional[str]) -> tuple:
    """获取或创建会话的案情状态。返回 (session_id, case_input, case_status, case_summary, analysis_result)"""
    db = get_db()
    if not session_id or not user_id:
        return None, "", "gathering", None, None
    doc = db["sessions"].find_one({"session_id": session_id, "user_id": user_id})
    if not doc:
        return session_id, "", "gathering", None, None
    return (
        session_id,
        doc.get("case_input", ""),
        doc.get("case_status", "gathering"),
        doc.get("case_summary"),
        doc.get("analysis_result"),
    )


def _update_session_case_state(
    user_id: str,
    session_id: str,
    case_input: str,
    case_status: str,
    case_summary: Optional[str] = None,
    analysis_result: Optional[dict] = None,
    action_options: Optional[List[str]] = None,
):
    """更新会话的案情状态"""
    db = get_db()
    from datetime import datetime
    update = {
        "case_input": case_input,
        "case_status": case_status,
        "updated_at": datetime.utcnow(),
    }
    if case_summary is not None:
        update["case_summary"] = case_summary
    if analysis_result is not None:
        update["analysis_result"] = analysis_result
    if action_options is not None:
        update["action_options"] = action_options
    db["sessions"].update_one(
        {"session_id": session_id, "user_id": user_id},
        {"$set": update},
    )


def _append_case_messages(user_id: str, session_id: str, user_content: str, assistant_content: str, extra: dict = None):
    """追加案情咨询消息到会话"""
    db = get_db()
    doc = db["sessions"].find_one({"session_id": session_id, "user_id": user_id})
    if not doc:
        return False
    messages = doc.get("messages", []) + [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content},
    ]
    from datetime import datetime
    update = {"messages": messages, "updated_at": datetime.utcnow()}
    if extra:
        update.update(extra)
    db["sessions"].update_one(
        {"session_id": session_id, "user_id": user_id},
        {"$set": update},
    )
    return True


def _create_case_session(user_id: str, user_content: str, assistant_content: str, extra: dict = None) -> str:
    """创建案情咨询会话"""
    import uuid
    from datetime import datetime
    db = get_db()
    session_id = str(uuid.uuid4())
    title = (user_content[:24] + "…") if len(user_content) > 24 else user_content or "案情咨询"
    doc = {
        "session_id": session_id,
        "user_id": user_id,
        "title": title,
        "messages": [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_content},
        ],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    if extra:
        doc.update(extra)
    db["sessions"].insert_one(doc)
    return session_id


@router.post("/case-consult", response_model=CaseConsultResponse)
async def case_consult(
    req: CaseConsultRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    案情咨询流程接口
    - 用户提交案情 -> 完整性检查 -> 补充问题/摘要确认 -> 合规分析 -> 后续操作
    """
    user_input = (req.user_input or "").strip()
    if not user_input:
        return CaseConsultResponse(
            type="error",
            message="请输入案情描述或补充信息",
        )

    session_id, case_input, case_status, case_summary, analysis_result = _get_or_create_session_case_state(
        user_id, req.session_id
    )

    # I: 用户选择后续操作（文书生成/行动指引/风险评估）
    if case_status == "analysis_done" and req.action:
        if req.action not in ("文书生成", "行动指引", "风险评估"):
            return CaseConsultResponse(type="error", message="请选择有效的后续操作")
        result = await execute_action(req.action, case_summary or "", analysis_result or {})
        if user_id and session_id:
            _append_case_messages(user_id, session_id, f"选择：{req.action}", result)
        return CaseConsultResponse(
            type="action_result",
            message=result,
            session_id=session_id,
            case_status=case_status,
            action_options=["文书生成", "行动指引", "风险评估"],
        )

    # G: 用户确认案情摘要（支持前端传入状态，解决未登录/DB 不同步时无法识别确认的问题）
    effective_status = case_status or req.client_case_status
    effective_summary = (case_summary or req.client_case_summary or "").strip() or None
    effective_input = (case_input or req.client_case_input or "").strip()
    confirm_keywords = ("确认", "无误", "正确", "可以", "确认无误")
    is_confirm_input = any(k in user_input for k in confirm_keywords) and len(user_input) < 20
    in_summary_pending = effective_status == "summary_pending"
    has_summary_for_confirm = is_confirm_input and (effective_summary or effective_input)
    if in_summary_pending or has_summary_for_confirm:
        if is_confirm_input:
            # 确认 -> A9: 生成结构化分析结果（核心结论+法律依据+通俗解释），再展示后续操作按钮
            action_options = ["文书生成", "行动指引", "风险评估"]
            summary_for_analysis = effective_summary or effective_input  # 无摘要时用原始案情
            analysis_result = await run_compliance_analysis(summary_for_analysis or "")
            analysis_data = analysis_result.get("analysis", {})
            analysis_message = analysis_result.get("message", "案情摘要已确认，请选择下一步操作：")
            if user_id and session_id:
                _update_session_case_state(
                    user_id, session_id,
                    effective_input, "analysis_done",
                    case_summary=effective_summary,
                    analysis_result=analysis_data,
                    action_options=action_options,
                )
                _append_case_messages(user_id, session_id, user_input, analysis_message)
            return CaseConsultResponse(
                type="analysis",
                message=analysis_message,
                session_id=session_id,
                case_status="analysis_done",
                analysis=analysis_data,
                action_options=action_options,
            )
        # 需修改 -> 将用户输入作为修正，回到完整性检查（已整合，不再追加）
        case_input = f"{effective_input}\n\n【用户修正】{user_input}"
        case_status = "gathering"
    else:
        # B/B1: 整合案情（追加用户输入）
        if case_input:
            case_input = f"{case_input}\n\n{user_input}"
        else:
            case_input = user_input

    # C: 完整性检查
    resp = await check_completeness_and_respond(case_input)

    if resp["type"] == "follow_up":
        if user_id:
            if session_id:
                _update_session_case_state(user_id, session_id, case_input, "gathering")
                _append_case_messages(user_id, session_id, user_input, resp["message"])
            else:
                session_id = _create_case_session(
                    user_id, user_input, resp["message"],
                    {"case_input": case_input, "case_status": "gathering"},
                )
    hint = "\n\n（提示：登录后可保存咨询记录，方便继续补充）" if not user_id else ""
    return CaseConsultResponse(
        type="follow_up",
        message=resp["message"] + hint,
        session_id=session_id,
        case_input=case_input,
        case_status="gathering",
        follow_up_questions=resp.get("questions", []),
    )

    # F: 生成摘要，等待确认
    if user_id:
        if session_id:
            _update_session_case_state(
                user_id, session_id, case_input, "summary_pending",
                case_summary=resp.get("case_summary"),
            )
            _append_case_messages(user_id, session_id, user_input, resp["message"])
        else:
            session_id = _create_case_session(
                user_id, user_input, resp["message"],
                {"case_input": case_input, "case_status": "summary_pending", "case_summary": resp.get("case_summary")},
            )
    hint = "\n\n（提示：登录后可保存咨询记录）" if not user_id else ""
    return CaseConsultResponse(
        type="summary",
        message=resp["message"] + hint,
        session_id=session_id,
        case_input=case_input,
        case_status="summary_pending",
        case_summary=resp.get("case_summary"),
    )
