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
| **巴厘岛路线编辑器** | R1–R6 按天调整顺序 · 添加/移除同区域 POI · 地图同步高亮 · 本机保存并交接 AI/司机；路线专属内容当前中英双语，其他语言回退英文 |
| **巴厘岛视觉数据库** | 15 张现有发布图片按 Landscapes / Culture / Experiences / Places 分类；主题与标签可组合筛选，手机端英文长标签限制在组件内部横滑；详情卡展示现场现实、适合目的、简易路线和关联主题路线，并可把地点 + `route_id` 带入 AI 或司机询价 |
| **预算计算器** | 按目的地 / 天数 / 人数 / 风格 / 出发城市估算全程预算 |
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
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\image-intake.ps1
```

脚本会增量更新：

- `frontend/assets/data/image-intake-review.csv`：尺寸、哈希、风景/人文/体验、手机真实/未知拍摄方式、地点冲突、G1–G7、R1–R6 和 POI 建议；
- `frontend/assets/data/image-publish-manifest.json`：仅包含已经完成人工授权审核、允许发布且来源信息完整的图片。

人工只需在 CSV 中填写或确认 `RightsStatus`、`SourceUrl`、`LicenseOrOwner`、`Publishable`、`HumanConfirmed`、`IntendedUse` 和中英文替代文字。允许的权利状态是 `owned`、`user_provided_with_consent`、`licensed`、`public_domain` 或 `cc0`；外部授权图片还必须填写来源网址。

脚本不会移动、改名、覆盖或删除原图。图片改名时，唯一 SHA-256 会保留已有人工审核；出现重复文件时，新副本不会继承批准。当前发布清单保持为空，直到人工确认完成。

回归测试：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-image-intake.ps1
```

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
