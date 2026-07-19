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
