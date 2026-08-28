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
| 巴厘岛路线体系 | ✅ 第一版 | G1–G7 地理事实层 + R1–R6 主题路线家族；62 个 POI 中 57 个稳定事实已核验、2 个待确认规范身份、3 个受供应商门禁；移动端可横向浏览，路线先于作品集 |
| 路线空间示意 | ✅ 已完成 | 6 条路线均展示核心区域实线、可选扩展虚线和主要节点；明确标注非比例图与车程待核验 |
| 按天路线编辑器 | ✅ 已完成 | 六条路线均可调整天序、添加/移除同区域 POI；G1–G7 使用真实 OSM/Leaflet 地理锚点并与所选日期同步高亮，外部地图不可用时回退 OSM iframe；草稿保存在本机并可导入 AI 或司机询价表单 |
| 本地司机 | ✅ 第一版 | Dicky / Gede 可选并已验证按所选司机直达邮箱；Dicky 的初始价格为全天 IDR 700k/10h、半天 IDR 500k/6h、每位游客 +IDR 50k（两位即 +IDR 100k），全天超过 10h 后 +IDR 75k/h；Dicky 可按天数和路线调整，最终金额以邮件回复为准。Gede Nico 单独报价 |
| 司机推广包 | ✅ 本地交付版 | Dicky 与 Gede Nico 各有独立 9 页手册和 7 张可单独上传图片：3 张司机/服务实拍 + 4 张巴厘岛风景；含 Instagram、Facebook、WhatsApp、Reels 的复制即发文案，以及图库作者、来源和许可。此状态仅表示仓库材料与渲染验收完成，不代表司机已经发布 |
| 站长中文审核材料 | ✅ 待站长确认 | Dicky 与 Gede Nico 各有一份 13 页合并审阅手册和手机 ZIP：网站介绍、游客使用方法、两组完整推广素材、3–5 天发布节奏、手机保存图片及独立报价授权；26 页均已用 LibreOffice 逐页检查 |
| 图片治理 | ✅ 首图生产闭环 | 发布 manifest 共 118 张：108 张记录用户统一授权，10 张精确地点图记录 Wikimedia Commons 的来源、作者、CC0 / CC BY / CC BY-SA、哈希、WebP、移动端缩略图与可见署名；`Pura Tanah Lot.jpg` 已在生产完成对象存储直传、数据库草稿、预览、发布、公开读取与隐藏回滚；清单匹配会自动带入五语言资料 |
| 巴厘岛视觉数据库 | ✅ POI 全覆盖 | Portfolio 保持 D8 分类与来源门禁；路线选择器的 62 个 POI 已实现 62/62 视觉覆盖，其中 54 个为已有/外部授权精确地点图，8 个为明确标注的体验、区域或地形示意图 |
| 上游成本防护 | ✅ 已完成 | AI、行程融合、酒店/机票搜索仅限登录账号；巴厘岛/京都/巴黎/圣托里尼的五语精选资料直接读取版本化静态数据，不调用模型；任意目的地 AI 草稿需登录；天气独立缓存 30 分钟 |
| 全局账户入口 | ✅ 已完成 | 首页、关于、探索、巴厘岛、司机、联系页均可进入登录；支持邮箱验证码与 Google 登录 |
| 响应式验收 | ✅ 本轮通过 | 1440 / 768 / 390 / 320 px 浏览器检查无页面级横向溢出；找司机页的五语言、明暗主题、司机卡键盘焦点和移动端紧凑内距已通过本地浏览器验收；生产状态仍以部署后复测为准 |

### 2026-08-27 本轮增量（部署前）

