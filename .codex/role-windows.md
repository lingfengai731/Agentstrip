# 角色窗口台账

> 本文件是角色路由 source of truth。状态未知写“待确认”，不要编造 thread id。

| 角色 | 状态 | thread id | 来源窗口 | 当前职责 | 下一步 | 循环状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 总控 | 已关闭 | 019f70c7-3985-7bb0-b395-b208373ca92b | 用户 | 图片自动分类、路线/POI 匹配与版权发布门禁 | 下一步由用户逐张确认权属与用途，再从 manifest 接入页面 | L3 已闭环 |
| 架构 | 未建立 | 无 | 总控 | 定位 `/api/dest_info` 失败根因并限定最小修复 | 已回调总控：主模型余额不足，采用诚实前端降级 | 本地降级已完成 |
| 内容主编 | 未建立 | 无 | 总控 | 阶段 2 文案与预算范围核对 | 无新增内容裁决 | 本地降级已完成 |
| 开发 | 未建立 | 无 | 架构 | 增量图片扫描、审核保留、唯一哈希改名与发布清单 | 实现及本地回归已完成 | 本地降级已完成 |
| UI/PPT | 未建立 | 无 | 架构/内容主编 | 保持 teal + gold，完成路线示意和 320px 修复 | 1440/768/390/320 渲染已通过 | 本地降级已完成 |
| 测试 | 未建立 | 无 | 架构 | 图片改名、重复文件、地点冲突、发布门禁与原后端回归 | 图片专项通过；后端 9 项 unittest 通过 | 本地降级已完成 |
| QA | 未建立 | 无 | 架构 | 图片发布边界、匹配准确性与暂存范围审查 | Sol 最终 GO，P0/P1 为 0；唯一 P2 已补测试 | 本地降级已完成 |
| 安全 | 待确认 | 待确认 | 架构 | 授权安全审计和低影响验证 | 无新增安全范围 | 待确认 |
| DBA | 待确认 | 待确认 | 架构 | 数据库实例风险和只读诊断 | 本阶段不涉及 | 待确认 |
| 运维 | 未建立 | 无 | 架构 | 部署与生产只读验证 | 3c04daa 已上线，关键页面均 200 | 本地降级已完成 |
| 公众号发布 | 待确认 | 待确认 | 内容主编 | 微信公众号草稿、预览、发布准备 | 本阶段不涉及 | 待确认 |
| 小红书 | 待确认 | 待确认 | 内容主编 | 小红书内容实验、发布包、评论研究 | 本阶段不涉及 | 待确认 |
| 视频 | 待确认 | 待确认 | 内容主编 | 视频脚本、分镜、素材和渲染计划 | 本阶段不涉及 | 待确认 |
| 知识库 | 待确认 | 待确认 | 总控 | Obsidian/个人知识库整理 | 本阶段不涉及 | 待确认 |
| 技能维护 | 未建立 | 无 | 总控 | skill 命中率、触发规则、registry/README/docs 维护 | 已记录三项技能与 fail-closed 路由 | 本地降级已完成 |
| 文档/交付 | 未建立 | 无 | 总控/架构 | README、路线图、复核表与发布清单说明 | README、路线图与终态回调已更新 | 本地降级已完成 |

## 最近回调

