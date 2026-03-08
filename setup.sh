#!/bin/bash
# 法律咨询系统 - 环境安装脚本

set -e
cd "$(dirname "$0")"

echo "=== 1. 前端依赖 ==="
cd frontend
npm install
cd ..

echo ""
echo "=== 2. 后端 Python 虚拟环境 ==="
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
cd ..

echo ""
echo "=== 完成 ==="
echo "请按以下步骤启动："
echo "  1. MongoDB: brew services start mongodb-community  (或使用 Docker)"
echo "  2. 后端: cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "  3. 前端: cd frontend && npm run dev"
echo ""
echo "可选：安装 Whisper 语音识别: pip install openai-whisper"
echo "可选：安装 Tesseract OCR: brew install tesseract tesseract-lang"