| 项目 | 状态 | 完成效果 |
|------|------|----------|
| 路线地点视觉 | ✅ 本地完成 | 62/62 个非退役 POI 均有路线选择器视觉与介绍；54 个使用已有/外部授权的精确地点图，8 个使用明确标注的体验、区域或地形示意图，不再显示“该地点照片尚未接入” |
| 全站搜索 | ✅ 本地完成 | 7 个公开页面的放大镜进入五语言搜索页，可检索站点页面、R1–R6 和 62 个 POI；支持 GET 分享、键盘与手机触控 |
| 一至两日体验套餐 | ✅ 本地完成 | 首批 8 套可筛选产品覆盖 Batur、Ubud、Penida、南部悬崖与东部；用户选择后带入司机询价，不伪装成即时预订或固定成交价 |
| 司机初始价格口径 | ✅ 已纠正 | 预算器明确为 Dicky 亲自提供的初始价格；司机可按天数与路线调整，最终金额以邮件回复为准；Gede Nico 单独报价 |
| 司机合并手册 | ✅ 已完成 | 站长于 2026-08-27 通过两份中文合并版；Dicky 与 Gede Nico 的最终印尼语 DOCX 和独立手机 ZIP 已生成，Dicky/Gede 价格严格隔离，26 页完成主控逐页复核 |
| 首屏氛围动效 | ✅ 本地完成 | 首页与巴厘岛首屏增加一层 teal + gold 晨光漂移；仅桌面/平板缓慢运行，手机和减少动态效果模式保持静态；未向登录、支付和后台扩散 |
| PayPal 自动支付 | 🟡 Sandbox 成功付款、待异常流与 Live 门禁 | 站长已用 Sandbox Personal 买家完成 USD 1.49 付款并看到专业路线解锁；本轮随后发现并修复重新进入时重复收费/锁定文案、不同 `route` 深链冲突及调整按钮反馈。Orders v2、服务器金额复核、webhook 签名与幂等仍保留；当前分支通过 86 项权限测试，部署后还需用同一已购账号复核权益恢复，并补取消、拒绝、重复 webhook 与退款测试，不能把 Sandbox 等同于真实收款 |
| Search Console / Sitemap | 🟡 页面已收录、站点地图待重验 | 用户已确认 `/ai-tool` 在 2026-08-27 的网址检查中被 Google 收录；同日 Search Console 仍把 `sitemap.xml` 标为“无法读取 / 0 个网页”。公开端点实时返回 HTTP 200、`application/xml` 和 8 个 URL，因此先重新提交并等待 Google 重抓，不把控制台历史状态写成已修复 |
| Batur Jeep / SUNSRI 候选 | ⏳ 待供应商书面核验 | Pak Nanok 的公开网站、套餐和社媒关联以及 SUNSRI Celuk 课程已登记为供应商自述；在法定主体、保险、车辆/讲师、安全、实时名额、取消规则与最终价闭环前不公开为执行就绪推荐 |

### 2026-08-28 专业路线与全站交互修复（生产已发布）

| 项目 | 状态 | 完成效果 |
|------|------|----------|
| 已购路线恢复 | ✅ 本地通过 | 权益继续绑定购买账号和同一个 `trip_id`；重新进入或 URL 带另一条 `route` 时优先恢复该账号最近已解锁路线，不再静默新建收费路线。完整路线统一为全部天数开放、0 天锁定，不再显示“免费预览” |
| 调整本次行程 | ✅ 本地通过 | 点击后编辑器展开、平滑滚动并把键盘焦点放入表单；带路线深链时保留“待调整路线”，只有提交调整才扣减次数 |
| Bali 信息减负 | ✅ 本地通过 | 取消套餐主观“强度”和公共路线“节奏/体力”标签，删除与 R1–R6 重复的旧 12–14 天静态路线；保留公共路线、体验套餐、专业路线、Portfolio 和找司机的转化主线 |
| 账户与深链 | ✅ 本地通过 | “我的账户”一键进入账户弹窗，不再先弹旧行程窗口；搜索页补齐全局账户入口；酒店、机票、行程、偏好 hash 深链以及 `?dest=` 首次加载均有实际响应 |
| 响应式与回归 | ✅ 生产公开矩阵通过 | PR #34、#36、#37 已合并，Render 已提供 `ai-tool.js?v=p59`；生产 320/390/768/1440 的 Bali、套餐、搜索、账户入口、AI 深链与司机交接矩阵通过。仍需站长用刚付款的同一 Sandbox 账号做一次登录态恢复验收，不能用公开模拟替代真实账号权益证据 |

> 当前生产已显示 PayPal Sandbox 测试入口，并保留微信/支付宝二维码 + 管理员人工确认。Sandbox 只使用测试账户和测试资金；切换 Live 前必须完成成功、取消、拒付、重复 webhook 与退款验收，并保留强管理员密码。
> Portfolio 生产环境已配置 `CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET` 与强管理员账号；管理入口仅对登录管理员显示。真实首图已完成上传、草稿、预览、发布、公开读取与隐藏回滚。新上传若在 Cloudinary 成功后数据库明确拒绝保存，系统会核验短期清理凭证和数据库状态：已登记资产不删除，未关联对象才清理；网络中断等结果不确定场景会保留云端文件并安全重试保存，避免误删。

