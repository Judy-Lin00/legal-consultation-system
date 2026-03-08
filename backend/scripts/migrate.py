#!/usr/bin/env python3
"""
数据库迁移脚本
新增字段或建表时执行此脚本：python scripts/migrate.py
从 backend 目录运行：cd backend && python scripts/migrate.py
"""
import sys
from pathlib import Path
from typing import Callable

# 确保 backend 为工作目录，以便导入 app
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from pymongo.database import Database

from app.core.config import settings
from app.db.connection import get_db


def load_migrations() -> list[tuple[str, Callable]]:
    """加载 migrations 目录下的迁移文件"""
    migrations_dir = backend_dir / "migrations"
    if not migrations_dir.exists():
        return []

    migrations = []
    for path in sorted(migrations_dir.glob("*.py")):
        if path.name.startswith("_"):
            continue
        name = path.stem
        try:
            # 动态导入迁移模块
            import importlib.util
            spec = importlib.util.spec_from_file_location(f"migrations.{name}", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "up"):
                migrations.append((name, mod.up))
        except Exception as e:
            print(f"  ✗ 加载迁移 {name} 失败: {e}")
            raise
    return migrations


def run_migrations(db: Database) -> None:
    """执行未应用的迁移"""
    migrations = load_migrations()
    if not migrations:
        print("没有待执行的迁移")
        return

    applied = set(
        doc["name"] for doc in db["_migrations"].find({}, {"name": 1})
    )

    for name, up_fn in migrations:
        if name in applied:
            print(f"  跳过（已应用）: {name}")
            continue
        print(f"  执行: {name}")
        try:
            up_fn(db)
            db["_migrations"].insert_one({"name": name})
            print(f"  ✓ 完成: {name}")
        except Exception as e:
            print(f"  ✗ 失败: {name} - {e}")
            raise


def main() -> None:
    print("=" * 50)
    print("法律咨询系统 - 数据库迁移")
    print("=" * 50)
    print(f"MongoDB: {settings.MONGODB_URL}")
    print(f"数据库: {settings.MONGODB_DB}")
    print("-" * 50)

    try:
        db = get_db()
        db.command("ping")
        print("✓ 数据库连接成功")
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        sys.exit(1)

    print("-" * 50)
    run_migrations(db)
    print("-" * 50)
    print("迁移完成")


if __name__ == "__main__":
    main()
