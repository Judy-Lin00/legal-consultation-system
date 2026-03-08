"""
初始迁移：创建集合与索引
新增集合或字段时，在此文件追加或创建新的迁移文件（002_xxx.py）
"""
from pymongo.database import Database


def up(db: Database) -> None:
    """执行迁移"""
    # 咨询记录集合
    if "consultations" not in db.list_collection_names():
        db.create_collection("consultations")
        print("  ✓ 创建集合: consultations")

    # 用户集合（预留）
    if "users" not in db.list_collection_names():
        db.create_collection("users")
        print("  ✓ 创建集合: users")

    # 咨询记录索引：按会话与时间查询
    consultations = db["consultations"]
    consultations.create_index([("session_id", 1), ("created_at", -1)])
    consultations.create_index([("created_at", -1)])
    print("  ✓ 创建索引: consultations")
