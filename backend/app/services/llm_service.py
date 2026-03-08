"""大模型服务 - 支持 DeepSeek、Dify 及自定义 API"""
import json
import httpx
from app.core.config import settings

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
LEGAL_SYSTEM_PROMPT = (
    "你是专业的法律助手，擅长解释法律法规、解答法律问题。"
    "请根据用户问题提供专业、准确的法律意见，回答应简洁清晰、有理有据。"
    "如涉及具体案件，建议用户咨询执业律师获取正式法律意见。"
)


async def stream_llm_answer(question: str, history: list = None):
    """
    流式获取法律咨询回答（仅 DeepSeek）
    每 yield 一个 chunk 为 SSE 格式: data: {"content": "..."}
    """
    history = history or []
    if not settings.DEEPSEEK_API_KEY:
        yield f'data: {{"content": "（未配置 DEEPSEEK_API_KEY）"}}\n\n'
        return

    messages = [{"role": "system", "content": LEGAL_SYSTEM_PROMPT}]
    for h in history[-6:]:
        role = "user" if h.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": h.get("content", "")})
    messages.append({"role": "user", "content": question})

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "stream": True,
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            timeout=90.0,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                    delta = obj.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content") or ""
                    if content:
                        yield f'data: {{"content": {json.dumps(content, ensure_ascii=False)}}}\n\n'
                except (json.JSONDecodeError, IndexError, KeyError):
                    pass


async def get_llm_answer(question: str, history: list = None) -> str:
    """
    获取法律咨询回答
    优先级：DeepSeek > Dify > 自定义 LLM
    """
    history = history or []

    if settings.DEEPSEEK_API_KEY:
        return await _call_deepseek(question, history)

    if settings.DIFY_API_URL and settings.DIFY_API_KEY:
        return await _call_dify(question, history)

    if settings.LLM_API_URL and settings.LLM_API_KEY:
        return await _call_custom_llm(question, history)

    return (
        f"您的问题：「{question}」\n\n"
        "（当前未配置大模型 API，请在 .env 中配置 DEEPSEEK_API_KEY）"
    )


async def _call_deepseek(question: str, history: list) -> str:
    """调用 DeepSeek API"""
    messages = [{"role": "system", "content": LEGAL_SYSTEM_PROMPT}]
    for h in history[-6:]:
        role = "user" if h.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": h.get("content", "")})
    messages.append({"role": "user", "content": question})

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            timeout=90.0,
        )
        resp.raise_for_status()
        data = resp.json()
        choice = data.get("choices", [{}])[0]
        return choice.get("message", {}).get("content", "无回复")


async def _call_dify(question: str, history: list) -> str:
    """调用 Dify API"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.DIFY_API_URL,
            headers={
                "Authorization": f"Bearer {settings.DIFY_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": {},
                "query": question,
                "response_mode": "blocking",
                "user": "legal-consult-user",
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("answer", data.get("data", {}).get("text", "无回复"))


async def _call_custom_llm(question: str, history: list) -> str:
    """调用自定义大模型 API"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            settings.LLM_API_URL,
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "prompt": question,
                "history": history,
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", data.get("answer", str(data)))