- 2026-08-16 司机询价持久化反滥用开发回调：移除进程内 `_driver_request_attempts`，新增 SQLite/Postgres 共用的原子 UPSERT 计数；客户端地址只以 `SECRET_KEY` 作用域 HMAC 保存，表中仅含伪匿名键、窗口时间、计数和更新时间，不保存姓名、邮箱、预算或行程正文。数据库门禁异常 fail-closed 为 503，Dicky/Gede 继续共享 5 次/30 分钟额度。
- 2026-08-16 司机询价测试/QA 回调：产品回归从 39 增至 43 项且全部通过；新增持久化字段、8 线程原子并发、不同客户端隔离、窗口恢复、blocked 不延长窗口和数据库故障不发邮件测试，并将原子并发测试连续运行 10 轮。正式 Luna Max 两轮只读审计最终 GO，P0/P1 为 0。
- 2026-08-16 司机询价发布边界回调：PostgreSQL/SQLite 官方文档和 SQLite 3.39.4 本地运行支持当前 `ON CONFLICT ... DO UPDATE ... RETURNING`；未连接真实 Neon、未部署 Render。上线门禁保留真实 Postgres 集成测试及 `request.client.host` 在 Render 可信代理后的只读烟测，未擅自改信任头策略。
- 2026-08-16 POI batch 2 内容回调：Heart Space Bali、Intuitive Flow、Munduk Waterfall、Gitgit Waterfall 与 Tulamben 已用场所官网及 Buleleng/Karangasem 政府来源核验稳定身份与区域语义；疗效、课程、教师、价格、水况、游泳与潜水执行条件不属于已核验范围。Thousand Islands Viewpoint 因官方来源不能证明唯一规范身份，继续 `pending_review`。
- 2026-08-16 POI batch 2 测试/UI 回调：全库 59 个 POI 更新为 53 verified、3 pending、3 supplier-gated；产品回归 39/39。Chrome 1440/768/390/320 与 WebKit 390 英文均确认目标状态、R6 横滑可达且页面/路线详情横向溢出为 0；静态服务器唯一控制台错误是未启动后端导致 `/api/portfolio` 404，不替代生产验证。
- 2026-08-16 POI batch 2 Luna 回调：正式 Agent `luna_worker` / `gpt-5.6-luna` / `max` 完成六节点只读来源审计并给出 5 GO / 1 NO-GO；任务前后 HEAD 均为 `93c4524`，工作树为空且零文件修改。Sol 已独立核对一手来源、实际 diff、JSON 计数、39 项测试与五视口浏览器证据后接受。
- 2026-08-16 POI batch 1 内容回调：Ulun Danu Beratan、Tegenungan、Jatiluwih、Lempuyang、Taman Ujung 与 Virgin Beach 已用印尼旅游部、Tabanan、Bali、Karangasem 政府来源核验稳定身份与位置；Bedugul/Ubud 仅保留路线分组，Lempuyang 明确区分 Penataran Agung 拍照门区与山顶寺庙，Virgin Beach 统一 Pantai Perasi 别名且不承诺游泳条件。
- 2026-08-16 POI batch 1 测试回调：全库 59 个 POI 更新为 48 verified、8 pending、3 supplier-gated；产品回归 39/39，测试锁定三处路线分组边界、Lempuyang 两地点层级和 Virgin Beach 安全承诺边界。
- 2026-08-16 POI batch 1 Luna 回调：正式 Agent `luna_worker` / `gpt-5.6-luna` / `max` 完成六节点只读一手来源审计并给出 6 个 GO，任务前后 HEAD 均为 `a6b4a6d`、工作树为空、零文件修改；Sol 已独立核对来源、实际 diff、JSON 计数和测试后接受。
- 2026-08-16 R5 内容回调：Tukad Cepung、Banyumala、Lake Tamblingan 与 Amed 已用 Bangli、Buleleng、Karangasem 政府及印尼旅游部来源核验稳定身份和区域语义；Mount Batur Sunrise Trailhead 因存在多个正式入口、Batur Hot Springs Area 因对应多个运营场所继续 `pending_review`，未擅自替用户选择入口或供应商。R5 与 Mount Batur Jeep 继续 `needs_supplier_confirmation`。
- 2026-08-16 R5 测试回调：产品回归 39/39；全库 59 个 POI 更新为 42 verified、14 pending、3 supplier-gated。R5 测试明确约束四个新核验节点、两个命名待审节点和一个 Jeep 供应商门禁，防止后续误把地点身份核验扩张成实时安全或成交承诺。
- 2026-08-16 R5 Luna 回调：正式 Agent `luna_worker` / `gpt-5.6-luna` / `max` 完成六节点只读来源审计，零文件修改；它反证了“六个全部升级”的初始假设并给出两个 NO-GO。Sol 已独立核对一手来源、实际 diff、JSON 状态和 39 项测试后接受该边界。
- 2026-08-15 R2 内容回调：The Yoga Barn、Pyramids of Chi 与 Tibumana Waterfall 已用场所官网、印尼旅游部和 Susut/Bangli 政府来源核验稳定身份；R2 免费路线 10 个节点全部 `verified`。课程、价格、余位、教师/主持人、waiver、活动适用性、退款、天气、水况、步道与游泳安全仍为实时检查，任何 wellness 文案不得转写成医疗或保证性疗效。
- 2026-08-15 R2 测试/UI 回调：产品回归 39/39；全库 59 个 POI 更新为 38 verified、18 pending、3 supplier-gated。Chrome 1440/768/320 与 WebKit 390 的 R2 状态、长场所名称、中英文重绘和控件可达性通过，页面与详情横向溢出均为 0。
- 2026-08-15 R2 Luna 回调：正式 Agent `luna_worker` / `gpt-5.6-luna` / `max` 于 2026-08-15T12:58:01+08:00 启动，只读来源审计最终状态 `complete`，耗时约 5.5 分钟且零写入；Sol 已独立核对其位置与预约建议、实际 diff、39 项测试及四视口证据后接受。Tibumana 的 G4/Ubud 仅保留为路线分组，稳定事实明确为 Susut/Bangli 语境。
- 2026-08-15 R6 内容回调：Pura Petitenget、Batu Bolong Beach 与 Echo Beach 已用 Badung 政府、印尼旅游部和宗教事务登记核验稳定身份、位置与文化/海岸语义；R6 免费路线 10 个节点全部 `verified`。仪式开放、着装、门票、潮汐、浪况、游泳安全、救生员、天气与交通仍为出发前动态检查。
- 2026-08-15 R6 测试/UI 回调：产品回归 39/39；全库 59 个 POI 更新为 35 verified、21 pending、3 supplier-gated。Chrome 1440/768/320 与 WebKit 390 的 R6 状态、三节点、添加地点和中英文重绘通过，页面与详情横向溢出均为 0。
- 2026-08-15 R6 Luna 回调：正式 Agent `luna_worker` / `gpt-5.6-luna` / `max` 于 2026-08-15T12:40:46+08:00 启动只读来源审计；因 Sol 按计划并行产生集成改动而触发任务包 STOP，最终状态为 `blocked`，未写文件。其来源审计已完整返回，Sol 独立核对来源、实际 diff、39 项测试和四视口证据后接受结论；不把该状态误写为“Luna 完成”。
- 2026-08-15 Dicky 五日路线 / R4 回调：不新建 R7；把五日内容作为 R1 的在地压缩校准，接送、餐食、酒店、道路和泛化购物不伪装为 POI。Blue Point 归一为 Suluban Beach；补齐佩妮达西线 Angel's Billabong 与东线 Diamond Beach、Rumah Pohon、Atuh Beach，Thousand Islands Viewpoint 因精确身份不足继续 `pending_review`。
- 2026-08-15 内容核验回调：R4 的 Goa Gajah、Kanto Lampo、Sidemen、Tirta Gangga 及 Celuk Village 已用政府/官方来源核验稳定事实；R4 Day 3 从“瀑布 + 稻田”纠正为“银饰村落 + 稻田”，免费路线 10 个节点全部 `verified`。Celuk 银饰课、Bali Fire Shooting Club 与 Mount Batur Jeep 保持供应商门禁。
- 2026-08-15 测试/UI 回调：后端产品回归 39/39 通过；Chrome 1440/768/320 与 WebKit 390 均完成 R4 状态、R1 Day 7 佩妮达候选及 Angel's Billabong 添加交互，页面级横向溢出为 0。旧 WebKit 2311 与 Playwright 1.62.1 不匹配，已在用户缓存安装 2336 后重跑通过，未写入仓库。
- 2026-08-15 Luna 审计回调：正式 Agent `luna_worker` / `gpt-5.6-luna` / `max` 执行只读 Dicky 差距与 backlog 审计，最终状态 `completed`；协作工具未暴露精确启动时间，台账不编造。Sol 已独立复核实际数据、diff、39 项测试、四视口浏览器证据和项目记忆校验后接受其审计结论。
- 2026-08-03 QA 终态回调：Sol 首轮发现同路径换图继承批准、关键词地点冲突和内容字段未必填 3 个 P1；全部修复并复审 GO，P0/P1 为 0；Region、用途与双语替代文字的剩余 P2 断言也已补齐。
- 2026-08-03 开发/测试回调：图片收件工具改为增量合并；唯一哈希改名保留人工字段，重复副本不继承批准；非巴厘岛明确地点不关联巴厘路线；专项测试、幂等检查和原后端 9 项 unittest 均通过。
- 2026-08-03 图片发布门禁：108 张中 23 张建议关联路线、15 张建议关联 POI；当前 0 张人工确认，因此发布 manifest 为 0，来源图片未移动、改名、覆盖或删除。
- 2026-08-03 总控回调：六条路线均已加入非比例空间示意；核心区域用金色实线、可选扩展用白色虚线，明确标注车程仍需最终核验。
- 2026-08-03 UI/测试回调：1440/768/390/320 四档 × R1–R6 共 24 组无横向溢出，控制台零错误；320px 地图标题和动作按钮经过二次修复。
- 2026-08-03 图片回调：台账更新至 108 张；85 张权属未知、1 张带水印继续阻断发布；未移动、删除或提交任何新增原图。
- 2026-08-03 QA/生产回调：Sol 仅审查 6 个暂存文本文件后 GO，P0/P1 均为 0；提交 3c04daa 已上线，首页、巴厘岛、AI 工具、司机页、路线 JSON 与 healthz 均为 200。
- 2026-08-02 总控回调：冻结 C1–C4——独立管理员、每行程 1 次完整粗路线 + 2 次调整、推荐积分、¥9.9 人工确认；未创建或伪造新的角色线程，当前任务内串行闭环。
- 2026-08-02 产品回调：吸收圆周旅迹“需求输入 → 结构化 POI → 可编辑日程 → 地图/交通优化”的任务流优势；不复制品牌、文案或素材，不把空白聊天框当主产品。
- 2026-08-02 内容与数据回调：建立 G1–G7 地理事实层、R1–R6 主题产品层及图片版权清单；有水印或权属待确认图片默认阻断发布。
- 2026-08-02 开发回调：产品行程额度、管理员无限权限、¥9.9 订单、推荐积分、Dicky/Gede 选择和全局账户入口已实现；固定司机价格已移除。
- 2026-08-02 UI 回调：保持既有 teal + gold 体系；路线优先于作品集，六路线移动横滑；320px 品牌、明暗按钮和菜单互不重叠。
- 2026-08-02 测试与 QA 回调：7 项后端回归通过；1440/768/390/320 的 6 个关键页面无页面级横向溢出；真实待确认订单已完成管理员确认和状态清空。
- 2026-07-19 阶段 2 架构回调：预算选择器、五语言、`budget_range`、后端转发和邮件双格式原已完整存在；路线图状态滞后，不重写业务链路。
- 2026-07-19 阶段 2 测试回调：发现语言切换后动态校验文案落后一种语言；已改为使用选择器当前值，消除监听器顺序依赖。
- 2026-07-19 阶段 2 UI 回调：保持现有 teal + gold 表单系统，预算控件继续位于接送信息与服务选择之间，不引入滑块或新视觉体系。
- 2026-07-19 阶段 2 验收回调：Chrome/Edge 五语言、预算稳定提交值、无效请求拦截、503 恢复、1440/768/390 无溢出、深色模式与邮件 HTML/text 均通过。
- 2026-07-19 阶段 2 QA 回调：独立审查 GO；diff 仅阶段 2 目标文件与角色台账，用户图片规划 txt 保持未跟踪。
- 2026-07-19：用户确认 B+C 定位；巴厘岛为默认主目的地，其他目的地必须保留并可扩展。
- 2026-07-19 技术回调：目的地采用“巴厘岛主链接 + 独立展开按钮”；桌面 hover、键盘 Enter/Esc、手机 tap 均通过；巴黎/京都/圣托里尼/任意目的地链接保留。
- 2026-07-19 内容回调：采用产品聚焦、MVP 验证、风险边界三种镜片；流量和商业模式镜片延后；删除无依据起价与保证性表达。
- 2026-07-19 QA 回调：1440/768/390 无横向溢出，五语言新增键零缺失，深色模式与减少动画通过，Chrome/Edge 表单请求均含完整参数。
- 2026-07-19 生产回调：Render 已上线 p48；首页、healthz、巴厘岛、服务、司机和 AI 页面均为 200；生产悬停、键盘、触屏与完整表单参数通过，控制台零错误。
- fail-closed callback status：角色 marketplace 插件未启用，未伪造角色线程；采用当前任务内串行降级并完成同等检查。
- 2026-07-27 架构回调：`/api/dest_info` 对 Bali 与 Seoul 均返回 402 `insufficient_balance`；页面、`/healthz` 与独立天气接口正常，根因是主模型账户余额不足，不是前端、CORS 或天气配置。
- 2026-07-27 开发回调：预设目的地在 AI 上游失败时保留基础资料与独立实时天气；任意目的地继续使用明确错误态；状态按当前目的地隔离，空白“其他目的地”会清除旧提示。
- 2026-07-27 UI 回调：保持既有 teal + gold 视觉体系；修复固定标签栏、移动操作栏与详情抽屉的顶部遮挡，并在 420/340px 以下压缩品牌占位。
- 2026-07-27 测试回调：Chrome、Edge、WebKit 覆盖 320/360/375/390/412/430/768/844×390/1440；无横向溢出，五语言重绘不增加请求，Retry 成功后状态不复活，hamburger 展开/收起高度同步。
- 2026-07-27 QA 回调：独立 QA 最终 GO；用户图片规划 txt 与本轮新增图片均未进入 diff、未被触碰；WebKit 不能完全替代实体 iPhone Safari 真机抽查，列为非阻断风险。
- 2026-07-27 fail-closed 回调：`prepare_role_window.py` 因缺少 `registry/plugin-packages.json` 未创建持久角色窗口；未伪造 thread id，改用当前任务内开发、UI、QA 角色并回写本台账。
- 2026-07-27 生产回调：p50 已上线；真实 `/api/dest_info` 仍为 402、独立天气为 200。Chrome 320、WebKit 390、Edge 1440 均显示基础资料降级与真实天气，Details 立即点击、hamburger 动态 30 帧、五语言不重复请求、空白任意目的地清状态、无横向溢出和零页面错误全部通过。
- 2026-08-03 架构/开发回调：`/api/dest_info` 已拆分为稳定精选资料、独立实时天气和登录后 AI 草稿三层；巴厘岛、京都、巴黎、圣托里尼的五语资料由版本化 JSON 静态直出，不调用模型；任意目的地按城市与语言隔离缓存，精确别名匹配避免 `Paris, Texas` 误命中巴黎。
- 2026-08-03 UI/测试回调：保持 teal + gold 体系；精选资料、实时天气、AI 草稿分别标注来源；修复五语言切换后资料未同步的问题。1440/768/390 无页面级横向溢出，匿名任意目的地不会泄漏上一目的地资料，并明确引导登录；后端 12 项测试通过。
- 2026-08-03 QA 终态回调：Sol 首审发现自定义天气缓存鉴权、旧汇率边界、目的地/语言/会话竞态和文档旧口径；全部修复后复审 GO，P0/P1/P2 均为 0。延迟响应测试确认 A→B、语言切换及请求中登出均不会被旧响应覆盖或重新写入受保护缓存。
- 2026-08-03 开发/UI 回调：六条巴厘岛路线升级为按天编辑器；可调整天序、添加/移除同区域 POI，所选日期与区域地图同步高亮，结构化草稿自动保存在本机并可导入 AI 或司机询价表单；保持现有 teal + gold 视觉。
- 2026-08-03 测试回调：Chrome 1440/768/390/320 与 WebKit 移动端 402px 均无页面级或路线详情横向溢出；六路线均有可编辑日程和兼容 POI；鼠标、键盘 Enter、移动端 tap、持久化重载及司机表单导入均通过。
- 2026-08-03 QA 终态回调：Sol 两轮反证推动修复污染计划 fail-closed、跨日 POI 去重、路线语言口径和 AI/司机精确 `route_id` 交接；最终复审 GO，P0/P1/P2 均为 0，暂存区仅含 8 个目标文件。

