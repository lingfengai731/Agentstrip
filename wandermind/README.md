# WanderMind · 游心

> **AI 多智能体旅行规划平台** — 为每一次旅行赋予灵魂

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📖 产品简介

WanderMind（游心）是一款 AI 原生旅行规划平台，通过**多智能体协同**提供沉浸式旅行规划体验。无论是巴厘岛蜜月、京都文化深度游，还是临时起意输入任意目的地，WanderMind 都能在几秒内给出专业建议。

**核心差异化：**
- 🤖 **6 个专属 AI 智能体**并行协同，覆盖行程规划 / 住宿 / 美食 / 活动 / 预算 / 实时搜索
- 🧠 **旅行偏好记忆**，AI 记住你的风格、预算、同行人数，对话越多越懂你
- ⚡ **真并行多 Agent 模式**，一键让 3 位专家同时作答，汇总最佳方案
- 🌍 **任意目的地动态面板**，输入任何城市 AI 自动生成当地天气 / 时区 / 推荐区域 / 旅行贴士
- 🏨 **实时酒店比价**（SerpAPI Google Hotels），直接在面板内查看真实房价并跳转预订
- 🌐 **5 语言切换**（中文 / English / 日本語 / 한국어 / Bahasa Indonesia）
- 📱 **PWA 支持**，可安装到手机主屏幕，离线可用

---

## ✨ 功能列表

| 功能 | 说明 |
|------|------|
| AI 对话 | 流式 SSE 输出，实时打字效果，支持联网搜索 |
| 多 Agent 角色切换 | 旅程规划师 / 住宿顾问 / 美食探索家 / 活动策划师 / 预算管家 / 实时搜索 |
| ⚡ 问全队 | 3 位专家真并行作答（asyncio.gather），合并展示 |
| ⚡/🎯 快慢双轨 | ⚡ Fast (SiliconFlow Qwen2.5-7B 免费) ｜ 🎯 Pro (MiMo)，前端 toggle 切换 |
| 平行宇宙预览 | 同一问题生成 3 套截然不同的旅行方案 |
| 目的地面板 | 实时天气、汇率、当季信息、推荐区域、旅行贴士 |
| 任意目的地 | 输入任何城市 → AI 生成完整面板数据 + 本地时钟 |
| 💰 比价 Tab | 右栏独立 tab，子页签切换酒店/机票 |
| 🏨 酒店比价 + 区域筛选 | 预设 4 大目的地共 25 个住宿区 chips；自定义目的地 AI 动态生成 6 区 |
| ✈️ 机票比价 | SerpAPI Google Flights，8 城下拉 + 自由输入城市，往返/单程 |
| ✏️ AI 行程修改助手 | 行程生成后出现 4 个修改 chip，AI 只调整指定部分保留其他 |
| 行程时间轴 | 自动生成每日行程卡片，支持 PDF 导出 |
| 智能预算计算器 | 按目的地 / 天数 / 人数 / 风格估算全程预算 |
| 旅行偏好记忆 | 保存预算档次 / 旅行风格 / 同行方式，注入每次 AI 对话 |
| 地图探索 | SVG 交互地图，POI 标注，人流热力图（按小时） |
| 对话历史 | 云端保存，跨设备同步，随时继续上次规划 |
| 游记生成 | AI 一键生成小红书 / 朋友圈风格旅行游记 |
| 本地司机推荐 | 巴厘岛专属：Dicky 司机联系卡片（WhatsApp / 微信 / 小红书） |
| Agent 日志 | 实时显示每次 AI 调用链路和网络搜索状态 |
| PWA | 可安装、Service Worker 缓存 Shell |

---

## 🏗️ 技术架构

```
wandermind/
├── backend/
│   ├── main.py          # FastAPI 后端 — 全部 API 逻辑 + Studio 挂载
│   ├── db.py            # 数据库兼容层（SQLite ↔ PostgreSQL 自动切换）
│   └── requirements.txt
├── frontend/
│   └── index.html       # 单文件前端 (~6300 行) — 核心应用 UI
├── .env                 # API 密钥（不上传 GitHub）
├── start.bat            # 一键启动脚本
└── README.md
```

