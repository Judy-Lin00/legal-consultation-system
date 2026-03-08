#!/bin/bash
# 法律咨询系统 - 一键启动前后端
# 用法: ./start.sh  或  bash start.sh

set -e
cd "$(dirname "$0")"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "正在停止服务..."
  [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "=========================================="
echo "  法律咨询系统 - 一键启动"
echo "=========================================="

# 启动后端
echo ""
echo "[1/2] 启动后端..."
if [ -d "backend/venv" ]; then
  source backend/venv/bin/activate
  cd backend
  uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
  cd ..
  echo "  后端已启动 (PID: $BACKEND_PID) -> http://localhost:8000"
else
  echo "  错误: 未找到 backend/venv，请先创建虚拟环境"
  echo "  cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# 等待后端就绪
sleep 2

# 启动前端
echo ""
echo "[2/2] 启动前端..."
cd frontend
if [ -d "node_modules" ]; then
  npm run dev &
  FRONTEND_PID=$!
  cd ..
  echo "  前端已启动 (PID: $FRONTEND_PID) -> http://localhost:5173"
else
  echo "  错误: 未找到 node_modules，请先安装依赖"
  echo "  cd frontend && npm install"
  cd ..
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "=========================================="
echo "  服务已启动"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8000"
echo "  API 文档: http://localhost:8000/docs"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="

wait
