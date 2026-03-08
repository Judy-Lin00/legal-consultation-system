"""用户集合索引：邮箱、用户名唯一"""
from pymongo.database import Database


def up(db: Database) -> None:
    users = db["users"]
    users.create_index("email", unique=True)
    users.create_index("username", unique=True)
    print("  ✓ 创建索引: users (email, username unique)")
