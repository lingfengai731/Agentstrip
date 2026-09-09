# AGENTS.md

本文件只记录 WanderMind / Agentstrip 的项目级差异规则；通用沟通、修改、验证和 Luna 细节继承用户级 `AGENTS.md`。

## 项目连续性

- 持续开发、发布、跨账号接续或状态审计时，先使用 `$cross-account-project-memory`，核对仓库路径、worktree、branch、HEAD、dirty、远端、`PROJECT_CONTEXT.md`、最新 handoff 与 evidence。
- 不在来源复杂的脏 `E:\Agentstrip` 工作区开发。每个账号使用独立的干净 worktree 和 `codex/` 任务分支，并保留用户图片、文档、`.idea`、`output` 和其他无关未提交内容。
- 事实优先级：新鲜生产验证 > 当前代码、Git、PR、CI > `PROJECT_CONTEXT.md` / evidence > handoff > 旧聊天或记忆。不得把本地、已推送、已合并、已部署和已生产验收混写。

## 角色与委派

- 只有总控、架构、多角色派发、回调或角色台账任务必须先使用 `$agent-role-orchestrator` 并读取 `.codex/role-windows.md`；普通单点实现或检查不因此启动额外角色流程。
- `.codex/role-windows.md` 是角色窗口 source of truth：已有任务 ID 时复用；状态不明写“待确认”，不得猜测。
- 主线程由用户当前选择且可用的模型负责产品判断、集成、最终验收与发布决策。选择 Astra、Sol 或 Terra 不改变 Luna 的独立 worker 边界。
- 路由模式为 `auto`。仅当任务独立、可验收且收益高于协调成本时使用 `$codex-luna-worker`；写任务必须在独立 worktree 中执行，主线程验收实际 diff 与相关测试。

## 产品与发布边界

- 涉及支付、真实用户权益、数据库删除、生产凭据或不可逆外部操作时，保留现有权益与数据；新增授权不能推导为删除或降权授权。
- PayPal 保持 Sandbox，除非用户明确授权 Live。不得恢复个人银行转账；不得在记录、命令输出或前端中泄露密钥、Cookie、司机私人联系方式或用户隐私。
- GitHub 合并与 Render 部署是两种状态。合并后必须核对实际部署 commit、状态和公共端点，才能写“已上线”。
- 网站和小程序的用户可见改动按风险运行对应的桌面/移动、五语言、关键流程和控制台验证；没有对应证据不得标记完成。

## 设计工作流

- 以 WanderMind 现有视觉语言、信息架构和已确认产品路径为基线，不因引入新 Skill 全站重写。
- UI 实施以 `$ui-implementation-workflow` 为主流程；其他设计 Skill 只提供专项建议或参考，不能各自启动重复的完整审计。
- `$design-taste-frontend` 仅用于营销、Portfolio 或明确重设计场景的视觉参考；不得复制第三方品牌资产。
- `$yueban-image-to-code` 仅用于有明确参考截图且要求高保真复刻的局部页面，不用于普通表单、后台或无截图设计。
