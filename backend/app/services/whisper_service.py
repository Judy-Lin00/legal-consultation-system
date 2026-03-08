"""Whisper 语音识别服务"""
import tempfile
from pathlib import Path

# 按需导入，避免未安装 whisper 时启动失败
_whisper_model = None


def transcribe_audio(audio_path: str) -> str:
    """
    使用 Whisper 将音频转为文字
    需要先安装: pip install openai-whisper
    """
    try:
        import whisper
        global _whisper_model
        if _whisper_model is None:
            _whisper_model = whisper.load_model("base")
        result = _whisper_model.transcribe(audio_path, language="zh")
        return result.get("text", "").strip()
    except ImportError:
        return "[Whisper 未安装，请运行 pip install openai-whisper]"
    except Exception as e:
        return f"[语音识别失败: {e}]"
