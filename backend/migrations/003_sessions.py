"""咨询会话集合：每个用户多个 session，每个 session 多条对话"""
from pymongo.database import Database


def up(db: Database) -> None:
    if "sessions" not in db.list_collection_names():
        db.create_collection("sessions")
        print("  ✓ 创建集合: sessions")

    sessions = db["sessions"]
    sessions.create_index([("user_id", 1), ("updated_at", -1)])
    sessions.create_index("session_id", unique=True)
    print("  ✓ 创建索引: sessions")