## 技能命中

- 2026-08-16 司机询价持久化反滥用实际使用：cross-account-project-memory 从 batch 2 的远端 0/0 同步点建立独立 `codex/driver-request-rate-limit` worktree；agent-role-orchestrator 采用 medium/L2 和开发→测试→QA 回调；codex-luna-worker 派发正式 Luna Max 首轮架构审计与第二轮对抗性 QA，Sol 独立复核实际 diff、43 项测试和官方数据库语法文档。未加载 UI workflow、浏览器自动化、女娲或人物 Perspective：本轮无页面视觉、品牌、内容或商业判断，避免制造无关技能命中。
- 2026-08-16 POI batch 2 实际使用：cross-account-project-memory 从 batch 1 远端同步点建立独立 `codex/poi-facts-batch2` worktree，并要求 evidence/handoff/远端一致性门禁；agent-role-orchestrator 采用 medium/L2 与来源 fail-closed；codex-luna-worker 派发正式 Luna Max 六节点只读审计并由 Sol 复核；ui-implementation-workflow 将范围限定为既有 content/detail 数据增量；browser-automation-router 选择 Playwright，Chrome 1440/768/390/320 与 WebKit 390 英文均无页面/详情横向溢出。`prepare_role_window.py` 仍因缺少 `registry/plugin-packages.json` fail-closed，未伪造持久角色窗口。未使用女娲/Perspective：地点身份、医疗与潜水安全边界必须由一手来源和实际供应商确认。
- 2026-08-16 POI batch 1 实际使用：cross-account-project-memory 从 R5 远端同步点建立独立 `codex/poi-facts-batch1` worktree；agent-role-orchestrator 采用 medium/L2 和 fail-closed 来源门禁；codex-luna-worker 派发正式 Luna Max 六节点只读审计并由 Sol 复核；ui-implementation-workflow 将页面归为既有 content/detail 数据增量，不新增参考、token 或样式；browser-automation-router 选择 Playwright，Chrome 1440/768/390/320 与 WebKit 390 英文均无页面/详情横向溢出。`prepare_role_window.py` 仍因缺少 `registry/plugin-packages.json` fail-closed，未伪造持久角色窗口。未使用女娲/Perspective：事实身份、行政位置和安全边界不能由人物顾问替代。
- 2026-08-16 R5 轮实际使用：agent-role-orchestrator 约束 medium/L2 路由、来源回调和 fail-closed 记录；codex-luna-worker 独立反证六节点可核验性；ui-implementation-workflow 将范围限定为既有 portfolio 页的数据增量；browser-automation-router/Playwright 用于四视口确定性验收。`prepare_role_window.py` 仍因缺少 `registry/plugin-packages.json` fail-closed，未伪造持久角色窗口。未使用女娲或人物 Perspective：本轮出现的是入口/供应商事实缺口，不应由顾问风格替代真实授权。
- 2026-08-15 R2 轮实际使用：agent-role-orchestrator 继续约束 L3 回调与事实边界；codex-luna-worker 独立核验三个主路线节点；ui-implementation-workflow 限定既有 portfolio 页面内的数据增量；browser-automation-router/Playwright 完成 Chrome/WebKit 四视口验证。未使用女娲或人物 Perspective：医疗/疗效边界由一手来源、现有产品规则和最小承诺原则即可确定。
- 2026-08-15 R6 轮实际使用：agent-role-orchestrator 约束 L3 路由、事实回调和 fail-closed 记录；codex-luna-worker 仅委派边界明确的只读来源审计；ui-implementation-workflow 将本轮限定为既有 portfolio 页面内的数据更新，不新建设计；browser-automation-router 选择确定性 Playwright，Chrome/WebKit 四视口完成交互与响应式验收。`prepare_role_window.py` 仍因缺少 `registry/plugin-packages.json` fail-closed，未伪造持久角色窗口；未调用女娲或人物 Perspective，因为没有新增商业、定价或品牌判断。
- 2026-08-15 实际使用：agent-role-orchestrator 约束 L3 路由与回调；codex-luna-worker 仅委派只读、边界明确的差距审计；ui-implementation-workflow 保持 teal + gold 和 tiny/small 增量边界；browser-automation-router 选择确定性 Playwright；Playwright CLI 完成 Chrome/WebKit 四视口真实交互。未使用女娲或人物 Perspective，因为本轮没有新增商业承诺或定价裁决。
- 2026-08-03 路线编辑器轮实际使用：agent-role-orchestrator、ui-implementation-workflow、browser-automation-router、Playwright CLI；按 medium/L3 路径完成现状审计、既有风格内实现、Chrome/WebKit 响应式交互验证并通过 Sol 最终门禁。WebKit 26.5 安装在 `E:\CodexBrowserCache`，未写入项目仓库。
- 2026-08-03 本轮实际使用：agent-role-orchestrator、ui-implementation-workflow、browser-automation-router、Playwright CLI；分别约束 L3 角色台账、既有页面风格、确定性浏览器路径以及桌面/平板/手机验收。`prepare_role_window.py` 仍因缺少 `registry/plugin-packages.json` fail-closed，未伪造持久角色窗口；最终复用现有 Sol 审查窗口。
- 2026-08-03 当前轮影响产出的 skill：agent-role-orchestrator 触发 L3 台账和 Sol 门禁；Sol 的独立反证直接发现并推动修复 3 个 P1。未使用 UI、浏览器、女娲或人物 Perspective，因为没有页面视觉或新商业判断。
- 2026-08-03 当前轮实际使用：agent-role-orchestrator；按 medium/L3 路径组织开发、测试和 Sol 独立门禁。UI 工作流未使用，因为本轮只改本地素材治理工具、数据与文档，没有页面视觉改动。
- 2026-08-03 当前轮 fail-closed：`prepare_role_window.py` 仍缺少 `registry/plugin-packages.json`，未伪造开发/测试持久窗口；复用已知 Sol 审查窗口。
- 2026-08-03 实际使用：agent-role-orchestrator、ui-implementation-workflow、browser-automation-router、Playwright CLI；分别约束 L3 回调、既有风格、浏览器路径和四尺寸生产验收。用户要求的 Sol 复用现有审查窗口完成最终门禁。
- 2026-08-03 未使用：huashu-nuwa 与人物 Perspective Skill；本轮没有新的商业、定价或内容承诺判断，避免为已确认的路线可视化任务制造额外顾问。
- 2026-08-02 实际使用：agent-role-orchestrator、ui-implementation-workflow、browser-automation-router、Playwright CLI、huashu-nuwa；分别约束角色台账、既有风格、浏览器路径、响应式验收和真实商业边界。
- 2026-08-02 fail-closed：没有可复用的新角色 thread id，未新建或伪造角色窗口；所有回调留在当前任务并写回本台账。
- 阶段 2 实际使用：agent-role-orchestrator、ui-implementation-workflow、browser-automation-router；开发、测试、QA 按角色闭环执行。
- 阶段 2 未使用：huashu-nuwa 与人物 Perspective Skill；本阶段范围与产品判断无分歧，无需制造或调用顾问。
- 实际使用：agent-role-orchestrator、nuwa-skill、ui-implementation-workflow、browser-automation-router、humanizer-zh、frontend-design。
- 影响产出：限定了主次目的地、公开承诺边界、响应式三档、键盘/触屏状态、深色模式与减少动画验收。
- 必选未用：无。角色插件窗口本身因 marketplace 门禁未启用而 fail-closed，已执行本地降级。
- 2026-07-27 实际使用：agent-role-orchestrator、ui-implementation-workflow、browser-automation-router；开发、UI、测试、QA 按角色闭环执行。
- 2026-07-27 未使用：huashu-nuwa 与人物 Perspective Skill；本轮是已确认根因的可靠性修复，不需要新增产品或商业顾问判断。

