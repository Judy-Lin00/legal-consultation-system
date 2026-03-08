# 法律咨询系统

基于 React + FastAPI + 法律大模型的法律咨询系统。

## 技术栈

- **前端**: React + Ant Design + Redux Toolkit
- **后端**: Python + FastAPI
- **模型 API**: DeepSeek、Dify、自定义大模型
- **语音识别**: Whisper
- **文字提取**: OCR (pytesseract)
- **数据库**: MongoDB
- **版本控制**: Git

## 环境要求

- Node.js 18+
- Python 3.9+
- MongoDB 6.0+
- Git

## 快速开始

> 环境已配置完成，可直接按以下步骤启动。

### 1. 安装 MongoDB（如未安装）

**macOS (使用 Homebrew):**
```bash
# 1. 若未安装 Homebrew，先安装：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# 安装完成后按提示将 brew 加入 PATH，然后重新打开终端

# 2. 安装并启动 MongoDB
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**或使用 Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### 2. 配置环境变量

```bash
cd backend && cp .env.example .env
```

编辑 `.env`，填入 **DeepSeek API Key**（法律咨询必需）：

| 变量名 | 说明 | 获取地址 |
|--------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | https://platform.deepseek.com/ |

格式示例：`DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx`

### 3. 数据库迁移（建表/新增字段时执行）

```bash
./scripts/run_migrate.sh
# 或: cd backend && python scripts/migrate.py
```

新增集合或字段时，在 `backend/migrations/` 创建迁移文件，详见该目录下的 README。

### 4. 一键启动前后端

```bash
./start.sh
```

或分别启动：

```bash
# 后端
cd backend && source venv/bin/activate && uvicorn main:app --reload

# 前端（新终端）
cd frontend && npm run dev
```

### 5. 数据模型

- **users**：用户表（登录注册）
- **sessions**：咨询会话表，每个用户多条记录
  - `session_id`：会话唯一标识
  - `user_id`：所属用户
  - `title`：对话摘要
  - `messages`：对话内容 [{ role, content }]
- **divorce_complaints**：离婚纠纷起诉状表
  - `user_id`：所属用户
  - `session_id`：关联咨询会话
  - `plaintiff`：原告信息（姓名、性别、出生日期等）
  - `defendant`：被告信息
  - `agent`：委托诉讼代理人
  - `litigation_requests`：诉讼请求（财产、债务、抚养等）
  - `facts_and_reasons`：事实与理由
  - 详见 `docs/离婚纠纷起诉状_schema.json`

### 6. 访问

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

### 可选：语音识别与 OCR

- **Whisper**: `pip install openai-whisper`（体积较大）
- **Tesseract OCR**: `brew install tesseract tesseract-lang`（macOS）