详细执行台账见 [`.codex/plans/wandermind-master-roadmap-2026-08-02.md`](.codex/plans/wandermind-master-roadmap-2026-08-02.md)。

首发传播文案、图片顺序、隐私边界和 14 天复盘流程见 [`wandermind-studio/MARKETING_LAUNCH_PLAYBOOK.md`](wandermind-studio/MARKETING_LAUNCH_PLAYBOOK.md)。
管理员登录后可从 AI Tool 账户中心进入 `/admin/marketing`，查看匿名访问、路线兴趣、司机表单开始和成功送达的聚合计数。

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
| 🔎 **全站搜索** | [https://wandermind.cc/search](https://wandermind.cc/search) | 检索站点页面、R1–R6 路线和巴厘岛 POI |
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
| 🏝️ 巴厘岛 Portfolio | R1–R6 公共路线 + 专业路线预览/解锁 + 62/62 POI 视觉预览 + 8 个一至两日体验套餐 + 找司机 CTA；动态作品按地点去重 | ✅ 生产已部署 |
| 🔎 全站搜索 | 7 个公开页统一入口；检索页面、R1–R6 和 62 个 POI，支持五语言、GET 分享、键盘与手机 | ✅ 生产已部署 |
| 🚗 找司机 | Dicky / Gede 可选；五语预算器明确采用 Dicky 初始价格并以司机回复为最终金额，隐私表单按所选司机转发，网站不公开司机个人邮箱、微信或 WhatsApp | ✅ 代码与本地测试 |
| 🫘 限流 + 旅行豆 | 5 次免费 → 旅行豆；微信/支付宝收款码（半自动）+ 管理员加豆接口 | ✅ |
| ✉️ 邮件 | Resend 全球可达（欢迎信 / 密码重置 / 找司机），发件域名 wandermind.cc | ✅ |
| 🌐 域名 + 部署 | wandermind.cc（HTTPS）、Cloudflare DNS、UptimeRobot 保活防冷启动 | ✅ |
| 🔍 SEO | robots.txt、公开 sitemap.xml、OG 卡片与 `/ai-tool` 收录已验证；Search Console 的 sitemap 报表仍待重抓 | 🟡 |
| 📈 首发统计 | UTM 会话归因 + 7 个匿名事件 + 管理员 14 日聚合；不保存 Cookie ID、原始 IP、联系方式或浏览器指纹 | ✅ 第一阶段 |

### 🚧 待完成 / 规划中

完整、去重并按 Rank 1 为最高优先级排列的跨账号台账见 [`wandermind-studio/operations/MASTER_BACKLOG_2026-08-26.md`](wandermind-studio/operations/MASTER_BACKLOG_2026-08-26.md)。生产写入、真实邮件、自动支付、公开发帖和广告的独立门禁见 [`wandermind-studio/operations/PRODUCTION_GATES.md`](wandermind-studio/operations/PRODUCTION_GATES.md)。

| 优先级 | 内容 | 说明 |
|--------|------|------|
| 0 · P0 | **受控首发与生产回调** | 先部署第一方匿名首发统计与五语言 `/privacy`，再按推广手册执行小红书、Instagram、TikTok/抖音小批量传播。Google/Microsoft 只先准备 Search 广告结构；创建账户、绑定付款或产生花费仍需站长确认。每次发布必须复核生产事件写入、五语言和 320/390/768/1440，不把本地或 CI 结果写成已上线 |
| 1 · P0 | **巴厘岛剩余 POI 来源复核** | 2026-08-26 已为两个 `pending_review` 节点补齐结构化公开证据、已核验范围和实时复核字段；没有把区域/别名证据误写为执行就绪。Thousand Islands Viewpoint 仍待唯一身份、入口和坐标；Mount Batur 仍需按日期选择具体入口、路线、许可与导游。验收：取得直接/官方事实后才升级状态 |
| 2 · P0 | **供应商与安全门禁** | Mount Batur Jeep、Celuk 银饰课、Bali Fire Shooting Club 的公开身份/上下文审计已完成并保留“需供应商确认”；当前价格冲突、证照/保险和可订性未闭环。可复制核验清单见 `operations/SUPPLIER_VERIFICATION_REGISTER.md`；Dicky 的滑翔伞与咖啡/茶/可可体验仍未绑定具体供应商 |
| 3 · P0 | **Dicky / Gede 路线级报价** | 已实现五语参考预算器并分别准备印尼语授权表 `operations/DICKY_RATE_AUTHORIZATION_ID.md`、`operations/GEDE_RATE_AUTHORIZATION_ID.md`。机场、换酒店、超时、佩妮达船车、区域和活动附加费须两位司机分别书面确认后，才开发按司机/日期/路线版本化的最终估价；司机确认前不声称成交价 |
| 4 · P0 | **生产写入型 E2E** | 站长已完成一次 Sandbox Personal 付款并观察到专业路线解锁，这只覆盖成功支付主路径。部署本轮权益恢复修复后，先用同一已购账号只读复核；旅行豆扣减、调整扣次、管理员人工确认/无限权限及 PayPal 取消、拒绝、重复 webhook、退款仍需专用测试数据和可回滚矩阵 |
| 4 · P1 | **批量 Portfolio 治理** | 首图生产生命周期已闭环；当前 53 张 D8 图片已补齐中/英/日/韩/印五语言标题、说明和替代文本，其中 14 张既有 Bali 路线卡已与发布清单同步，旧 `rock-ocean-landscape.jpg` 也已按实景交叉核对为 Broken Beach。另有 10 张精确地点图使用独立缩略图和可见版权署名；`bali-12.jpg` 已关联乌布圣猴森林，`bali-3.jpg` 已关联 Kelingking Beach Viewpoint；`Nyepi.jpg` 已纠正为塞米亚克村社神庙的社区文化聚会；`bali-1.jpg`、`bali-2.jpg` 与 `bali-4.jpg` 因缺少唯一地点证据保持未知地点且不开放 AI/司机交接。剩余 9 张已从 Bali 路由池隔离：5 张文件名明确指向其他目的地、1 张文件名与画面冲突、2 张为地点未知的通用海岸图、1 张仅能核验到印度尼西亚国家层级；它们不是 Bali POI 待办。未确认素材不可发布，公开 API 与 UI 数量口径必须一致 |
| 5 · P1 | **PayPal 自动支付生产闭环** | 六项 Render Sandbox 变量与 webhook 已配置；Sandbox Personal 成功付款由站长完成。验收剩余：部署后权益恢复、重复 webhook、取消/拒绝、退款与对账；全部通过后再单独决定 Live 凭据、Live webhook 和最小真实交易，不把 Sandbox 成功或银行卡绑定等同于真实结算 |
| 6 · P1 | **持久化反滥用与邮件重试** | ✅ HMAC 伪匿名数据库计数、PostgreSQL 并发和 Render 代理路径已有测试/既有生产证据；2026-08-26 又为司机表单增加稳定请求 UUID 与 Resend 幂等键，网络重试不再重复投递同一请求，且不新增个人信息存储。真实送达只随下一次获授权或真实请求验收，不重复发送测试邮件 |
| 7 · P1 | **任意目的地 AI 事实增强** | 四个预设目的地已静态直出；任意城市仍是依赖主模型额度的待核验草稿。验收：结构化 POI、来源、核验状态、模型/天气失败态与监控齐全 |
| 8 · P2 | **真实道路矩阵与拖拽路线编辑** | 当前使用 OSM/Leaflet 地理锚点、按天上下移动和本地草稿；尚无生产级车程矩阵与拖拽排序。验收：先离线评估 MapLibre、TRIP、VROOM/OR-Tools，禁止依赖公共 OSRM demo 直接上线 |
| 9 · P2 | **更多目的地 Portfolio** | 京都、巴黎、圣托里尼入口保留，但深度作品集尚未建设。验收：复用巴厘岛数据与版权门禁，不削弱巴厘岛主线 |
| 10 · P2 | **转化漏斗与业务分析** | ✅ 第一阶段已完成页面访问、首页双路径、公共路线选择、专业路线入口、司机表单开始/提交 7 个匿名事件，管理员可查看 14 日来源与 campaign 聚合；仍待在真实业务启动后补 AI 初稿、专业解锁/支付与有效司机确认，并以实际样本决定是否需要第三方分析标签 |
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
| 💰 收款 | 专业路线支持 PayPal Sandbox Orders v2 自动解锁；微信/支付宝收款码 + 管理员人工确认继续作为本地备用路径 |
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
