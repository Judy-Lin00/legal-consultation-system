"""离婚纠纷起诉状服务：CRUD + AI 解析"""
import json
import re
import uuid
from datetime import datetime
from typing import Optional

from app.db.connection import get_db
from app.services.llm_service import get_llm_answer


DIVORCE_PROMPT_PREFIX = (
    "请将以下用户输入的离婚起诉状案情与起草要求，解析为结构化 JSON。"
    "只提取诉讼请求、事实与理由、纠纷解决意愿相关内容，不要提取当事人信息（原告、被告、代理人）。"
    "若用户未提及某字段，该字段可为空字符串或 null。"
    "请直接返回合法 JSON，不要包含 markdown 代码块或其它说明文字。"
    "JSON 结构参考："
    '{"litigation_requests":{"litigation_request_text":"","dissolve_marriage":true,"common_property":{"has_property":false,"houses":"","cars":"","deposits":"","other":""},'
    '"common_debt":{"has_debt":false,"debts":[]},"child_custody":{"has_issue":false,"children":[]},'
    '"child_support":{"has_issue":false,"responsible_party":null,"amount_detail":"","payment_method":""},'
    '"visitation_rights":{"has_issue":false,"exerciser":null,"method":""},'
    '"compensation":{"has_issue":false,"damages_amount":"","economic_compensation_amount":"","economic_assistance_amount":""},'
    '"claim_litigation_fees":null,"other_requests":{"has_preservation":false,"preservation_court":"","preservation_time":"","preservation_case_no":""}},'
    '"facts_and_reasons":{"facts_reasons_text":"","marriage_basic_info":"","property_situation":"","debt_situation":"","custody_situation":"","support_situation":"","visitation_situation":"","compensation_situation":"","other":"","claim_basis":"","evidence_list":""},'
    '"dispute_resolution_willingness":{"understand_mediation":null,"understand_mediation_benefits":null,"consider_mediation":null}}\n\n用户输入：\n'
)