**同源部署**：后端通过 `app.mount("/", StaticFiles(...))` 把同仓库的
`wandermind-studio/frontend/` 托管在**根路径**。老的单页 AI 应用从 `/` 移到 `/app`，
保留老书签的兼容性。Clean URL 中间件让 `/about` 自动映射到 `about.html`。
**两个产品共享同一个 FastAPI 进程 + 同一个 PostgreSQL 数据库**，单一账号互通。

### 后端
| 组件 | 说明 |
|------|------|
| **FastAPI** | 异步 HTTP 框架，支持 SSE 流式输出 |
| **PostgreSQL / SQLite** | `db.py` 自动选择 — 生产 PG（Neon），本地 SQLite |
| **JWT (自实现)** | 无第三方依赖的 HS256 token 认证 |
| **MiMo API** | 小米 MiMo-v2.5-Pro，OpenAI 兼容格式 |
| **Tavily** | 联网搜索（触发关键词：签证/天气/价格/最新…） |
| **SerpAPI** | Google Hotels / Flights 真实价格 |
| **asyncio.gather** | 多 Agent 真并行执行 |

### 前端
| 特性 | 说明 |
|------|------|
| 零框架 | 纯原生 JS + CSS，无 React/Vue 依赖，加载极快 |
| SSE 流式 | EventSource 逐字输出，requestAnimationFrame 动画 |
| 多语言 | LANGS 对象 + applyLang() 全量切换 |
| 响应式 | PC / 平板 / 移动端自适应，移动端底部导航栏 |
| PWA | manifest.json + sw.js，可安装到主屏幕 |

---

## 🚀 快速开始

### 前置要求
- Python 3.11+
- pip

### 1. 克隆仓库
```bash
git clone https://github.com/lingfengai731/Agentstrip.git
cd Agentstrip/wandermind
```

### 2. 安装依赖
```bash
pip install fastapi uvicorn httpx python-dotenv
```

### 3. 配置环境变量
在 `wandermind/` 目录下创建 `.env` 文件：
```env
# MiMo AI（必填）
API_KEY=你的MiMo_API_Key
CHAT_URL=https://api.xiaomimimo.com/v1/chat/completions
MODEL=mimo-v2.5-pro

# JWT 签名密钥（建议修改）
SECRET_KEY=your-secret-key-here

# Tavily 联网搜索（可选，免费 1000次/月）
# 申请：https://app.tavily.com
TAVILY_API_KEY=

# SerpAPI 酒店比价（可选，免费 250 次/月）
# 申请：https://serpapi.com
SERPAPI_KEY=

# SerpAPI 机票比价（可选，建议另开一个账号将额度翻倍至 500/月）
# 留空则会复用 SERPAPI_KEY
SERPAPI_FLIGHTS_KEY=

# SiliconFlow ⚡ 极速通道（可选，完全免费）
# 注册：https://siliconflow.cn，免费模型推荐 Qwen/Qwen2.5-7B-Instruct
# 未配置时前端 ⚡ Fast 按钮会自动 fallback 到 MiMo
SILICONFLOW_KEY=
SILICONFLOW_URL=https://api.siliconflow.cn/v1/chat/completions
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct

# 📧 邮件系统（可选，欢迎信 + 密码重置）
# 注册：https://resend.com（免费 3000 封/月，100/天）
# 未配置时邮件功能在开发模式：内容会打印到 stdout，不实际发送
RESEND_API_KEY=
# 发件人。开发期可用 Resend 默认 onboarding@resend.dev（仅能发到注册账号邮箱）。
# 上线后配置自己的域名后改成 "WanderMind <noreply@你的域名.com>"
EMAIL_FROM=WanderMind <onboarding@resend.dev>
# 邮件链接里使用的 base URL。未设置时自动从请求头检测（推荐留空）
# PUBLIC_URL=https://你的域名.com
```

