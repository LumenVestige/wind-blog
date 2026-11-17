# 删除 setup-agent-workspace 命令及相关脚本

类型：功能（feature）　编号：001　负责人：sanyinchen　状态：已完成

## 范围

依据用户明确需求，移除项目内的 AgentDevWorkSpace 安装命令及配套文件；不卸载已有工作区，不修改全局安装、Hook、通用技能或历史 Note。

## 约束检查

通用约束见 [constraints.md](../../../skills/common/sdd/constraints.md)，个人约束见 [constraints.md](../../specs/constraints.md)。两份约束中的条目均为示例，本需求按以下方式落实，不修改约束本身。

- C1：符合；仅修改开发工具入口，不涉及业务模块调用。
- C2：符合；沿用目录约定，不新增依赖。
- C3：符合；为 R1–R3 提供无需项目依赖的自动化检查。
- C4：符合；无密钥、接口或数据格式变更；只移除指定 npm 命令，既有工作区不受影响。
- C5：符合；同步清理 README，并新增行为变更 Note。
- P1：符合；新增检查保持短小，注释只说明必要的设计原因。
- P2：不涉及提交；本次不 commit，仅运行覆盖本次改动的检查，遵循工作区规则；项目尚未安装 node_modules。
- P3：按用户明确给定的删除范围执行并报告进度；示例不额外引入审批步骤。

## 验收标准

- [x] R1：package.json 不再注册 setup-agent-workspace；npm run 的可用命令列表不再显示该命令。
- [x] R2：安装入口 scripts/dev/agent-workspace.mjs、专属测试 tests/agent-workspace.test.ts 被删除；README 不再提供该命令、入口或专属环境变量的说明。
- [x] R3：其他 npm 脚本不变，现有 agent-workspace/、通用技能、历史记录及用户未提交改动均保留；不触发安装或更新外部工具。