## 2026-08-03 Bali visual portfolio callback
- Scope: medium / L3. The persistent role-window preparation remained fail-closed because `registry/plugin-packages.json` is absent; no thread id was invented.
- UI callback: retained the existing teal + gold visual system and replaced the mixed gallery filters with an AND-combined travel-theme plus photo/travel-tag taxonomy.
- Test callback: backend unittest, image-intake tests, Chrome desktop/mobile, and WebKit mobile checks passed locally; the final Sol release gate remains pending.
- Image governance: 108 source images are listed, 55 have subcategory suggestions, 23 have route suggestions, 15 have POI suggestions, and 0 unconfirmed images enter the publish manifest.
- Skill hits: agent-role-orchestrator constrained L3 routing and callbacks; ui-implementation-workflow constrained style variance and responsive behavior; browser-automation-router selected deterministic Playwright CLI verification.
- Sol first gate: NO-GO with one P1 because the staged CSV mixed hashes from untracked/unstaged source images into the deployment snapshot; the CSV is being removed from the staged release and documented as a local operational ledger. Two P2 items cover the operational-only `people` class boundary and localized filter group labels.
- Sol final gate: GO; P0/P1/P2 are all 0 after excluding CSV/images from the release snapshot, documenting the `people` boundary, and localizing both filter-group aria labels.