def _parse_llm_json(text: str) -> Optional[dict]:
    """从 LLM 返回中提取 JSON"""
    text = text.strip()
    # 去除 markdown 代码块
    for pattern in [r"```(?:json)?\s*([\s\S]*?)```", r"```\s*([\s\S]*?)```"]:
        m = re.search(pattern, text)
        if m:
            text = m.group(1).strip()
            break
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def parse_and_create(
    user_id: str,
    raw_input: str,
    session_id: Optional[str] = None,
) -> dict:
    """
    解析用户输入并创建离婚起诉状（含首版）
    返回 complaint_id, versions
    """
    db = get_db()
    complaint_id = str(uuid.uuid4())
    now = datetime.utcnow()

    # 调用 AI 解析
    prompt = DIVORCE_PROMPT_PREFIX + raw_input
    llm_out = await get_llm_answer(prompt, [])
    parsed = _parse_llm_json(llm_out)

    # 默认空结构（排除当事人信息）
    default_parsed = {
        "litigation_requests": {
            "litigation_request_text": "",
            "dissolve_marriage": True,
            "common_property": {"has_property": False, "houses": "", "cars": "", "deposits": "", "other": ""},
            "common_debt": {"has_debt": False, "debts": []},
            "child_custody": {"has_issue": False, "children": []},
            "child_support": {"has_issue": False, "responsible_party": None, "amount_detail": "", "payment_method": ""},
            "visitation_rights": {"has_issue": False, "exerciser": None, "method": ""},
            "compensation": {"has_issue": False, "damages_amount": "", "economic_compensation_amount": "", "economic_assistance_amount": ""},
            "claim_litigation_fees": None,
            "other_requests": {"has_preservation": False, "preservation_court": "", "preservation_time": "", "preservation_case_no": ""},
        },
        "facts_and_reasons": {
            "facts_reasons_text": "", "marriage_basic_info": "", "property_situation": "", "debt_situation": "",
            "custody_situation": "", "support_situation": "", "visitation_situation": "", "compensation_situation": "",
            "other": "", "claim_basis": "", "evidence_list": "",
        },
        "dispute_resolution_willingness": {"understand_mediation": None, "understand_mediation_benefits": None, "consider_mediation": None},
    }

    if parsed:
        # 合并解析结果到默认结构
        for key in ["litigation_requests", "facts_and_reasons", "dispute_resolution_willingness"]:
            if key in parsed and isinstance(parsed[key], dict):
                for k, v in parsed[key].items():
                    if k in default_parsed.get(key, {}):
                        default_parsed[key][k] = v

    title = (raw_input[:50] + "…") if len(raw_input) > 50 else raw_input
    if not title.strip():
        title = "离婚纠纷起诉状"

    version_doc = {
        "version": 1,
        "raw_input": raw_input,
        "parsed_content": default_parsed,
        "created_at": now,
    }

    doc = {
        "complaint_id": complaint_id,
        "user_id": user_id,
        "session_id": session_id,
        "template_type": "离婚纠纷起诉状",
        "title": title,
        "versions": [version_doc],
        "current_version": 1,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    db["divorce_complaints"].insert_one(doc)
    return {
        "complaint_id": complaint_id,
        "title": title,
        "versions": [version_doc],
        "current_version": 1,
    }


async def add_version(user_id: str, complaint_id: str, raw_input: str) -> Optional[dict]:
    """为已有起诉状添加新版本"""
    db = get_db()
    doc = db["divorce_complaints"].find_one({"complaint_id": complaint_id, "user_id": user_id})
    if not doc:
        return None

    prompt = DIVORCE_PROMPT_PREFIX + raw_input
    llm_out = await get_llm_answer(prompt, [])
    parsed = _parse_llm_json(llm_out)

    default_parsed = {
        "litigation_requests": {
            "litigation_request_text": "", "dissolve_marriage": True,
            "common_property": {"has_property": False, "houses": "", "cars": "", "deposits": "", "other": ""},
            "common_debt": {"has_debt": False, "debts": []},
            "child_custody": {"has_issue": False, "children": []},
            "child_support": {"has_issue": False, "responsible_party": None, "amount_detail": "", "payment_method": ""},
            "visitation_rights": {"has_issue": False, "exerciser": None, "method": ""},
            "compensation": {"has_issue": False, "damages_amount": "", "economic_compensation_amount": "", "economic_assistance_amount": ""},
            "claim_litigation_fees": None,
            "other_requests": {"has_preservation": False, "preservation_court": "", "preservation_time": "", "preservation_case_no": ""},
        },
        "facts_and_reasons": {
            "facts_reasons_text": "", "marriage_basic_info": "", "property_situation": "", "debt_situation": "",
            "custody_situation": "", "support_situation": "", "visitation_situation": "", "compensation_situation": "",
            "other": "", "claim_basis": "", "evidence_list": "",
        },
        "dispute_resolution_willingness": {"understand_mediation": None, "understand_mediation_benefits": None, "consider_mediation": None},
    }
    if parsed:
        for key in ["litigation_requests", "facts_and_reasons", "dispute_resolution_willingness"]:
            if key in parsed and isinstance(parsed[key], dict):
                for k, v in parsed[key].items():
                    if k in default_parsed.get(key, {}):
                        default_parsed[key][k] = v

    now = datetime.utcnow()
    new_version = len(doc.get("versions", [])) + 1
    version_doc = {
        "version": new_version,
        "raw_input": raw_input,
        "parsed_content": default_parsed,
        "created_at": now,
    }

    db["divorce_complaints"].update_one(
        {"complaint_id": complaint_id, "user_id": user_id},
        {
            "$push": {"versions": version_doc},
            "$set": {"current_version": new_version, "updated_at": now},
        },
    )
    return {"complaint_id": complaint_id, "current_version": new_version, "version": version_doc}


def get_user_complaints(user_id: str, limit: int = 50) -> list:
    """获取用户离婚起诉状列表"""
    db = get_db()
    cursor = db["divorce_complaints"].find({"user_id": user_id}).sort("updated_at", -1).limit(limit)
    return [
        {
            "complaint_id": d["complaint_id"],
            "title": d.get("title", "离婚纠纷起诉状"),
            "template_type": d.get("template_type", "离婚纠纷起诉状"),
            "current_version": d.get("current_version", 1),
            "versions_count": len(d.get("versions", [])),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
            "updated_at": d.get("updated_at").isoformat() if d.get("updated_at") else None,
        }
        for d in cursor
    ]


def get_complaint(user_id: str, complaint_id: str) -> Optional[dict]:
    """获取离婚起诉状详情（含所有版本）"""
    db = get_db()
    doc = db["divorce_complaints"].find_one({"complaint_id": complaint_id, "user_id": user_id})
    if not doc:
        return None
    versions = []
    for v in doc.get("versions", []):
        versions.append({
            "version": v.get("version"),
            "raw_input": v.get("raw_input", ""),
            "parsed_content": v.get("parsed_content", {}),
            "created_at": v.get("created_at").isoformat() if v.get("created_at") else None,
        })
    return {
        "complaint_id": doc["complaint_id"],
        "title": doc.get("title", "离婚纠纷起诉状"),
        "template_type": doc.get("template_type", "离婚纠纷起诉状"),
        "current_version": doc.get("current_version", 1),
        "versions": versions,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }
