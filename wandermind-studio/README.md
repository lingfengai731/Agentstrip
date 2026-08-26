# WanderMind Studio

## Current product paths (2026-08-04)

The homepage now exposes two intentionally separate planning products:

- `AI self-plan` (`ai-tool.html?mode=diy`): the existing AI workspace with one initial plan and two AI adjustments per product trip.
- `Get a professional route` (`bali.html#professional-planner`): deterministic Bali matching across G1–G7 and R1–R6. It shows an approximately 70% preview, then unlocks the full place order, experience modules and execution notes for ¥9.9 or 30 referral points.

Unlocking the current professional route includes three parameter adjustments for that same trip and does not consume or replace the AI allowance. The three adjustments are not human deep customization and cannot be treated as three new travel orders. The legacy `ai-tool.html?professional=1` entry is retained as a compatibility redirect to the Bali professional section. Authenticated API requests use the stored Bearer token; after an expired session is confirmed by `/api/auth/me`, one login can resume the interrupted request.

The professional Bali UI is implemented in `frontend/assets/js/bali-professional.js` and hands an unlocked route to `find-driver.html` with the selected driver, route, dates, people and budget.

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
| **巴厘岛路线编辑器** | R1–R6 按天调整顺序 · 添加/移除同区域 POI · 地图同步高亮 · 本机保存并交接 AI/司机；62/62 个 POI 均可在桌面悬停/聚焦或手机点按后查看视觉与介绍 |
| **巴厘岛事实核验** | 62 个 POI 分离“稳定事实已核验”和“实时信息待复核”；R1 主干、R2、R3、R4 与 R6 的免费路线稳定事实已核验；全库 57 个 `verified`、2 个 `pending_review`、3 个 `needs_supplier_confirmation`，均保留出发前 live checks 与供应商门禁 |
| **巴厘岛视觉数据库** | 默认先展示 12 张 Portfolio；路线选择器的 62 个 POI 已全部有视觉，其中 54 个为已有/外部授权的精确地点图，8 个为明确标注的体验、区域或地形示意图；每张外部精确图保留可见作者、来源和许可证 |
| **预算计算器** | 按目的地 / 天数 / 人数 / 风格 / 出发城市估算全程预算 |
| **司机初始预算** | 找司机页按 Dicky 亲自提供的 IDR 全天 / 半天初始价格即时计算五语预算；Dicky 可按天数和路线调整，最终金额以回复为准；Gede Nico 单独报价 |
| **体验套餐** | 首批 8 个一至两日产品覆盖 Batur、Ubud、Penida、南部悬崖和东部；按天数与强度筛选，选择后进入司机询价，不伪装成即时预订 |
| **全站搜索** | 7 个公开页面统一放大镜入口，五语言搜索站点页面、R1–R6 和 62 个 POI；GET 查询可分享，桌面键盘和手机触控均可用 |
| **平行宇宙** | 同一旅行 3 套方案并排对比（节俭 / 平衡 / 奢华） |
| **行程管理** | Trip 创建 / 切换 / 持久化（localStorage） |
| **旅行偏好** | 预算档次 · 旅行风格 · 同行方式，注入每次 AI 对话 |
| **游记生成** | AI 一键生成第一人称旅行游记 |
| **登录注册** | Modal 弹窗，JWT 认证，接入后端 `wandermind.cc` |
| **深色模式** | CSS 变量切换，记忆用户偏好（localStorage） |
| **5 语言** | 中文 · English · 日本語 · 한국어 · Bahasa Indonesia；全局导航与主要工作台 UI 已覆盖，路线专属内容按各数据集的现有语言回退 |

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

## 🔗 URL 结构与后端 API

Studio **由 wandermind 后端通过 FastAPI `StaticFiles` 挂载在根路径 `/`**，是品牌主入口：

