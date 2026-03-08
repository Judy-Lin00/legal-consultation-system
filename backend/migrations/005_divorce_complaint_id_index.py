"""为 divorce_complaints 添加 complaint_id 唯一索引"""
from pymongo.database import Database


def up(db: Database) -> None:
    complaints = db["divorce_complaints"]
    try:
        complaints.create_index("complaint_id", unique=True)
        print("  ✓ 创建索引: divorce_complaints.complaint_id")
    except Exception as e:
        if "already exists" in str(e).lower():
            print("  ✓ 索引已存在: divorce_complaints.complaint_id")
        else:
            raise
