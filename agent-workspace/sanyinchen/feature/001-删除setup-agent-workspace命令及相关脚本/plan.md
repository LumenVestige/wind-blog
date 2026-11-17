# 删除 setup-agent-workspace 命令及相关脚本：方案

关联：[spec.md](spec.md)

## 方案概述

删除 npm scripts 中唯一安装入口，删除该入口脚本及其三项专属集成测试；清理 README 命令清单、可选安装章节与目录结构条目。无需修改 package-lock.json，因为未变更依赖或锁文件元数据。

保留 agent-workspace/ 及所有历史文档、Hook 和用户已有改动。保留 .gitignore 对旧工具克隆目录的忽略规则，防止本地遗留克隆被误纳入版本控制；该规则不提供安装能力。业务接口、数据库及其他 npm 命令均不改动。

## 改动范围

- 修改：package.json、README.md。
- 删除：scripts/dev/agent-workspace.mjs、tests/agent-workspace.test.ts。
- 新增：本需求 spec / plan / tasks / summary，以及 [01-validation/check-removal.mjs](01-validation/check-removal.mjs) 和行为变更 Note。
- 接口：仅移除 npm run setup-agent-workspace，不新增替代命令。
- 数据格式：无变更；不卸载已安装的 AgentDevWorkSpace。

## 验证

先运行 Node 内建测试得到失败，删除目标后复跑；检查 npm run 清单、搜索遗留引用、检查 diff 格式及 SDD 目录布局。项目未安装 node_modules，不为此次纯删除改动安装依赖或运行无关的业务测试。

Note 校验只调用其本地 check_notes 逻辑，禁用自动更新入口，避免本次授权范围外的全局更新。