## 2026-08-03 gallery-to-trip handoff callback
- Scope: medium / L3. `prepare_role_window.py` remained fail-closed because `registry/plugin-packages.json` is absent; no persistent role thread was invented.
- Product callback: the local WanderMind advisor framework kept the change on the task-flow path: image decision context -> matched R1-R6 route -> AI or driver handoff.
- UI callback: retained the existing teal + gold portfolio modal, added two compact decision cards and a matched-route row, and converted mobile actions to full-width controls.
- Development callback: gallery links now carry `place`, `route`, and `source=gallery`; Bali route query selection takes priority over the saved brief; AI prompts include the matched route; driver forms accept a gallery place without requiring stored trip data.
- Test callback: 13 backend tests, Node syntax, diff checks, Chrome 1440/768/390/320, and WebKit 390 have passed locally; Sol release gate and production verification remain pending.
- Skill hits: agent-role-orchestrator set the L3 callback contract; ui-implementation-workflow constrained visual variance and responsive repair; browser-automation-router selected deterministic Playwright CLI; the project-local Nuwa-derived advisor framework constrained the structured handoff and fact boundaries.
- Sol final gate: GO; P0/P1/P2 are all 0. The staged release contains 9 text/code files and no CSV or images; route selection, five-language modal redraw, editable AI input, driver prefill, responsive evidence, and the real `#route-families` target were accepted.