### 4. 启动服务
```bash
# 方法一：直接运行
cd backend
python -m uvicorn main:app --port 8000 --reload

# 方法二：Windows 双击 start.bat
```

### 5. 访问应用
打开浏览器访问：`http://localhost:8000`

---

## 🔑 API 文档

启动后访问 `http://localhost:8000/docs` 查看完整 Swagger 文档。

### 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（同时发欢迎邮件） |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET  | `/api/auth/me` | 当前用户信息 |
| POST | `/api/auth/forgot-password` | 发送密码重置链接（永远返回相同消息，防枚举） |
| POST | `/api/auth/reset-password` | 用重置 token 设置新密码，返回新 JWT 自动登录 |
| POST | `/api/share/create` | 创建公开分享 token |
| GET  | `/api/share/{token}` | 公开获取分享内容（view+1） |
| DELETE | `/api/share/{token}` | 撤销分享（仅作者） |
| POST | `/api/share/{token}/fuse` | 访客提交偏好 → AI 融合两人偏好，返回 fusion token |
| GET  | `/api/fusion/{token}` | 公开获取融合方案（含源行程上下文） |
| POST | `/api/chat` | SSE 流式对话（含联网搜索） |
| POST | `/api/chat/team` | 3 Agent 并行作答（SSE） |
| POST | `/api/dest_info` | AI 生成目的地面板数据 |
| POST | `/api/search/hotels` | SerpAPI 查询酒店实时价格 |
| POST | `/api/search/flights` | SerpAPI Google Flights 查询机票实时价格 |
| GET  | `/api/user/preferences` | 获取旅行偏好 |
| POST | `/api/user/preferences` | 保存旅行偏好 |
| GET  | `/api/conversations` | 对话历史列表 |
| POST | `/api/conversations` | 保存/更新对话 |

### 酒店搜索接口
```http
POST /api/search/hotels
Authorization: Bearer <token>
Content-Type: application/json

{
  "destination": "Bali",
  "check_in": "2026-07-01",
  "check_out": "2026-07-04",
  "adults": 2,
  "lang": "zh"
}
```

响应：
```json
{
  "destination": "Bali",
  "hotels": [
    {
      "name": "The Mulia Bali",
      "price": "¥2,800",
      "rating": 4.8,
      "reviews": 3421,
      "link": "https://...",
      "thumbnail": "https://...",
      "amenities": ["Pool", "WiFi", "Breakfast", "Spa"]
    }
  ]
}
```

---

## 🌐 部署（Render）

