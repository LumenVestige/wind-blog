---
name: notes
description: 写 Note（改动记录）。完成改变行为、架构、接口或数据格式的改动后使用；Stop hook 提示"有 N 笔提交尚未记录到 Note"时也用它。说明 Note 的路径、内容、创建命令、校验与配置。
---

# Note

改变行为、架构、接口或数据格式的改动，写一条 Note。

## 路径

`agent-workspace/<个人目录>/notes/<类型>/<YYYY-MM-DD>/HH-mm-ss-<topic>.md`，按类型分目录、按天归档，随项目提交。

- 类型：`git-commit-change`（有未记录到 Note 的提交时写）、`large-scale-file-change`（工作区有大规模未提交的改动时写）；
- 个人目录名由 `git config user.name` 生成（转小写，空格和标点换成 `-`），例如 `Tony Chen` → `tony-chen`；
- 日期目录和文件名中的时间取创建时刻，文件名不再包含年月日；topic 用小写字母、数字加 `-`；
- 例如 `agent-workspace/tony/notes/git-commit-change/2026-08-25/14-30-05-local-cli-status-restart.md`；
- 旧版本平铺在 `notes/` 下的 `yy-MM-dd-HH-mm-ss-<topic>.md` 由 setup 时执行的 `scripts/fix.sh` 移到 `git-commit-change/<YYYY-MM-DD>/`。

## 创建

在项目根目录执行：

```sh
# 有未记录的提交（默认类型 git-commit-change）
agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/create.py <topic>
# 工作区有大规模未提交的改动
agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/create.py --type large-scale-file-change <topic>
```

脚本输出新建文件的路径，并自动填入标题下的 `时间：`，以及：

- `git-commit-change`：`## Git 提交`（尚未记录到任何 Note 的提交；没有时删除该节）；
- `large-scale-file-change`：`## 文件改动`（未提交的改动，每个文件的增删行数），并把这批改动记为已记录，之后只按新增的改动量判断。

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

- 基线之后有提交的 hash 没出现在任何人的 Note 中时，提示写 `git-commit-change` Note；只改动各人 `notes/` 的提交不计入；
- 未提交的改动（含未跟踪文件，不含各人 `notes/`）相对上次记录新增的文件数或行数达到 `scan.large_change` 的阈值时，提示写 `large-scale-file-change` Note；改动被提交或撤销后从记录中扣除，不会误触发；首次运行只建立记录；
- 当前用户某个类型某个日期目录的 Note 超过 `max_notes` 时，把最早的几条按时间顺序合并为一个 `<最早一条的 HH-mm-ss>-merged.md`，使数量回到上限：每条保留全部内容和来源文件名（`<!-- source: … -->`，标题降一级），合并文件可再次参与合并；不删除内容，不处理别人的 Note；
- 运行前先检查自动更新：到期则拉取 AgentDevWorkSpace（`git pull --ff-only`，工作区有改动时跳过）、重新执行 `setup.sh`，再重新调用 `verify.py` 继续流程。

## 配置

`agent-workspace/config/notes.json5`（JSON5，每个字段都有注释；缺少的字段取本 skill 中 `config.json5` 的默认值）：

- `enabled`：是否开启 Note 校验；
- `max_notes`：每个日期目录（`notes/<类型>/<YYYY-MM-DD>/`）的 Note 上限，超过时合并最早的，默认 100；
- `auto_update`：是否开启自动更新，默认开启；与 `enabled` 相互独立；
- `auto_update_interval_hours`：自动更新的检查时长（小时），默认 24，上次更新时间记在 `agent-workspace/.agent/env/last-update`；
- `scan`：触发条件。`commits` 为 true 时存在未记录的提交即触发；`include_merges` 是否计入 merge 提交；`paths` / `exclude_paths` 只统计 / 不统计改动这些路径的提交和工作区改动（git pathspec）；`large_change`（`enabled`、`files` 默认 20、`lines` 默认 1000）是大规模改动的触发阈值，改动快照记在 `agent-workspace/.agent/env/large-change-base`。