## 2026-08-03 production mobile overflow repair callback
- Production QA callback: Chrome 320px in English returned NO-GO because the page was 216px wider than the viewport after language switching.
- Root cause: long English gallery-filter labels expanded a CSS grid item's min-content width; the route and filter carousels now have explicit width, min-width, max-width, and internal horizontal overflow containment.
- Local verification: Chrome 320px English and WebKit 390px English both report zero document overflow; route R1-R6 and both filter rows remain internally scrollable to their final item.
- Regression coverage: the Bali static contract rejects the former negative route margin and requires the mobile carousel containment rules; all 13 backend tests, Node syntax checks, and diff checks pass.
- Sol final gate: GO; P0/P1/P2 are all 0. CSV, image files, and every unrelated user workspace change remain outside the release.
- Production final gate: commit `6b95616` is live. Chrome 320px English, WebKit 390px English, and Chrome 1440px English report zero document overflow; R5 selection, R6 reachability, gallery modal, AI draft prefill, and driver-place prefill all passed with zero Bali-page console errors.

## 压缩交接卡

- 最近摘要：巴厘岛 POI 当前为 53 verified、3 pending、3 supplier-gated；外部事实门禁未伪造。本轮把司机询价 5 次/30 分钟限流从进程内字典迁移为 SQLite/Postgres 持久化 HMAC 伪匿名原子计数，43 项产品测试通过。
- 关键决策：保持 Claudecode teal + gold；巴厘岛主、其他目的地次；泛化执行步骤不伪装为 POI，活动供应商和动态条件不冒充已核验稳定事实。
- 当前证据：正式 Luna Max 首轮审计和第二轮 QA、Sol diff 复核、43 项回归、SQLite 8 线程并发及连续 10 轮稳定性测试通过；表结构断言确认只含 `client_key/window_started_at/request_count/updated_at`，数据库异常时不发送邮件。真实 Neon/Postgres 和 Render 代理地址尚未验证，不得写成生产完成。
- 下一步：完成本轮 evidence/handoff、提交和远端 0/0；进入发布流程前先在隔离环境跑一次真实 Postgres schema/并发测试，再在部署后只读确认 Render 下 `request.client.host` 的匿名分布，不记录原始地址。未合并到 `main`、未生产部署前不得声称网站已更新。
- 新窗口接续提示：从本轮 task branch、evidence 和 handoff 接续；不得删除用户根目录下的旅行图片分类规划 txt。

