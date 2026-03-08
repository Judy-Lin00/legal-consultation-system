"""咨询会话服务"""
import uuid
from datetime import datetime
from typing import Optional

from app.db.connection import get_db


def _summarize(messages: list) -> str:
    first_user = next((m for m in messages if m.get("role") == "user"), None)
    if not first_user:
        return "新对话"
    text = (first_user.get("content") or "").replace("\n", " ").strip()
    return (text[:24] + "...") if len(text) > 24 else text


def create_session(
    user_id: str,
    user_content: str,
    assistant_content: str,
) -> str:
    """创建新会话（含首轮对话），返回 session_id"""
    db = get_db()
    session_id = str(uuid.uuid4())
    now = datetime.utcnow()
    messages = [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content},
    ]
    title = _summarize(messages)
    db["sessions"].insert_one({
        "session_id": session_id,
        "user_id": user_id,
        "title": title,
        "messages": messages,
        "created_at": now,
        "updated_at": now,
    })
    return session_id


def append_to_session(
    user_id: str,
    session_id: str,
    user_content: str,
    assistant_content: str,
) -> bool:
    """追加对话到已有会话，校验归属"""
    db = get_db()
    doc = db["sessions"].find_one({"session_id": session_id, "user_id": user_id})
    if not doc:
        return False
    messages = doc.get("messages", []) + [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content},
    ]
    title = _summarize(messages)
    db["sessions"].update_one(
        {"session_id": session_id, "user_id": user_id},
        {
            "$set": {
                "messages": messages,
                "title": title,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return True


def get_user_sessions(user_id: str, limit: int = 50) -> list:
    """获取用户会话列表"""
    db = get_db()
    cursor = db["sessions"].find(
        {"user_id": user_id}
    ).sort("updated_at", -1).limit(limit)
    return [
        {
            "session_id": d["session_id"],
            "title": d.get("title", "新对话"),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
            "updated_at": d.get("updated_at").isoformat() if d.get("updated_at") else None,
            "case_status": d.get("case_status"),
        }
        for d in cursor
    ]


def delete_session(user_id: str, session_id: str) -> bool:
    """删除会话，校验归属"""
    db = get_db()
    result = db["sessions"].delete_one({"session_id": session_id, "user_id": user_id})
    return result.deleted_count > 0


def get_session(user_id: str, session_id: str) -> Optional[dict]:
    """获取会话详情（含消息、案情状态），校验归属"""
    db = get_db()
    doc = db["sessions"].find_one({"session_id": session_id, "user_id": user_id})
    if not doc:
        return None
    out = {
        "session_id": doc["session_id"],
        "title": doc.get("title", "新对话"),
        "messages": doc.get("messages", []),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }
    if doc.get("case_status"):
        out["case_input"] = doc.get("case_input", "")
        out["case_status"] = doc.get("case_status")
        out["case_summary"] = doc.get("case_summary")
        out["analysis_result"] = doc.get("analysis_result")
        out["action_options"] = doc.get("action_options", ["文书生成", "行动指引", "风险评估"])
    return out