```
https://wandermind.cc/              ← Studio 首页
https://wandermind.cc/about         ← 关于（干净 URL）
https://wandermind.cc/services      ← 探索目的地
https://wandermind.cc/ai-tool       ← AI 工作台
https://wandermind.cc/contact       ← 联系
https://wandermind.cc/shared?t=XXX  ← 公开分享页
https://wandermind.cc/app           ← 老 AI 单页应用（书签兼容）
https://wandermind.cc/api/*         ← 后端 API
```

带 `.html` 后缀的老路径（`/about.html` 等）也照样能访问，**老书签不会断**。

**Clean URL 是怎么实现的：** `main.py` 里有个 `clean_html_urls` 中间件，遇到 `/about` 这样无后缀的请求时，内部重写 scope 路径成 `/about.html`，让下游 StaticFiles 找到真实文件。`/api/*`、`/app`、`/manifest.json` 等保留路径完全跳过中间件。

**同源部署的好处**：
- 零 CORS 配置
- 相对路径 `/api/*` 自动生效
- 自定义域名绑定后所有页面一起切换
- 单一 Render 服务，单一 Postgres 数据库

如需把 Studio 独立部署到其他域名（如单独 CDN / Vercel），在 HTML 加：

```html
<script>window.WM_BACKEND = 'https://wandermind.cc';</script>
<script src="assets/js/ai-tool.js"></script>
```

