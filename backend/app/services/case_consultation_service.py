"""
案情咨询流程服务 - 按流程图实现
A: 用户提交案情 -> B: 标准化 -> C: 完整性检查
  -> 否: D 补充问题 -> E 用户回答 -> B1 整合 -> C
  -> 是: F 生成摘要 -> G 用户确认
    -> 需修改: D
    -> 确认: H 合规分析 -> I 后续操作(文书/行动指引/风险评估)
"""
import json
import re
from typing import Optional

from app.services.llm_service import get_llm_answer


def _parse_json_from_llm(text: str) -> Optional[dict]:
    """从 LLM 返回中提取 JSON"""
    text = (text or "").strip()
    for pattern in [r"```(?:json)?\s*([\s\S]*?)```", r"```\s*([\s\S]*?)```"]:
        m = re.search(pattern, text)
        if m:
            text = m.group(1).strip()
            break
    # 尝试找 { ... }
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        text = m.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def check_completeness_and_respond(case_input: str) -> dict:
    """
    检查案情是否完整，返回 follow_up 或 summary
    """
    prompt = f"""你是一名专业法律助手。请判断以下案情描述是否信息完整。

案情信息完整的标准：应包含当事人关系、时间地点、主要事实、争议焦点、涉及金额（如有）等关键要素。
若信息不足，请生成 1-3 个补充问题，帮助用户完善案情。
若信息完整，请生成一份结构化的案情摘要（包含：当事人、事实经过、争议焦点、诉求）。

请严格按以下 JSON 格式返回，不要包含其他文字：
- 若信息不完整：{{"complete": false, "questions": ["问题1", "问题2"]}}
- 若信息完整：{{"complete": true, "summary": "结构化案情摘要内容"}}

用户案情：
{case_input}
"""
    raw = await get_llm_answer(prompt, [])
    parsed = _parse_json_from_llm(raw)
    if parsed and parsed.get("complete"):
        return {
            "type": "summary",
            "case_summary": parsed.get("summary", raw),
            "message": "根据您提供的案情，我已整理如下摘要，请确认是否准确：\n\n" + (parsed.get("summary") or raw),
        }
    questions = []
    if parsed and isinstance(parsed.get("questions"), list):
        questions = parsed["questions"]
    elif parsed and isinstance(parsed.get("questions"), str):
        questions = [parsed["questions"]]
    if not questions:
        questions = ["请补充说明当事人之间的关系", "请描述争议发生的具体时间和地点", "请说明您的主要诉求"]
    return {
        "type": "follow_up",
        "questions": questions,
        "message": "为更好分析您的案情，请补充以下信息：\n\n" + "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions)),
    }


async def run_compliance_analysis(case_summary: str) -> dict:
    """
    合规性校验，生成结构化分析结果
    """
    prompt = f"""你是一名专业法律助手。请对以下案情摘要进行合规性分析，给出：
1. 核心结论：简要的法律判断或结论
2. 法律依据：引用的法律法规或司法解释
3. 通俗解释：用普通人能理解的语言解释

请严格按以下 JSON 格式返回：
{{"core_conclusion": "核心结论", "legal_basis": "法律依据", "plain_explanation": "通俗解释"}}

案情摘要：
{case_summary}
"""
    raw = await get_llm_answer(prompt, [])
    parsed = _parse_json_from_llm(raw)
    if parsed:
        msg = (
            f"**核心结论**\n{parsed.get('core_conclusion', '')}\n\n"
            f"**法律依据**\n{parsed.get('legal_basis', '')}\n\n"
            f"**通俗解释**\n{parsed.get('plain_explanation', '')}\n\n"
            "---\n请选择下一步操作："
        )
        return {
            "type": "analysis",
            "analysis": {
                "core_conclusion": parsed.get("core_conclusion", ""),
                "legal_basis": parsed.get("legal_basis", ""),
                "plain_explanation": parsed.get("plain_explanation", ""),
            },
            "message": msg,
            "action_options": ["文书生成", "行动指引", "风险评估"],
        }
    return {
        "type": "analysis",
        "analysis": {"core_conclusion": "", "legal_basis": "", "plain_explanation": raw},
        "message": raw + "\n\n---\n请选择下一步操作：",
        "action_options": ["文书生成", "行动指引", "风险评估"],
    }


