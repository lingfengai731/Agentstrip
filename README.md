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
- 📱 **PWA 支持**，可安装到手机主屏幕

---

## ✨ 功能列表

| 功能 | 说明 |
|------|------|
| AI 对话 | 流式 SSE 输出，实时打字效果，支持联网搜索 |
| 多 Agent 角色切换 | 旅程规划师 / 住宿顾问 / 美食探索家 / 活动策划师 / 预算管家 / 实时搜索 |
| ⚡ 问全队 | 3 位专家真并行作答（asyncio.gather），合并展示 |
| 平行宇宙预览 | 同一问题生成 3 套截然不同的旅行方案 |
| 目的地面板 | 实时天气、汇率、当季信息、推荐区域、旅行贴士 |
| 任意目的地 | 输入任何城市 → AI 生成完整面板数据 + 本地时钟 |
| 🏨 酒店比价 | SerpAPI 搜索真实房价，支持入住 / 退房日期及人数筛选 |
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

## 🏗️ 项目结构

```
Agentstrip/
└── wandermind/              # WanderMind 旅行平台
    ├── backend/
    │   └── main.py          # FastAPI 后端 — 全部 API 逻辑
    ├── frontend/
    │   └── index.html       # 单文件前端 (~6300 行)
    ├── .env                 # API 密钥（不上传 GitHub）
    ├── start.bat            # 一键启动脚本
    └── README.md            # 详细文档
```

---

## 🚀 快速开始

```bash
git clone https://github.com/lingfengai731/Agentstrip.git
cd Agentstrip/wandermind
pip install fastapi uvicorn httpx python-dotenv
# 配置 .env 文件（见 wandermind/README.md）
cd backend && python -m uvicorn main:app --port 8000 --reload
```

浏览器访问 `http://localhost:8000`

**详细文档** → [wandermind/README.md](wandermind/README.md)

---

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.11 · FastAPI · SQLite · JWT |
| AI | MiMo v2.5-Pro (OpenAI-compatible) |
| 搜索 | Tavily Web Search · SerpAPI Google Hotels |
| 前端 | 原生 JS + CSS · SSE 流式 · PWA |
| 部署 | Render |

---

## 🔒 安全说明

`.env` 文件已加入 `.gitignore`，API 密钥不会上传到 GitHub。

---

## 📄 License

MIT © 2026 WanderMind
