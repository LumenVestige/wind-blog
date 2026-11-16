# 开发协作工具迁移至 AgentDevWorkSpace

时间：2026-11-15 12:44:46

## Outcome

开发协作工具安装脚本改用 AgentDevWorkSpace 仓库和目录。加入通用 SDD、Note、知识检索和 Git 提交技能，在 AGENTS.md 中声明工作区规则，并忽略本机配置、运行环境和个人约束。

## Verification

- `node --check scripts/dev/agent-skill.mjs` 通过。
- 使用项目虚拟环境的 Python 对 4 个 Python 文件执行 `ast.parse`，对 6 个 Shell 文件执行 `sh -n`，全部通过。
- `git diff --cached --check` 通过。
- 未执行安装脚本的克隆、更新及初始化流程；本次不涉及博客业务代码，未运行业务测试。

## Git 提交

```
79f9a2e [update] 开发协作工具迁移至 AgentDevWorkSpace；加入工作区技能与项目约定
```