# 常见案件类型对应的官方链接
OFFICIAL_LINKS = {
    "劳动": {"name": "全国人社服务", "url": "https://www.12333.gov.cn"},
    "劳动争议": {"name": "劳动人事争议仲裁", "url": "https://www.12333.gov.cn"},
    "工伤": {"name": "工伤保险", "url": "https://www.12333.gov.cn"},
    "离婚": {"name": "诉讼服务", "url": "https://www.court.gov.cn"},
    "婚姻": {"name": "中国法院网", "url": "https://www.chinacourt.org"},
    "借贷": {"name": "中国裁判文书网", "url": "https://wenshu.court.gov.cn"},
    "民间借贷": {"name": "中国裁判文书网", "url": "https://wenshu.court.gov.cn"},
    "交通事故": {"name": "交通事故处理", "url": "https://www.12389.gov.cn"},
    "仲裁": {"name": "仲裁委员会", "url": "https://www.12333.gov.cn"},
}


async def _generate_action_guidance(case_summary: str, analysis: dict) -> str:
    """
    行动指引流程：B 读取案情 -> C 识别案件类型与争议点 -> D 生成流程图 -> E 标注注意事项 -> F 附官方链接
    """
    prompt = f"""你是一名专业法律助手。请根据已确认的案情和法律分析，生成一份「行动指引」操作流程图。

案情摘要：
{case_summary}

法律分析：
{json.dumps(analysis, ensure_ascii=False)}

请按以下步骤生成内容，严格按 JSON 格式返回：

1. case_type: 案件类型（如：劳动争议、离婚纠纷、民间借贷、交通事故等）
2. core_disputes: 核心争议点列表，1-3 个
3. steps: 操作流程步骤数组，每项包含：
   - step: 步骤序号和描述（如 "1. 收集证据"）
   - note: 该步骤的注意事项（必填，简要说明）
   - is_key: 是否为关键流程（关键流程需附官方链接，布尔值）
4. 返回格式示例：
{{
  "case_type": "劳动争议",
  "core_disputes": ["拖欠工资", "解除劳动关系"],
  "steps": [
    {{"step": "1. 收集证据", "note": "保留劳动合同、工资条、考勤记录等", "is_key": true}},
    {{"step": "2. 申请劳动仲裁", "note": "向用人单位所在地或劳动合同履行地仲裁委申请", "is_key": true}}
  ]
}}

请直接返回 JSON，不要包含其他说明文字。
"""
    raw = await get_llm_answer(prompt, [])
    parsed = _parse_json_from_llm(raw)
    if not parsed or "steps" not in parsed:
        return await get_llm_answer(
            f"根据案情摘要：{case_summary}\n\n请给出具体的下一步行动建议（如收集证据、申请仲裁等），包含关键步骤和注意事项。",
            [],
        )

    case_type = parsed.get("case_type", "")
    core_disputes = parsed.get("core_disputes", [])
    steps = parsed.get("steps", [])

    # 匹配官方链接（去重）
    seen = set()
    link_parts = []
    for kw, info in OFFICIAL_LINKS.items():
        if info["url"] in seen:
            continue
        if kw in case_type or any(kw in str(d) for d in core_disputes):
            link_parts.append(f"- [{info['name']}]({info['url']})")
            seen.add(info["url"])
    link_text = "\n".join(link_parts) if link_parts else "- [全国人社服务 12333](https://www.12333.gov.cn)\n- [中国法院网](https://www.chinacourt.org)"

    lines = [
        f"**案件类型**：{case_type}",
        f"**核心争议点**：{'；'.join(core_disputes) if core_disputes else '见案情摘要'}",
        "",
        "**操作流程**",
        "---",
    ]
    for s in steps:
        step = s.get("step", "")
        note = s.get("note", "")
        is_key = s.get("is_key", False)
        lines.append(f"{step}")
        lines.append(f"  ⚠️ 注意事项：{note}")
        if is_key:
            lines.append("  📎 相关官方渠道见下方链接")
        lines.append("")

    lines.append("**官方链接**")
    lines.append("---")
    lines.append(link_text)

    return "\n".join(lines)