1. Push 代码到 GitHub（`.env` 已在 `.gitignore` 中，不会上传）
2. 在 [Render.com](https://render.com) 创建 Web Service
3. Build Command: `pip install -r backend/requirements.txt`
4. Start Command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
5. 在 Render 的 Environment Variables 面板设置所有 `.env` 中的变量
6. **强烈建议**：配置 `DATABASE_URL` 切换到 PostgreSQL（见下方）

> ⚠️ **安全提示**：API 密钥只能设置在 Render 环境变量中，绝对不能硬编码到代码里或提交到 Git

---

## 🗄️ 数据库迁移到 PostgreSQL（生产必做）

### ⚠️ 为什么必须迁移？

- 默认的 SQLite 文件 (`wandermind.db`) 存在 Render 容器内
- Render 实例**重启 / 重新部署时整个文件系统会被重置** → 所有用户数据丢失
- 哪怕只是 push 一次代码触发自动部署，注册用户和对话历史就全没了

### 兼容层设计

后端通过 `backend/db.py` 自动选择数据库：

```
┌─ 环境变量 DATABASE_URL 是否存在？
│
├─ 是 → 使用 PostgreSQL（生产）
└─ 否 → 使用本地 SQLite 文件（开发）
```

业务代码完全相同，零侵入。

### 推荐数据库服务（按优先级）

| 服务 | 免费额度 | 优缺点 | 推荐场景 |
|------|---------|-------|---------|
| **Neon** ([neon.tech](https://neon.tech)) | 3 GB 永久免费 | 自动扩缩、Serverless、无信用卡 | ⭐ 个人 / 初创首选 |
| **Supabase** ([supabase.com](https://supabase.com)) | 500 MB 永久免费 | 自带管理后台、Auth/Storage 全套 | 长期项目 |
| **Render PostgreSQL** | 1 GB / 30 天到期 | 同平台延迟低 | 测试用，过期需重建 |

### 迁移步骤（以 Neon 为例）

1. **创建数据库**
   - 访问 [console.neon.tech](https://console.neon.tech)，注册并新建项目
   - 选 Region：US East（与 Render 同区域延迟最低）
   - 复制 Connection String，格式形如：
     ```
     postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/wandermind?sslmode=require
     ```

2. **配置 Render 环境变量**
   - Render Dashboard → 你的 Web Service → Environment
   - 添加 Key: `DATABASE_URL`，Value: 上面复制的连接串
   - Save 后 Render 会自动重新部署

3. **首次部署自动建表**
   - `db.py` 在启动时调用 `init_db()` 自动 `CREATE TABLE IF NOT EXISTS`
   - 日志会打印 `[wandermind] DB backend: postgres` 表示连接成功

4. **本地继续用 SQLite 调试**
   - 本地不设置 `DATABASE_URL` 即可，零配置切换

### 已有用户数据迁移（可选）

如果旧 SQLite 里已有真实用户（可能性低，因为重启就丢了）：

```bash
# 1. 从 SQLite 导出
sqlite3 wandermind.db .dump > backup.sql

# 2. 手动整理为 PostgreSQL 兼容语法（去掉 PRAGMA、BEGIN TRANSACTION 等）

# 3. 导入 Neon
psql "postgresql://user:pass@..." < backup.sql
```

---

## 🗺️ 已支持目的地

| 目的地 | 语言 | 特色 |
|--------|------|------|
| 🌺 巴厘岛（Bali） | ZH/EN/JA/KO/ID | 本地司机 Dicky 推荐、冲浪景点热力图 |
| 🌸 京都（Kyoto） | ZH/EN/JA/KO/ID | 茶道、神社、赏樱路线 |
| 🗼 巴黎（Paris） | ZH/EN/JA/KO/ID | 艺术、美食、埃菲尔铁塔 |
| 🏝️ 圣托里尼（Santorini） | ZH/EN/JA/KO/ID | 日落、白色建筑、爱琴海 |
| ✨ **任意城市** | 5语言动态生成 | AI 实时生成面板数据 |

---

## 🔒 安全说明

- `.env` 文件已加入 `.gitignore`，不会上传到 GitHub
- `*.db` 数据库文件也不上传
- JWT token 有效期 7 天，密码使用 PBKDF2-SHA256 + 随机盐存储
- 所有 API 接口需要认证（`Authorization: Bearer <token>`）

---

## 🛣️ 路线图

- [x] 多 Agent 流式对话
- [x] 真并行多 Agent 问全队
- [x] 旅行偏好记忆
- [x] 任意目的地动态面板
- [x] 酒店实时比价（SerpAPI）
- [x] 机票实时比价（SerpAPI Google Flights）
- [x] AI 行程修改助手
- [x] 快慢双轨（SiliconFlow Qwen2.5-7B + MiMo Pro）
- [x] 5 语言国际化
- [x] PWA 支持
- [x] **WanderMind Studio** 多页面品牌网站（同根目录 `/`）
- [x] **PostgreSQL 持久化**（Neon，解决 Render 重启数据丢失）
- [x] **行程分享链接**（公开只读 `/shared?t=TOKEN`，含 view 计数）
- [x] **Clean URL** 中间件（`/about` 自动映射到 `about.html`）
- [x] **邮件系统**（Resend：注册欢迎信 + 密码重置流程）
- [x] **双人偏好融合**（朋友打开分享链接 → 填偏好 → AI 重新规划 → `/fusion?t=TOKEN`）
- [ ] 微信小程序版本
- [ ] 行程 PDF 导出优化
- [ ] 快慢双轨升级 Groq（极速 < 100ms 首字）

---

## 📄 License

MIT © 2026 WanderMind
