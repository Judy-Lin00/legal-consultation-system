"""MongoDB 连接"""
from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

_client: Optional[MongoClient] = None


def get_db() -> Database:
    """获取数据库实例"""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URL)
    return _client[settings.MONGODB_DB]


def get_database() -> Database:
    """get_db 的别名"""
    return get_db()
