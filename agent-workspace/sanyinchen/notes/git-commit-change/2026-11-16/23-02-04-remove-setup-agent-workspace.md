# 删除项目内 AgentDevWorkSpace 安装命令及配套脚本

时间：2026-11-16 23:02:04

## Outcome

- 移除 package.json 中的 setup-agent-workspace 命令，删除 scripts/dev/agent-workspace.mjs 及 tests/agent-workspace.test.ts 的三项旧安装测试。
- 清理 README 中的安装命令、可选工具安装章节、专属配置说明和入口文件条目。
- 现有 agent-workspace/、历史 Note、Hook、全局安装和用户未提交改动保留；.gitignore 继续忽略可能遗留的旧工具克隆目录。
- 按 SDD 新建 feature 文档与独立自动化验收检查；不新增依赖，不 commit、不 push。

## Verification

- Node 内建验收检查：删除前 R1、R2 失败，R3 通过；删除后 3/3 通过。
- npm run：输出不再包含被删除的命令，其余 npm scripts 与原配置一致。
- 排除 agent-workspace/ 历史与需求记录后，项目中未发现旧命令、入口脚本或专属环境变量引用。
- 未运行全量业务测试：项目未安装 node_modules，本次仅删除开发工具接入能力。

## 关联需求

[feature/001](../../../feature/001-删除setup-agent-workspace命令及相关脚本/summary.md)