主要接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/chat` | SSE 流式对话 |
| POST | `/api/chat/team` | 3 Agent 并行 |
| POST | `/api/dest_info` | 四个预设目的地五语精选资料静态直出；任意目的地登录后生成 AI 草稿，天气由 `/api/weather` 独立更新 |
| POST | `/api/search/hotels` | Google Hotels 实时价格 |
| POST | `/api/search/flights` | Google Flights 实时价格 |
| GET  | `/api/weather` | OpenWeather 实时天气 |
| POST | `/api/user/preferences` | 旅行偏好存取 |
| POST | `/api/product-trips` | 创建带免费额度的产品行程；巴厘岛页同步展示 G1–G7 非比例路线示意图 |
| GET/POST | `/api/product-trips/{id}/allowance` / `consume` | 查询或消耗 1 次粗路线 + 2 次调整；解锁后再生成 1 次专业路线 |
| POST | `/api/professional-route/orders` | 创建 ¥9.9 人工确认订单 |
| GET/POST | `/api/admin/professional-route/orders` | 管理员查看待办并确认解锁 |
| GET | `/api/referrals/status` | 推荐码、分享链接和积分余额 |
| POST | `/api/referrals/redeem-professional-route` | 30 推荐积分兑换一次专业路线 |
| POST | `/api/marketing/events` | 记录严格白名单的匿名首发事件；不接受自由文本、联系方式或稳定用户标识 |
| GET | `/api/admin/marketing-summary?days=14` | 管理员查看事件、来源和 campaign 聚合（1–90 天） |

管理员登录 AI Tool 的账户中心后，可打开 `/admin/marketing` 查看 7/14/30/90 天首发漏斗；该页面不展示或保存游客联系方式。

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

## 🖼️ 图片自动收件与安全发布

把新图片放入 `frontend/assets/images/` 后，在仓库根目录运行：

```powershell
pwsh -NoProfile -File .\tools\image-intake.ps1
```

脚本会增量更新：

- `frontend/assets/data/image-intake-review.csv`：尺寸、哈希、风景/人文/体验、手机真实/未知拍摄方式、地点冲突、G1–G7、R1–R6 和 POI 建议；
- `frontend/assets/data/image-publish-manifest.json`：仅包含已经完成人工授权审核、允许发布且来源信息完整的图片。

人工只需在 CSV 中填写或确认 `RightsStatus`、`SourceUrl`、`LicenseOrOwner`、`Publishable`、`HumanConfirmed`、`IntendedUse` 和中英文替代文字。允许的权利状态是 `owned`、`user_provided_with_consent`、`licensed`、`public_domain` 或 `cc0`；外部授权图片还必须填写来源网址。

脚本不会移动、改名、覆盖或删除原图。图片改名时，唯一 SHA-256 会保留已有人工审核；出现重复文件时，新副本不会继承批准；安全工作树缺少某张历史原图时，脚本也不会静默删除已审核发布项。当前发布清单包含 118 张图片：108 张沿用用户统一授权，10 张精确地点图按 Wikimedia Commons 的 CC0 / CC BY / CC BY-SA 逐项记录来源、作者、许可证、改编说明、WebP 和缩略图。Portfolio 管理页会按 SHA-256 匹配清单并自动带入标题、地点、路线和多语言资料，匹配图片保存草稿时无需手填。清单外图片只能保留为草稿，必须先通过收件与授权流程加入批准清单后才能发布。

当前发布清单中有 53 张 Landscapes / Culture / Experiences 图片具备完整五语言 D8 文案；14 张既有 Bali 路线卡已与页面上的区域、路线和视觉说明同步，旧 `rock-ocean-landscape.jpg` 已按实景交叉核对为 Broken Beach。其余 9 张地点不属于或尚不能唯一确认属于 Bali，已清空 G1–G7、R1–R6 和 POI 关联，不进入 Bali 路线推荐。

首张真实发布候选为 `Pura Tanah Lot.jpg`（SHA-256 `f7cd422d0d2322bcb90cb2a7b4c5538441ecdc1cf61715860b9949a4e74967cf`）。清单已提供中文、英文、日文、韩文和印尼文的标题、说明与替代文字，并强调潮汐和天气会改变现场观感，不承诺固定“出片”结果。该图片已在生产完成对象存储直传、数据库草稿、预览、发布、公开读取与隐藏回滚；草稿和隐藏状态均不进入公开 Portfolio API。管理页会同时检查上传队列和现有内容库中的 SHA-256，避免重复上传。

新图片的上传签名会附带一小时有效、仅限该随机 `public_id` 的清理凭证。若 Cloudinary 上传完成而数据库明确拒绝保存，管理页会调用管理员专用补偿端点：数据库已登记时只恢复完成状态，不删除图片；确属未关联对象时才调用 Cloudinary `destroy`。若网络中断或服务器错误导致保存结果不确定，系统不会删除云端文件，而是保留相同资料执行幂等保存重试；清理未确认时保留“重试云端清理”操作。替换现有图片不会签发该凭证，避免误删已有作品。

生产单图 E2E 只有在 Render 已配置 `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET` 且强管理员账号可用时才允许执行。缺少这些条件时，不应把本地 manifest 就绪误写成“已上传”或“已发布”。

回归测试：

```powershell
pwsh -NoProfile -File .\tools\test-image-intake.ps1
```

---

## 🧭 路线编辑反馈与开源吸收顺序

巴厘岛公共路线编辑器会在用户未选择地点时显示五语言提示并聚焦下拉框；成功添加后显示可见且可被屏幕阅读器识别的状态，路线继续保存在当前设备。该交互需同时在桌面、390px 与 320px 手机宽度验证。

后续开源能力按增量方式吸收，不整体替换现有 FastAPI、PostgreSQL、原生 JavaScript 与 Leaflet 基础：

| 优先级 | 方向 | 采用边界 |
|------|------|------|
| P1 | Portfolio 管理体验 | 评估 [Uppy](https://github.com/transloadit/uppy) 的拖拽、预览、进度和 metadata 交互；继续使用现有 Cloudinary 签名直传、FastAPI 与 PostgreSQL，先完成真实单图 E2E 再引入依赖 |
| P1 | 地图与路线产品 | 以 [MapLibre](https://github.com/maplibre) 的真实经纬度、区域和路线图层为设计参考；当前 Leaflet 实现保持生产可用，先做数据与原型评估，不立即替换 |
| P1 | 多日行程闭环 | 吸收 [TRIP](https://github.com/itskovacs/trip/wiki) 的“地图—POI—多日行程”交互思路，仅复用产品模式，不复制品牌或受限制代码 |
| P2 | 确定性路线优化 | 在 POI 坐标、开放时间、停留时间和车程数据成熟后，再评估 [VROOM](https://github.com/vroom-project/vroom) 与 [OR-Tools](https://github.com/google/or-tools)；现阶段不接入生产 |
| 研究限定 | [TREK](https://github.com/liketrek/TREK) | 仅用于功能研究；因 AGPL 网络使用义务，不直接复制到当前商业产品 |

---

## 📣 推广材料

- [`MARKETING_LAUNCH_PLAYBOOK.md`](MARKETING_LAUNCH_PLAYBOOK.md)：站主首发方案，现含小红书、Instagram Feed / Story / Reels、链接和 14 天复盘路径。
- [`promotion-packs/Dicky/WanderMind_Dicky_Promosi_Siap_Pakai.docx`](promotion-packs/Dicky/WanderMind_Dicky_Promosi_Siap_Pakai.docx)：Dicky 的印尼语懒人推广手册及 7 张独立上传图片（司机/服务 3 张、带署名的巴厘岛风景 4 张）。
- [`promotion-packs/Gede-Nico/WanderMind_Gede_Nico_Promosi_Siap_Pakai.docx`](promotion-packs/Gede-Nico/WanderMind_Gede_Nico_Promosi_Siap_Pakai.docx)：Gede Nico 的印尼语懒人推广手册及 7 张独立上传图片（司机/服务 3 张、带署名的巴厘岛风景 4 张）。

两位司机使用不同的 `driver_id` 专属链接，打开后会自动选择对应司机。推广包不包含私人联系方式；预算器采用 Dicky 给出的初始价格，Dicky 可按天数和路线调整并以邮件回复为最终金额，Gede Nico 单独报价。

站长中文审阅已改为每位司机一份合并手册：

- [`promotion-packs/Dicky/WanderMind_Dicky_Complete_Guide_Chinese_Review.docx`](promotion-packs/Dicky/WanderMind_Dicky_Complete_Guide_Chinese_Review.docx) 与配套手机 ZIP。
- [`promotion-packs/Gede-Nico/WanderMind_Gede_Nico_Complete_Guide_Chinese_Review.docx`](promotion-packs/Gede-Nico/WanderMind_Gede_Nico_Complete_Guide_Chinese_Review.docx) 与配套手机 ZIP。

合并手册包含网站介绍、游客使用方法、两组完整推广素材、3–5 天发布节奏、手机保存图片和独立报价授权；旧中文拆分版已删除，印尼语正式版待中文审阅后更新。

运营与门禁资料：

- [`operations/MASTER_BACKLOG_2026-08-26.md`](operations/MASTER_BACKLOG_2026-08-26.md)：两个账号统一后的完整未闭环台账与顺序。
- [`operations/DICKY_RATE_AUTHORIZATION_ID.md`](operations/DICKY_RATE_AUTHORIZATION_ID.md) 与 [`operations/GEDE_RATE_AUTHORIZATION_ID.md`](operations/GEDE_RATE_AUTHORIZATION_ID.md)：两位司机各自独立的印尼语报价授权表。
- [`operations/SUPPLIER_VERIFICATION_REGISTER.md`](operations/SUPPLIER_VERIFICATION_REGISTER.md)：三个供应商体验的公开证据边界和直接核验问题。
- [`operations/PRODUCTION_GATES.md`](operations/PRODUCTION_GATES.md)：付费/积分/管理员 E2E、真实邮件、自动支付、公开发帖与广告门禁。

---

## 🌐 部署（已上线，自动）

Studio **已经随 wandermind 后端一起部署**，无需单独配置：

1. 后端 `main.py` 末尾通过 `app.mount("/", StaticFiles(...))` 把 Studio 挂在根路径
2. push 代码到 GitHub → Render 自动重新部署 → Studio 同时更新
3. 访问 https://wandermind.cc/ 即可（正式域名已上线）

> 如要拆分独立部署（如 Vercel / Netlify）：见上方"后端 API"章节的 `WM_BACKEND` 配置

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
