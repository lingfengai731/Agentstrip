# WanderMind · 游心

> **AI 多智能体旅行规划平台** — 一句话告诉它你想去哪，6 位 AI 专家立刻为你做完整规划

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-4-7952B3?logo=bootstrap)](https://getbootstrap.com)

---

## 🌐 立即体验

| 入口 | 地址 | 说明 |
|------|------|------|
| 🏠 **首页** | **[https://wandermind.cc](https://wandermind.cc)** | Studio 品牌站首页 |
| 🤖 **AI 工作台** | [https://wandermind.cc/ai-tool](https://wandermind.cc/ai-tool) | 6 AI 智能体规划工作台 |
| 📖 **关于我们** | [https://wandermind.cc/about](https://wandermind.cc/about) | 团队与产品故事 |
| 🌍 **探索目的地** | [https://wandermind.cc/services](https://wandermind.cc/services) | 巴厘岛 · 京都 · 巴黎 · 圣托里尼 |
| 🏝️ **巴厘岛实拍行程** | [https://wandermind.cc/bali](https://wandermind.cc/bali) | 12–14 天真实行程 + 实拍画廊 |
| 🚗 **找当地司机** | [https://wandermind.cc/find-driver](https://wandermind.cc/find-driver) | 隐私优先,直接邮件对接巴厘岛司机 |
| 📩 **联系我们** | [https://wandermind.cc/contact](https://wandermind.cc/contact) | |
| 🔗 **行程分享** | `/shared?t=TOKEN` | 用户生成的公开只读链接 |
| ⚡ **老 AI 应用**（兼容） | [https://wandermind.cc/app](https://wandermind.cc/app) | 原始单页极简版 |

> 💡 **所有页面共享同一后端 + 同一 Neon Postgres 数据库**，同一账号互通登录。
> **手机浏览器直接访问**，无需下载 App。正式域名 **wandermind.cc** 已上线（HTTPS）。

---

## 📦 项目结构

本仓库是 WanderMind 的 monorepo，包含三个子项目：

```
Agentstrip/
├── wandermind-studio/    # 🆕 WanderMind Studio — 官方网站 + AI 工作台（静态多页面）
├── wandermind/           # ⚡ WanderMind 核心后端 — FastAPI + 6 AI 智能体
└── miniprogram/          # 📱 微信小程序（开发中）
```

---

## 📊 项目进度

### ✅ 已完成

| 模块 | 内容 | 状态 |
|------|------|------|
| 🏠 Studio 营销站 | 首页 / 关于 / 探索目的地 / 联系 四页，5 语言、深色模式、响应式 | ✅ |
| 🤖 AI 工作台 | 6 智能体、SSE 流式对话、顶部 5 Tab、快慢双模式 | ✅ |
| 🌤️ 目的地情报 | 实时天气（OpenWeather）、汇率、季节、区域、贴士 | ✅ |
| 🏨 机酒比价 | SerpAPI 酒店 & 机票，预设 + 任意城市 | ✅ |
| 🧩 工作台工具 | 平行宇宙、探索地图、预算计算器、游记生成、行程持久化 | ✅ |
| 🌍 任意目的地 | 选「其他」→ 输入框 → 实时情报 + 工具全激活（含加载/重试态） | ✅ |
| 🏝️ 巴厘岛 Portfolio | 12–14 天真实行程时间线 + 实拍画廊 + 找司机 CTA | ✅ |
| 🚗 找司机 | 隐私表单 → 邮件给 Dicky，**店主隐藏密送（防私单）**，全站撤除公开 WhatsApp | ✅ |
| 🫘 限流 + 旅行豆 | 5 次免费 → 旅行豆；微信/支付宝收款码（半自动）+ 管理员加豆接口 | ✅ |
| ✉️ 邮件 | Resend 全球可达（欢迎信 / 密码重置 / 找司机），发件域名 wandermind.cc | ✅ |
| 🌐 域名 + 部署 | wandermind.cc（HTTPS）、Cloudflare DNS、UptimeRobot 保活防冷启动 | ✅ |
| 🔍 SEO | robots.txt / sitemap.xml / OG 卡片 / Google Search Console 已验证 | ✅ |

### 🚧 待完成 / 规划中

| 优先级 | 内容 | 说明 |
|--------|------|------|
| 🟡 阶段2 | 找司机页加**预算范围选择器** | 让客户按预算档位选择，更易匹配 |
| 🟡 阶段3 | 巴厘岛页**图片分类 + 真实推广语** | 风景/人文、相机大片/手机真实；反「照骗」（等 Dicky 素材） |
| 🟢 阶段4 | **点图弹景点小介绍 + 简易路线 + 落地联系** | 出片向 / 体验向，单图交互 |
| 🟢 收款 | **在线自动支付**（Stripe / 微信商户） | 目前为收款码半自动，需收款主体 |
| 🟢 内容 | **社媒宣传文案持续产出** | 已产出首批 4 篇（资深旅行者人设、软植入） |
| 🔵 体验 | dest_info **首次加载提速**（热门城市预生成静态数据） | 现首次 ~20–40s、缓存秒回 |
| 🔵 扩展 | **微信小程序**上线 | 骨架已有；`/api/chat/once` 慢模型超时待修 |
| 🔵 扩展 | 更多目的地 **Portfolio**（日本 / 泰国等） | 复用巴厘岛页结构 |

---

## 🆕 WanderMind Studio（官方网站）

WanderMind Studio 是面向用户的**官方门户网站**，包含：

- **首页**：品牌展示、产品亮点、核心功能介绍
- **关于我们**：团队背景、6 AI 智能体介绍、数据驱动的产品故事
- **探索目的地**：巴厘岛 / 京都 / 巴黎 / 圣托里尼精选展示
- **AI 工作台**（`ai-tool.html`）：完整 AI 旅行规划工作台，含 5 功能标签、实时天气、比价、地图
- **联系我们**：服务咨询与团队联络

### Studio 核心能力

| 功能 | 说明 |
|------|------|
| 🤖 AI 对话工作台 | 流式打字输出，6 角色切换，连接后端 AI API |
| 🌤️ 实时目的地情报 | 当前天气（OpenWeather）、时区时钟、推荐区域、旅行贴士 |
| 🏨 酒店实时比价 | SerpAPI Google Hotels，预设 4 大目的地 + 任意城市 |
| ✈️ 机票比价 | SerpAPI Google Flights，8 城下拉 + 自由输入 |
| 🌌 平行宇宙预览 | 同一旅行的 3 套不同风格方案对比 |
| 🗺️ 探索地图 | SVG 交互地图，POI 热力图（按小时人流） |
| 🧮 智能预算计算器 | 按目的地 / 天数 / 风格估算全程预算 |
| 📝 旅行游记生成 | AI 一键生成小红书 / 朋友圈风格游记 |
| 🫘 免费额度 + 旅行豆 | 新访客 5 次免费 AI 问答,用尽后充值「旅行豆」继续(匿名按设备计数,登录后按账号) |
| 💰 半自动收款 | 充值弹窗内置价目表 + 微信/支付宝收款码;扫码付款备注邮箱,店主用管理员接口为该账号加豆(亦支持兑换码) |
| 🏝️ 巴厘岛实拍 Portfolio | 12–14 天真实行程时间线 + 实拍画廊 + 一键找司机 |
| 🚗 找当地司机 | 隐私优先表单,可从 AI 行程一键导入,直接邮件发给巴厘岛司机(不留存任何数据) |
| 🌐 5 语言切换 | 中文 · English · 日本語 · 한국어 · Bahasa Indonesia |
| 🌓 深色模式 | 深色 / 浅色一键切换，记忆用户偏好 |
| 📱 手机端全适配 | 响应式布局，≤991px 抽屉式面板，导航汉堡菜单 |

**📖 Studio 技术文档：[wandermind-studio/README.md](wandermind-studio/README.md)**

---

## ⚡ WanderMind AI 核心应用

原始 WanderMind AI 应用，提供完整的多智能体旅行规划体验：

### 你能用它做什么

**1. 📋 让 AI 团队为你做完整规划**
告诉它"我想去巴厘岛 7 天，2 人 1 万 5 预算"，几秒钟内得到：
- 每日详细行程（含景点、餐厅、住宿）
- 真实酒店价格（直接跳转预订）
- 预算分配建议
- 当地实用贴士（签证、礼仪、安全）

**2. ⚡ 一键问全队**
对同一问题，让 **3 位专家同时作答**（真正的并行处理，3 秒内出结果）

**3. ⚡/🎯 快慢双轨模式**
- ⚡ **极速**（默认）— Qwen2.5-7B 闪电响应，首字 200ms 内出
- 🎯 **精细** — MiMo Pro 深度思考，回答更完整细腻

**4. 🌍 任意目的地动态面板**
输入任何城市，AI 自动生成实时天气 / 时区 / 推荐区域 / 旅行贴士

**5. 更多功能**
平行宇宙预览 · 酒店机票比价 · AI 行程修改助手 · 旅行偏好记忆 · 智能预算计算器 · 游记生成 · PDF 导出

### 快速开始（AI 应用）

1. 打开 **[https://wandermind.cc](https://wandermind.cc)**
2. 邮箱注册（10 秒）
3. 选择目的地，开始对话

**📖 AI 应用技术文档：[wandermind/README.md](wandermind/README.md)**

---

## 🌐 多语言支持

🇨🇳 中文 · 🇬🇧 English · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇮🇩 Bahasa Indonesia

---

## 📱 手机端使用

两个产品均完整支持手机浏览器：

**WanderMind Studio**
- 响应式网站，Bootstrap 4 栅格
- AI 工作台在手机上：侧栏变为抽屉式弹出，聊天区全屏
- 汉堡菜单导航，深色模式按钮始终可见

**WanderMind AI 核心应用**
- 手机端底部 5 个导航键：行程 / 目的地 / 聊天 / 机酒 / 预算
- iPhone：Safari → 分享 → 添加到主屏幕（PWA 支持）
- Android：Chrome 菜单 → 添加到主屏幕

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Python 3.11 · FastAPI · JWT |
| **数据库** | Neon PostgreSQL(生产)· SQLite(本地开发,自动切换) |
| **AI 模型** | MiMo v2.5-Pro · SiliconFlow Qwen2.5-7B |
| **搜索 / 数据** | Tavily · SerpAPI Google Hotels & Flights · OpenWeather |
| **邮件** | Resend(欢迎信 / 密码重置 / 找司机请求,发件域名 wandermind.cc) |
| **收款** | 微信 / 支付宝收款码(半自动)· 管理员加豆接口(ADMIN_TOKEN 保护) |
| **前端（Studio）** | Bootstrap 4 · 原生 JS · CSS 变量深色模式 · SSE 流式 |
| **前端（核心应用）** | 原生 JS + CSS · SSE 流式 · PWA |
| **SEO** | robots.txt · sitemap.xml · Open Graph / Twitter Card · Google Search Console 已验证收录 |
| **部署** | Render(24/7 在线,UptimeRobot 保活防冷启动)· Cloudflare DNS · 自定义域名 wandermind.cc(HTTPS) |

---

## 📬 联系与反馈

- 🌐 在线访问：[https://wandermind.cc](https://wandermind.cc)
- 💻 GitHub：[lingfengai731/Agentstrip](https://github.com/lingfengai731/Agentstrip)
- 🐛 问题反馈：在 GitHub 提 Issue
- 📧 邮箱：lfwu22@126.com

---

<p align="center"><strong>WanderMind · 游心</strong> · 为每一次旅行赋予灵魂 ✈️</p>
<p align="center">MIT © 2026</p>
