# WanderMind Studio

> WanderMind 的官方多页面网站 + AI 旅行规划工作台

[![Bootstrap](https://img.shields.io/badge/Bootstrap-4-7952B3?logo=bootstrap)](https://getbootstrap.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)

---

## 📄 页面结构

```
wandermind-studio/
└── frontend/
    ├── index.html        # 首页 — 品牌展示、功能亮点、CTA
    ├── about.html        # 关于我们 — 团队、6 AI 智能体介绍、数据面板
    ├── services.html     # 探索目的地 — 4 大目的地精选展示
    ├── ai-tool.html      # AI 工作台 — 完整旅行规划工作台（核心页面）
    ├── contact.html      # 联系我们
    └── assets/
        ├── css/
        │   ├── style-starter.css   # 模板基础样式（已扩展）
        │   └── ai-tool.css         # 工作台专属样式
        ├── js/
        │   ├── ai-tool.js          # 工作台核心逻辑（~2700 行）
        │   └── i18n.js             # 5 语言翻译表
        └── images/
            └── logo-mark.png       # 品牌 logo
```

---

## ✨ AI 工作台功能（ai-tool.html）

### 布局

桌面端三栏：左侧栏 / 主聊天区 / 右功能栏

```
┌─────────────────────────────────────────────────────┐
│  导航栏（5语言 · 深色模式 · 搜索 · 登录注册）          │
├──────────────┬──────────────────┬────────────────────┤
│  左侧栏      │   主聊天区        │   右功能栏          │
│  • 目的地选择│   • AI 对话       │   标签页切换：      │
│  • Trip 列表 │   • 问全队按钮    │   📍 目的地速览     │
│  • 旅行偏好  │   • 行程修改助手  │   🏨 酒店比价       │
│              │                  │   ✈️ 机票比价       │
│              │                  │   🗺️ 地图探索      │
│              │                  │   💰 预算计算器     │
└──────────────┴──────────────────┴────────────────────┘
```

手机端（≤991px）：主聊天区全屏，左栏 / 右栏变为抽屉式弹出

### 功能清单

| 模块 | 功能 |
|------|------|
| **AI 对话** | SSE 流式打字，6 AI 角色切换（规划师 / 住宿 / 美食 / 活动 / 预算 / 搜索） |
| **问全队** | 3 Agent 并行作答，独立卡片展示 |
| **目的地速览** | 实时天气（OpenWeather）· 本地时钟 · 推荐区域 · 旅行贴士（动态/静态双模式） |
| **酒店比价** | SerpAPI Google Hotels · 区域 chips 筛选 · 评分 / 缩略图 / 设施 |
| **机票比价** | SerpAPI Google Flights · 8 城市下拉 + 自由输入 · 往返/单程 |
| **探索地图** | SVG 交互地图 · POI 按类别着色 · 24h 人流热力图 |
| **预算计算器** | 按目的地 / 天数 / 人数 / 风格 / 出发城市估算全程预算 |
| **平行宇宙** | 同一旅行 3 套方案并排对比（节俭 / 平衡 / 奢华） |
| **行程管理** | Trip 创建 / 切换 / 持久化（localStorage） |
| **旅行偏好** | 预算档次 · 旅行风格 · 同行方式，注入每次 AI 对话 |
| **游记生成** | AI 一键生成第一人称旅行游记 |
| **登录注册** | Modal 弹窗，JWT 认证，接入后端 `agentstrip.onrender.com` |
| **深色模式** | CSS 变量切换，记忆用户偏好（localStorage） |
| **5 语言** | 中文 · English · 日本語 · 한국어 · Bahasa Indonesia，所有 UI 同步 |

---

## 📱 响应式适配

| 断点 | 布局 |
|------|------|
| `≥ 1200px`（xl） | 三栏全展开，邮箱地址完整显示 |
| `992–1199px`（lg） | 三栏（240px / 1fr / 320px），邮箱仅显示图标节省空间 |
| `≤ 991px`（md/sm） | 单栏，左栏 / 右栏抽屉弹出，顶部 Mobile Bar 切换按钮 |
| `≤ 767px` | 地图切换为单列，卡片垂直堆叠 |

市场页（index / about / services / contact）：Bootstrap 4 标准响应式栅格

---

## 🔗 后端 API

Studio 工作台调用的后端 API 部署于：

```
https://agentstrip.onrender.com
```

如需修改后端地址，在 `ai-tool.js` 顶部设置：

```javascript
window.WM_BACKEND = 'https://your-backend.onrender.com';
```

主要接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/chat` | SSE 流式对话 |
| POST | `/api/chat/team` | 3 Agent 并行 |
| POST | `/api/dest_info` | 目的地数据生成 |
| POST | `/api/search/hotels` | Google Hotels 实时价格 |
| POST | `/api/search/flights` | Google Flights 实时价格 |
| GET  | `/api/weather` | OpenWeather 实时天气 |
| POST | `/api/user/preferences` | 旅行偏好存取 |

完整 API 文档见：**[wandermind/README.md](../wandermind/README.md)**

---

## 🚀 本地预览

Studio 是纯静态站点，直接用浏览器打开 HTML 文件即可：

```bash
# 方法一：直接打开
open wandermind-studio/frontend/index.html

# 方法二：本地 HTTP 服务（推荐，避免跨域限制）
cd wandermind-studio/frontend
python -m http.server 3000
# 浏览器访问 http://localhost:3000
```

> 工作台 AI 功能需要后端服务正常运行（本地启动或连接 Render 在线服务）

---

## 🌐 部署（Render Static Site）

1. Push 代码到 GitHub
2. 在 [Render.com](https://render.com) 创建 **Static Site**
3. Root Directory 设置为：`wandermind-studio/frontend`
4. Publish Directory 留空（直接发布根目录）
5. 无需 Build Command

> 后端 API 需单独部署，见 [wandermind/README.md](../wandermind/README.md)

---

## 🎨 技术选型

| 方面 | 选择 | 理由 |
|------|------|------|
| CSS 框架 | Bootstrap 4 | 响应式栅格、导航组件成熟 |
| 工作台 JS | 原生 JS（无框架） | 零构建、加载极快、可直接部署静态站 |
| 主题切换 | CSS 变量 + class toggle | 无闪烁切换，无额外依赖 |
| 国际化 | `i18n.js` LANGS 对象 | 简单高效，无需 i18n 库 |
| 流式 AI | SSE（EventSource） | 逐字打字效果，低延迟 |
| 图标 | Font Awesome 5 + gg-icons | 导航图标 + 深色模式切换图标 |

---

## 📄 License

MIT © 2026 WanderMind
