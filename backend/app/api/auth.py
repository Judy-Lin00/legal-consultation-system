"""认证 API"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.connection import get_db
from app.core.deps import get_current_user_id

router = APIRouter()
security = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=32)
    password: str = Field(..., min_length=6, max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    """注册"""
    db = get_db()
    users = db["users"]

    if users.find_one({"email": req.email.lower()}):
        raise HTTPException(status_code=400, detail="该邮箱已被注册")
    if users.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="该用户名已被使用")

    user_doc = {
        "email": req.email.lower(),
        "username": req.username,
        "hashed_password": hash_password(req.password),
    }
    result = users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(user_id)
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "email": req.email, "username": req.username},
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """登录"""
    db = get_db()
    user = db["users"].find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_access_token(str(user["_id"]))
    return TokenResponse(
        access_token=token,
        user={
            "id": str(user["_id"]),
            "email": user["email"],
            "username": user["username"],
        },
    )


@router.get("/me")
async def me(user_id: str = Depends(get_current_user_id)):
    """获取当前用户信息（需登录）"""
    from bson import ObjectId

    db = get_db()
    user = db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "username": user["username"],
    }