## 2026-08-16 cross-account recovery callback

- 总控回调：`cross-account-project-memory` 成功定位上一账号累计成果于远端分支 `codex/driver-request-rate-limit`；当前账号在独立 `E:\Agentstrip2-worktree` / `codex/account2-integration-20260816` 接续，未触碰旧脏工作树。
- 三层回调：GitHub `main` 为 `3fbf898`；累计分支 `1e3da86` 为 ahead 34 / behind 0；生产前端仍匹配 main 基线，Bali 数据为 6 routes / 50 POIs，累计分支为 6 routes / 59 POIs，故最新成果尚未部署。
- 测试回调：Sol 复跑 43/43，通过 10 轮 SQLite 8 线程原子计数；正式 `luna_worker` / `gpt-5.6-luna` / `max` 完成只读对抗审查并确认本地实现可接受，但真实 PostgreSQL 和 Render 代理地址仍为生产 P0 门槛。
- 路由终态：large / L2；Sol 保留集成、GitHub、发布和最终验收，Luna 只负责边界明确的只读复核；最终状态 `completed`，未把等待超时写成失败。
- 技能命中：cross-account-project-memory 约束权威事实和一账号一 worktree；agent-role-orchestrator 约束分发与回调；codex-luna-worker 执行独立数据库风险复核；browser-automation-router/Playwright 完成生产浏览器验收；github/yeet 约束显式文件提交、分支推送与 Draft PR。
- GitHub 回调：当前账号分支已推送并建立 Draft PR #3；PR 可合并但保持 Draft，Project memory validation 成功；未合并、未部署、未改 Render 变量或数据库，下一回调固定为隔离 PostgreSQL 门禁。
- PostgreSQL 回调：新增只允许 localhost/127.0.0.1 的专项集成测试；GitHub Actions 临时 PostgreSQL 16 中 4/4 通过并明确使用 postgres 后端，覆盖并发、固定窗口、重初始化持久化和 BIGINT/索引。真实 PostgreSQL 门禁关闭，下一门禁为 Render canary 代理隔离与部署后生产 E2E。
- 2026-08-16 Render canary 接续回调：Computer Use 插件与功能开关已启用，但当前任务未注入 `node_repl/@oai/sky`、Chrome 或 Browser 控制工具，故账号内 Render 配置、canary 和部署后 E2E 继续 fail-closed；PR #3 保持 draft/open/mergeable，当前两项 Actions 成功，公开生产仍为 health 200 与 6 routes / 50 POIs 旧基线。未读取或显示任何 Secret，未合并、未部署、未改变 PR 状态；下一步必须完整重启 Codex Desktop 并新建任务，先验证控制工具存在再接续。

