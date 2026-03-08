"""OCR 文字提取服务"""
from PIL import Image
import io

# 按需导入
def extract_text_from_image(image_bytes: bytes) -> str:
    """
    从图片中提取文字
    需要安装: pip install pytesseract Pillow
    系统需安装 Tesseract: brew install tesseract (macOS)
    """
    try:
        import pytesseract
        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img, lang="chi_sim+eng")
        return text.strip()
    except ImportError:
        return "[pytesseract 未安装]"
    except Exception as e:
        return f"[OCR 提取失败: {e}]"