async def _generate_risk_assessment(case_summary: str, analysis: dict) -> str:
    """
    风险评估流程：D2 读取案情 -> D3 识别案件类型/争议焦点/潜在风险点
    -> D4 从法律、证据、时效、执行等维度评估 -> D5 生成结构化结果 -> D6 展示风险等级、影响说明及应对建议
    """
    prompt = f"""你是一名专业法律助手。请对以下已确认的案情进行风险评估。

案情摘要：
{case_summary}

法律分析：
{json.dumps(analysis, ensure_ascii=False)}

请按以下维度进行结构化评估，严格按 JSON 格式返回：
1. case_type: 案件类型
2. core_disputes: 核心争议焦点列表
3. risk_points: 潜在风险点列表
4. dimensions: 各维度评估
   - legal: 法律风险（说明）
   - evidence: 证据风险（说明）
   - timeliness: 时效风险（说明）
   - execution: 执行风险（说明）
5. risk_level: 综合风险等级（低/中/高）
6. impact: 风险影响说明
7. suggestions: 应对建议列表

返回格式示例：
{{
  "case_type": "劳动争议",
  "core_disputes": ["拖欠工资"],
  "risk_points": ["证据不足", "时效临近"],
  "dimensions": {{
    "legal": "劳动法对工资支付有明确规定",
    "evidence": "需保留劳动合同、工资条等",
    "timeliness": "劳动仲裁时效一年",
    "execution": "若对方无财产可能执行困难"
  }},
  "risk_level": "中",
  "impact": "若证据不足可能影响诉求支持",
  "suggestions": ["尽快收集证据", "注意仲裁时效"]
}}

请直接返回 JSON，不要包含其他说明文字。
"""
    raw = await get_llm_answer(prompt, [])
    parsed = _parse_json_from_llm(raw)
    if not parsed:
        return await get_llm_answer(
            f"请对以下案情进行风险评估，包括风险等级、影响说明及应对建议：\n\n{case_summary}",
            [],
        )
    lines = [
        f"**案件类型**：{parsed.get('case_type', '')}",
        f"**核心争议点**：{'；'.join(parsed.get('core_disputes', [])) or '见案情摘要'}",
        f"**潜在风险点**：{'；'.join(parsed.get('risk_points', [])) or '见下方'}",
        "",
        "**多维度评估**",
        "---",
    ]
    dims = parsed.get("dimensions") or {}
    for k, v in [("legal", "法律风险"), ("evidence", "证据风险"), ("timeliness", "时效风险"), ("execution", "执行风险")]:
        if dims.get(k):
            lines.append(f"- {v}：{dims[k]}")
    lines.extend([
        "",
        f"**综合风险等级**：{parsed.get('risk_level', '')}",
        f"**风险影响说明**：{parsed.get('impact', '')}",
        "",
        "**应对建议**",
        "---",
    ])
    for s in parsed.get("suggestions") or []:
        lines.append(f"- {s}")
    return "\n".join(lines)


async def execute_action(action: str, case_summary: str, analysis: dict) -> str:
    """
    执行后续操作：文书生成、行动指引、风险评估
    """
    if action == "行动指引":
        return await _generate_action_guidance(case_summary, analysis)
    if action == "风险评估":
        return await _generate_risk_assessment(case_summary, analysis)

    # 文书生成：给出可参考的起诉状/申请书等文书要点或模板框架
    prompt = f"""你是一名专业法律助手。用户已完成案情分析，现选择「{action}」。

案情摘要：{case_summary}

已有分析结论：{json.dumps(analysis, ensure_ascii=False)}

请给出可参考的起诉状/申请书等文书要点或模板框架，专业、实用。
"""
    return await get_llm_answer(prompt, [])