## 2026-08-16 Bali public-to-professional route sync callback

- 路由：medium / L2。Sol 保留产品语义、权益保护、集成、浏览器验收和发布判断；正式 Agent `luna_worker`（Locke，`gpt-5.6-luna`，`max`）于 `2026-08-16T21:22:33+08:00` 启动，只读核对状态流与 Git 历史，最终状态 `completed`，从启动到首次收到 final 约 5 分钟；等待窗口超时未被写成失败。
- Luna 回调：确认“首访画像匹配 R1”是既有规则，但公共 R2–R6 卡片只更新 `activeId`、未通知专业模块属于前端状态同步缺陷；未修改文件、未访问生产或凭据。Sol 对照实际代码和历史文档后接受该结论。
- 实现回调：未解锁专业预览跟随公共路线选择并同步 URL/deep link；已解锁路线只记录待切换 route，普通浏览不扣次，提交“调整本次行程”才通过 `/adjust` 携带 route_id 并使用 1 次调整；3 次额度、¥9.9、30 积分、70% 预览和 AI 独立额度均未改变。
- UI/QA 回调：UI UX Pro Max 要求明确 active state、URL state 与触屏布局；Vercel Web Interface Guidelines 要求 URL 反映状态并为异步反馈提供 `aria-live`。Edge 回调验证 R1→R3、已解锁不暗扣、提交后剩余 2 次、五语言提示、320/390/768/1440 零横向溢出，console/page errors 均为 0；43 项后端测试、Node 语法和 diff check 通过。
- Skill 回调：安装并审查 `AgriciDaniel/claude-seo@seo`（MIT、约 14.2k GitHub Stars、活跃维护、安全策略完整）到用户级 Skills；未改项目仓库。拒绝安装较旧且会在个人目录持久化旅行偏好的通用 travel-planner 候选。
- 生产边界：当前任务未注入右侧内嵌浏览器控制通道，按用户要求停止排障；Render、生产数据库、环境变量、合并和部署均未触碰，不能声称生产已更新。
