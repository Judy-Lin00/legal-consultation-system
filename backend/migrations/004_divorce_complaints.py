"""离婚纠纷起诉状集合：存储用户填写的离婚起诉状表单数据"""
from pymongo.database import Database


def up(db: Database) -> None:
    if "divorce_complaints" not in db.list_collection_names():
        db.create_collection("divorce_complaints")
        print("  ✓ 创建集合: divorce_complaints")

    complaints = db["divorce_complaints"]
    complaints.create_index([("user_id", 1), ("updated_at", -1)])
    complaints.create_index([("session_id", 1)])
    complaints.create_index([("status", 1)])
    print("  ✓ 创建索引: divorce_complaints")
