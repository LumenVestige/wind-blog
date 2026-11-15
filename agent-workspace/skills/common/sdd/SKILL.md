---
name: sdd
description: Spec-Driven Development 流程。用户输入「创建feature:<名称>」「创建bugfix:<名称>」「创建change:<名称>」（或 new_feature / new_bugfix / new_change <名称>）时，或开始新功能、跨模块的改动前使用：先读通用开发约束和个人约束，再按 spec → plan → tasks → 实现 推进；说明三种类型的创建命令、目录、编号规则、约束、模板和每一步要写什么。
---

# SDD

新功能、bug 修复和变更都可以按 spec → plan → tasks → 实现 推进。新功能和跨模块的改动必须走这个流程；
用户没有用快捷命令、且只是文案、小 bug 之类的小改动时可以跳过。

## 快捷命令

用户输入下面的命令时（冒号可以是全角，前后可以有空格，例如 `创建 bugfix：登录超时`），在项目根目录执行对应的脚本：

| 用户输入 | 类型 | 执行 |
|---|---|---|
| `创建feature:<名称>` 或 `new_feature <名称>` | 新功能 | `sh agent-workspace/skills/common/sdd/new_feature.sh "<名称>"` |
| `创建bugfix:<名称>` 或 `new_bugfix <名称>` | bug 修复 | `sh agent-workspace/skills/common/sdd/new_bugfix.sh "<名称>"` |
| `创建change:<名称>` 或 `new_change <名称>` | 变更：重构、依赖升级、配置或行为调整等 | `sh agent-workspace/skills/common/sdd/new_change.sh "<名称>"` |

- 脚本在当前用户个人目录的对应类型文件夹下新建目录（见下面「目录」），复制该类型的 `spec.md`、`plan.md`、`tasks.md` 模板，填入名称、编号、负责人，最后输出目录的路径；
- 目录和模板由脚本创建，不要手工复制模板；同类型同名已存在时脚本报错，此时告诉用户已有的目录，不要另建；
- 创建后告诉用户目录的路径，然后从下面流程的第 0 步开始。

每次新对话开始时，SessionStart hook 会向用户展示这些快捷命令（`welcome.md`）。

## 约束

有两层约束，所有类型都必须遵守：

通用开发约束：本 skill 目录下的 `constraints.md`，全项目共享。

- 位置：`agent-workspace/skills/custom/sdd/constraints.md`（项目定制过 sdd 时）或 `agent-workspace/skills/common/sdd/constraints.md`；
- 每条约束有编号（C1、C2…），按架构、编码、测试、安全与兼容、文档分节；初始内容是示例；
- `common/` 每次执行 setup 都会被模板包覆盖，项目要定制约束（或模板、欢迎语）时，先把整个 `common/sdd/` 复制到 `custom/sdd/` 再修改，之后加载和执行的都是 custom 中的版本；
- 修改约束会改变全项目的约定，须经用户（团队）确认，不在实现某个需求时顺手修改。

个人约束：`agent-workspace/<个人目录>/specs/constraints.md`，个人的自定义约束，只对本人个人目录下的 feature / bugfix / change 生效。

- 由 `init.sh` 从本 skill 的 `personal-constraints.md` 复制，已有时不覆盖；初始内容是示例，按个人习惯修改；
- 编号用 P1、P2…，与通用约束的 C 编号区分；
- 与通用约束冲突时以通用约束为准，在 spec 的约束检查中说明。

## 目录

```
agent-workspace/<个人目录>/
├── specs/constraints.md     个人约束
├── feature/NNN-<slug>/      新功能
├── bugfix/NNN-<slug>/       bug 修复
├── change/NNN-<slug>/       变更
└── notes/                   Note（见 notes skill）
```

- 个人目录名由 `git config user.name` 生成（转小写，空格和标点换成 `-`），例如 `Tony Chen` → `tony-chen`；
- `NNN` 是该类型文件夹内三位递增编号，每种类型单独编号，从 `001` 开始；
- slug 由名称生成，规则同个人目录名，中文保留，例如 `创建feature:Login Page` → `feature/001-login-page/`，`创建bugfix:登录 超时` → `bugfix/001-登录-超时/`；
- 模板在本 skill 的 `templates/<类型>/` 下。

## 流程

0. 读约束：先读通用开发约束（custom 优先）和自己的个人约束，spec 和 plan 都不得与之冲突。
1. spec：写「约束检查」和「验收标准」两节；有未决问题时先和用户确认，再进入下一步。
   - 约束检查：逐条对照通用约束（C）和个人约束（P），填写是否符合；有不符合的，写明理由并经用户确认后才能进入下一步；
   - 验收标准：只写"做什么"、怎样算完成，不写"怎么做"，每条都要能验证；feature 按 R1、R2… 编号，change 按 C-1、C-2… 编号，bugfix 写按复现操作得到期望结果、相关场景不回归；
   - bugfix 先确认能复现，再进入 plan。
2. plan：写「方案概述」和「改动范围」（模块、接口、数据格式）两节；方案不得与约束冲突，涉及新的约束项时回到 spec 补充约束检查。
   - bugfix 在方案概述中写根因，说明修复为什么解决根因而不只是掩盖现象；
   - change 涉及兼容时在方案概述中写迁移和回滚方式。
3. tasks：把 plan 拆成按顺序执行、可独立验证的任务，每项注明对应的需求和验证方式；bugfix 的第一项是写出能复现问题的测试。
4. 实现：按 tasks 逐项实现，完成一项勾选一项；需求或方案有变化时，先更新 spec（含约束检查）/ plan，再改代码。
