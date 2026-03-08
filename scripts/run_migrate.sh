#!/bin/bash
# 执行数据库迁移
# 用法: ./scripts/run_migrate.sh  或  bash scripts/run_migrate.sh

cd "$(dirname "$0")/../backend"

if [ -d "venv" ]; then
  source venv/bin/activate
fi

python scripts/migrate.py
