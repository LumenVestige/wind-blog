---
name: notes
description: 写 Note（改动记录）。完成改变行为、架构、接口或数据格式的改动后使用；Stop hook 提示"有 N 笔提交尚未记录到 Note"时也用它。说明 Note 的路径、内容、创建命令、校验与配置。
---

# Note

改变行为、架构、接口或数据格式的改动，写一条 Note。

## 路径

`agent-workspace/<个人目录>/notes/yy-MM-dd-HH-mm-ss-<topic>.md`，平铺在 `notes/` 下，随项目提交。

- 个人目录名由 `git config user.name` 生成（转小写，空格和标点换成 `-`），例如 `Tony Chen` → `tony-chen`；
- 时间取创建时刻（精确到秒），topic 用小写字母、数字加 `-`；
- 例如 `agent-workspace/tony/notes/26-08-25-14-30-05-local-cli-status-restart.md`。

## 创建

在项目根目录执行：

```sh
agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/create.py <topic>
```

脚本输出新建文件的路径，并自动填入标题下的 `时间：` 和 `## Git 提交`（尚未记录到任何 Note 的提交；没有时删除该节）。

## 内容

打开新建的文件，填写：

- 标题：一句话说明这次改动；
- `## Outcome`：改了什么、现在的行为；
- `## Verification`：跑了哪些检查、哪些没覆盖；没有时删除本节。

每条 Note 独立：后续改动写新 Note，不合并到已有 Note，同一 topic 可重复使用。

## 校验

每轮对话结束前运行（Claude Code 和 Codex 已通过 Stop hook 自动执行）：

```sh
agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/verify.py
```

- 基线之后有提交的 hash 没出现在任何人的 Note 中时，提示需要写 Note，按上面的方式创建；只改动各人 `notes/` 的提交不计入；
- 当前用户的 Note 超过上限时，按文件名中的时间删除最早的，不删除别人的 Note；
- 运行前先检查自动更新：到期则拉取 AgentDevWorkSpace（`git pull --ff-only`，工作区有改动时跳过）、重新执行 `setup.sh`，再重新调用 `verify.py` 继续流程。

## 配置

`agent-workspace/config/notes.json5`（JSON5，每个字段都有注释；缺少的字段取本 skill 中 `config.json5` 的默认值）：

- `enabled`：是否开启 Note 校验；
- `max_notes`：每人保留上限，默认 100；
- `auto_update`：是否开启自动更新，默认开启；与 `enabled` 相互独立；
- `auto_update_interval_hours`：自动更新的检查时长（小时），默认 24，上次更新时间记在 `agent-workspace/.agent/env/last-update`；
- `scan`：触发条件。`commits` 为 true 时存在未记录的提交即触发；`include_merges` 是否计入 merge 提交；`paths` / `exclude_paths` 只统计 / 不统计改动这些路径的提交（git pathspec）。
