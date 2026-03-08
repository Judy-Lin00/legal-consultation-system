"""文书下载临时存储集合"""
from pymongo.database import Database


def up(db: Database) -> None:
    if "document_downloads" not in db.list_collection_names():
        db.create_collection("document_downloads")
        print("  ✓ 创建集合: document_downloads")
    coll = db["document_downloads"]
    coll.create_index([("user_id", 1), ("created_at", -1)])
    coll.create_index("doc_id", unique=True)
    print("  ✓ 创建索引: document_downloads")
