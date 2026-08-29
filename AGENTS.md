# AGENTS.md

<!-- BEGIN agent-role-orchestrator entry rule -->
## Agent Role Orchestrator Entry Rule

- 总控/架构/多角色/派发/回调/台账类任务必须先使用 agent-role-orchestrator。
- 执行前必须读取：
  - 已安装的 agent-role-orchestrator/SKILL.md（通常位于 `${CODEX_HOME:-$HOME/.codex}/skills/agent-role-orchestrator/SKILL.md` 或 Windows `%USERPROFILE%\.codex\skills\agent-role-orchestrator\SKILL.md`）
  - .codex/role-windows.md
- 若未读取，不允许创建、继续或派发角色窗口；状态未知一律写“待确认”。
- .codex/role-windows.md 是角色路由 source of truth：有线程 ID 就复用，不新建；误开、废弃、纠偏也必须记录。
- 下游角色完成、阻塞或需要决策时，回调任务发起窗口，不默认全部回总控或架构。
<!-- END agent-role-orchestrator entry rule -->

## Custom subagent dispatch principles

- 本项目路由模式为 `auto`：主线程优先使用 `gpt-5.6-sol` + `high`；每个执行阶段先使用 `$codex-luna-worker` 判断是否适合委派；自动调用前只做简短进度告知，主线程模型和最终所有权保持不变。
- 对体量较大且相互独立的子任务，优先在完成角色路由入口检查后派发给一个或多个正式 Agent `luna_worker`（`gpt-5.6-luna` + `max`）处理；`luna_wb` 仅作为兼容别名；这些规则同样适用于其他自定义 subagents。
- 几分钟内能够完成、范围很小且可直接验证的轻量任务，直接留在主线程，不为此额外派发 worker。
- 每个 worker 的任务描述必须上下文完整，明确文件范围、任务边界、预期输出、验收标准和停止条件。
- 只读任务可以并行；涉及文件写入时，必须使用相互独立的 worktree；无法隔离时改为串行执行。
- worker 完成后，主线程必须按照任务中给出的验收标准检查结果；未达标时重新派发修复或复核任务，不得将未验证结果视为完成。
- 如果多个 worker 无法并行，先检查 `config.toml` 中的 `agents.max_concurrent_threads_per_session` 是否被设置为 `1`，再判断是调整路由还是改为串行。
- 后续需要调用符合上述边界条件的子代理时，优先使用正式 Agent `luna_worker`；主 Agent 负责拆解任务、提供完整上下文并验收结果，`luna_worker` 只负责执行独立子任务；已有旧任务明确指定 `luna_wb` 时才使用兼容别名。
