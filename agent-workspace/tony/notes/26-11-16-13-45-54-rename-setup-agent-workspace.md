# 安装命令统一为 setup-agent-workspace 并确保重复执行更新仓库

时间：2026-11-16 13:45:54

## Outcome

- npm 命令改为 `setup-agent-workspace`，入口脚本改为 `scripts/dev/agent-workspace.mjs`；移除旧命令，仓库地址覆盖变量统一为 `AGENT_WORKSPACE_REPO`。
- 首次执行克隆 AgentDevWorkSpace；目录中已有 Git 仓库时直接执行 `git pull --ff-only`，成功后重新执行 `setup.sh`。更新失败时立即退出，不再跳过拉取后继续初始化，也不强制覆盖本地文件。
- README 和工具仓库忽略路径同步更新；文档说明客户端 Hook 仍需要审阅与信任。
- 实际运行新命令，已有工具仓库从 `75ea60f` 更新到 `a2210f1`，初始化完成；保留 setup 自动同步的项目约定、技能和调研模板。

## Verification

- `node --check scripts/dev/agent-workspace.mjs` 通过。
- `npm test -- tests/agent-workspace.test.ts`：3 项集成测试通过；使用本地 Git 仓库与 npm 命令覆盖首次克隆、重复执行、拉取新提交、更新冲突保留本地文件且不执行 setup、目标目录非仓库等场景。
- `PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1 npm run setup-agent-workspace`：实际更新远程仓库并初始化成功，Python 虚拟环境与依赖检查通过。
- `git diff --check` 通过；未运行业务测试。
