# WanderMind · 游心

> **AI 多智能体旅行规划平台** — 一句话告诉它你想去哪，6 位 AI 专家立刻为你做完整规划

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-4-7952B3?logo=bootstrap)](https://getbootstrap.com)

---

## 2026-08-10 巴厘岛产品阶段

本轮把 WanderMind 从“空白 AI 对话框”推进为可编辑的旅行产品流程，并保持现有视觉规范：

| 项目 | 状态 | 完成效果 |
|------|------|----------|
| AI 自助规划额度 | ✅ 已完成 | 登录账号每个产品行程提供 1 次初始 AI 规划 + 2 次 AI 调整；该额度与专业路线权益完全独立，公共路线无需登录即可浏览 |
| 专业路线 ¥9.9 | ✅ MVP 已完成 | 个性化专业路线先开放约 70%；¥9.9 人工确认或 30 推荐积分解锁同一个完整路线权益，并包含同一行程 3 次参数调整；历史已付费权益按已存额度兼容 |
| 人工收款确认 | ✅ 已完成 | 用户提交付款待确认订单，管理员在 AI 工具账户中心确认到账并解锁 |
| 邀请积分 | ✅ 已完成 | 邀请者 10 分、受邀者 5 分，24 小时后生效；30 分兑换并实际生成 1 次专业路线，每月最多计 5 位有效邀请 |
| 巴厘岛路线体系 | ✅ 第一版 | G1–G7 地理事实层 + R1–R6 主题路线家族；移动端可横向浏览，路线先于作品集 |
| 路线空间示意 | ✅ 已完成 | 6 条路线均展示核心区域实线、可选扩展虚线和主要节点；明确标注非比例图与车程待核验 |
| 按天路线编辑器 | ✅ 已完成 | 六条路线均可调整天序、添加/移除同区域 POI；G1–G7 使用真实 OSM/Leaflet 地理锚点并与所选日期同步高亮，外部地图不可用时回退 OSM iframe；草稿保存在本机并可导入 AI 或司机询价表单 |
| 本地司机 | ✅ 第一版 | Dicky / Gede 可选并已验证按所选司机直达邮箱；公开参考口径为全天基础 IDR 700k/10h、半天基础 IDR 500k/6h、每位游客 +IDR 50k（两位即 +IDR 100k），全天超过 10h 后 +IDR 75k/h，机场/酒店接送按距离；逐司机适用范围与路线最终价仍由司机确认 |
| 图片治理 | ✅ 首图生产闭环 | 108 张候选素材均已记录统一授权、哈希、Web 优化副本与发布 manifest；`Pura Tanah Lot.jpg` 已在生产完成对象存储直传、数据库草稿、预览、发布、公开读取与隐藏回滚；清单匹配会自动带入五语言资料 |
| 巴厘岛视觉数据库 | ✅ D8 当前版 | 当前 Portfolio 展示 37 个实拍内容位，统一为 Landscapes / Culture / Experiences 三类；地点信息拆为区域、地点类型、路线关联、标签、氛围、摄影风格和核验状态，并可结构化带入 AI 或司机询价 |
| 上游成本防护 | ✅ 已完成 | AI、行程融合、酒店/机票搜索仅限登录账号；巴厘岛/京都/巴黎/圣托里尼的五语精选资料直接读取版本化静态数据，不调用模型；任意目的地 AI 草稿需登录；天气独立缓存 30 分钟 |
| 全局账户入口 | ✅ 已完成 | 首页、关于、探索、巴厘岛、司机、联系页均可进入登录；支持邮箱验证码与 Google 登录 |
| 响应式验收 | ✅ 本轮通过 | 1440 / 768 / 390 / 320 px 浏览器检查无页面级横向溢出；320 px 英文切换后图库筛选与 R1–R6 路线仅在组件内部横滑，品牌、明暗按钮和菜单不重叠 |

> 当前支付仍是微信/支付宝二维码 + 管理员人工确认。正式上线前必须在 Render 设置强管理员密码；生产环境不会接受默认 `123456`。
> Portfolio 生产环境已配置 `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET` 与强管理员账号；管理入口仅对登录管理员显示。真实首图已完成上传、草稿、预览、发布、公开读取与隐藏回滚。新上传若在 Cloudinary 成功后数据库明确拒绝保存，系统会核验短期清理凭证和数据库状态：已登记资产不删除，未关联对象才清理；网络中断等结果不确定场景会保留云端文件并安全重试保存，避免误删。

详细执行台账见 [`.codex/plans/wandermind-master-roadmap-2026-08-02.md`](.codex/plans/wandermind-master-roadmap-2026-08-02.md)。

---

## 🌐 立即体验

| 入口 | 地址 | 说明 |
|------|------|------|
| 🏠 **首页** | **[https://wandermind.cc](https://wandermind.cc)** | Studio 品牌站首页 |
| 🤖 **AI 工作台** | [https://wandermind.cc/ai-tool](https://wandermind.cc/ai-tool) | 6 AI 智能体规划工作台 |
| 📖 **关于我们** | [https://wandermind.cc/about](https://wandermind.cc/about) | 团队与产品故事 |
| 🌍 **探索目的地** | [https://wandermind.cc/services](https://wandermind.cc/services) | 巴厘岛 · 京都 · 巴黎 · 圣托里尼 |
| 🏝️ **巴厘岛路线与实拍** | [https://wandermind.cc/bali](https://wandermind.cc/bali) | R1–R6 公共路线、个性化专业路线与 D8 实拍 Portfolio |
| 🚗 **找当地司机** | [https://wandermind.cc/find-driver](https://wandermind.cc/find-driver) | 隐私优先表单，按所选司机转发，不公开司机个人联系方式 |
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
| 🌤️ 目的地情报 | 巴厘岛/京都/巴黎/圣托里尼五语精选资料、独立实时天气、货币提示、季节、区域与核验贴士；任意目的地登录后生成 AI 草稿 | ✅ |
| 🏨 机酒比价 | SerpAPI 酒店 & 机票，预设 + 任意城市 | ✅ |
| 🧩 工作台工具 | 平行宇宙、探索地图、预算计算器、游记生成、行程持久化 | ✅ |
| 🌍 任意目的地 | 选「其他」→ 登录 → 输入城市 → 生成待核验 AI 草稿并独立加载实时天气（含登录/加载/重试态） | ✅ |
| 🏝️ 巴厘岛 Portfolio | R1–R6 公共路线 + 专业路线预览/解锁 + Landscapes / Culture / Experiences 三类实拍画廊 + 找司机 CTA | ✅ |
| 🚗 找司机 | Dicky / Gede 可选；隐私表单按所选司机转发，店主隐藏密送，网站不公开司机个人邮箱、微信或 WhatsApp | ✅ |
| 🫘 限流 + 旅行豆 | 5 次免费 → 旅行豆；微信/支付宝收款码（半自动）+ 管理员加豆接口 | ✅ |
| ✉️ 邮件 | Resend 全球可达（欢迎信 / 密码重置 / 找司机），发件域名 wandermind.cc | ✅ |
| 🌐 域名 + 部署 | wandermind.cc（HTTPS）、Cloudflare DNS、UptimeRobot 保活防冷启动 | ✅ |
| 🔍 SEO | robots.txt / sitemap.xml / OG 卡片 / Google Search Console 已验证 | ✅ |

### 🚧 待完成 / 规划中

| 优先级 | 内容 | 说明 |
|--------|------|------|
| 1 · P0 | **巴厘岛剩余 POI 来源复核** | R1 主干、R3 与 R4 的免费路线稳定事实已核验；Dicky 五日路线补入 Suluban 和佩妮达东西线。全库现为 59 个 POI：32 个 `verified`、24 个 `pending_review`、3 个 `needs_supplier_confirmation`。验收：公开路线引用的稳定事实有官方/政府来源，营业时间、票价、仪式、天气、船班与交通继续在出发前实时复核 |
| 2 · P0 | **供应商与安全门禁** | Mount Batur Jeep、Celuk 银饰课、Bali Fire Shooting Club 保持“需供应商确认”；Dicky 的滑翔伞与咖啡/茶/可可体验仍未绑定具体供应商。验收：运营主体、资质/保险、安全限制、可用日期、接送、取消政策和最终价格均有可追溯确认 |
| 3 · P0 | **Dicky / Gede 路线级报价** | 当前只展示 Dicky 提供的公共参考基线，逐司机适用范围、佩妮达船车衔接、机场/换酒店、区域与活动附加费仍待授权。验收：按司机、日期、时长、区域和路线版本化计算，且司机最终确认前不声称成交价 |
| 4 · P1 | **批量 Portfolio 治理** | 首图生产生命周期已闭环；其余图片仍需五语言标题/说明/替代文本、分类、地点、路线和授权复核。验收：未确认素材不可发布，公开 API 与 UI 数量口径一致 |
| 5 · P1 | **在线自动支付**（Stripe / 微信商户） | 目前是收款码 + 管理员人工确认。验收：收款主体确定，支付回调、签名、幂等、对账、退款/失败与人工兜底通过测试后再上线 |
| 6 · P1 | **持久化反滥用** | 司机询价等限流仍有进程内状态，重启或多实例不能形成可靠门禁。验收：使用 Postgres/Valkey 持久化限流与审计，不记录不必要的个人信息 |
| 7 · P1 | **任意目的地 AI 事实增强** | 四个预设目的地已静态直出；任意城市仍是依赖主模型额度的待核验草稿。验收：结构化 POI、来源、核验状态、模型/天气失败态与监控齐全 |
| 8 · P2 | **真实道路矩阵与拖拽路线编辑** | 当前使用 OSM/Leaflet 地理锚点、按天上下移动和本地草稿；尚无生产级车程矩阵与拖拽排序。验收：先离线评估 MapLibre、TRIP、VROOM/OR-Tools，禁止依赖公共 OSRM demo 直接上线 |
| 9 · P2 | **更多目的地 Portfolio** | 京都、巴黎、圣托里尼入口保留，但深度作品集尚未建设。验收：复用巴厘岛数据与版权门禁，不削弱巴厘岛主线 |
| 10 · P2 | **转化漏斗与业务分析** | 尚缺从路线浏览、AI 初稿、专业解锁到司机询价的完整事件链。验收：最小化采集、隐私说明、事件字典与漏斗报表上线后再据此调整商业策略 |
| 11 · P2 | **实时天气与模型可用性生产巡检** | 代码已有诚实降级，但外部密钥、模型余额和生产烟测状态可能漂移。验收：不读取/记录 Secret 值，只记录可用性、失败码、时间和恢复路径 |
| 12 · P2 | **后台细粒度角色、审计与存储抽象** | 当前强管理员可完成内容生命周期；编辑/审核/发布分权、操作审计和替代对象存储尚未实现。验收：在真实多人运营需求出现后按最小权限设计，不预先重构 |
| 13 · P3 | **微信小程序 / 原生 App** | 骨架已有，`/api/chat/once` 慢模型超时待修。验收：Web 端路线、司机、支付和事实门禁稳定后再推进 |
| 14 · P3 | **全球内容与社媒持续生产** | 首批 4 篇已产出，长期内容尚未形成稳定流水线。验收：只使用获授权图片和已核验地点，不夸大体验，不以“照骗”获客 |

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
| 🌤️ 目的地情报 | 四个预设目的地读取版本化五语精选资料；当前天气由 OpenWeather 独立更新；任意目的地登录后生成可核验的 AI 草稿 |
| 🏨 酒店实时比价 | SerpAPI Google Hotels，预设 4 大目的地 + 任意城市 |
| ✈️ 机票比价 | SerpAPI Google Flights，8 城下拉 + 自由输入 |
| 🌌 平行宇宙预览 | 同一旅行的 3 套不同风格方案对比 |
| 🗺️ 探索地图 | SVG 交互地图，POI 热力图（按小时人流） |
| 🧮 智能预算计算器 | 按目的地 / 天数 / 风格估算全程预算 |
| 📝 旅行游记生成 | AI 一键生成小红书 / 朋友圈风格游记 |
| 🫘 免费额度 + 旅行豆 | 每个产品行程提供 1 次初始 AI 规划 + 2 次 AI 调整；专业路线解锁与邀请积分使用独立权益，公共路线无需登录 |
| 💰 半自动收款 | 充值弹窗内置价目表 + 微信/支付宝收款码;扫码付款备注邮箱,店主用管理员接口为该账号加豆(亦支持兑换码) |
| 🏝️ 巴厘岛实拍 Portfolio | R1–R6 公共路线、约 70% 专业路线预览、D8 三类实拍画廊与一键找司机 |
| 🚗 找当地司机 | 隐私优先表单，可从路线或 AI 行程导入；请求按所选司机路由且不公开其个人联系方式 |
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
登录后输入任何城市，AI 生成时区、推荐区域和旅行贴士草稿；实时天气由独立接口更新。四个预设目的地直接读取五语精选资料，不依赖 AI 上游。

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
- AI 工作台已覆盖 Chrome / Edge / WebKit，验收 320–430px 常见手机宽度与横屏，固定导航不遮挡内容

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
