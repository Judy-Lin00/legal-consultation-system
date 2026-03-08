# 数据库迁移

新增集合或字段时，在此目录创建迁移文件。

## 命名规则

`{序号}_{描述}.py`，例如：`002_add_user_profile.py`

## 迁移文件格式

```python
from pymongo.database import Database

def up(db: Database) -> None:
    """执行迁移"""
    # 创建新集合
    if "new_collection" not in db.list_collection_names():
        db.create_collection("new_collection")

    # 创建索引
    db["new_collection"].create_index([("field", 1)])

    # 添加字段：MongoDB 无 schema，插入时带上新字段即可
    # 如需批量更新：db["collection"].update_many({}, {"$set": {"new_field": default_value}})
```

## 执行迁移

```bash
# 方式一：从项目根目录
./scripts/run_migrate.sh

# 方式二：从 backend 目录
cd backend && python scripts/migrate.py
```
