#!/usr/bin/env python3
"""每轮对话结束时执行：判断是否需要触发 Note，并按上限删除旧 Note。Note 的内容由 create.py 填充。

用法（在项目根目录执行）：agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/verify.py
作为 Claude Code / Codex 的 Stop hook 时从 stdin 读取事件 JSON；需要写 Note 时以退出码 2 把提示交回 Agent。

配置：agent-workspace/config/notes.json5（JSON5，字段含义见其中的注释；缺少的键取本 skill 中 config.json5 的默认值）
- enabled：false 时不触发 Note、不删除。
- max_notes：当前用户的 Note（agent-workspace/<个人目录>/notes）超过该数量时按文件名中的时间删除最早的；不删除别人的 Note。
- auto_update / auto_update_interval_hours：运行前检查距上次更新（agent-workspace/.agent/env/last-update）是否超过该时长，
  到期则拉取 AgentDevWorkSpace（git pull --ff-only，工作区有改动时跳过，失败不中断）并重新执行 setup.sh，
  成功后重新调用 verify.py 继续本次流程；与 enabled 相互独立。
- scan：触发条件。commits 为 true 时，基线之后存在未记录到任何 Note 的提交即触发；
  include_merges 是否计入 merge 提交；paths / exclude_paths 只统计 / 不统计改动这些路径的提交（git pathspec）。

全部提交都已记录时，基线（agent-workspace/.agent/env/note-base）前移到 HEAD，此后删除旧 Note 不会让这些提交重新触发。
"""
import json
import os
import select
import subprocess
import sys
import tempfile
import time

sys.dont_write_bytecode = True  # 不在工作区副本中生成 __pycache__

from common import ENV, git, skill_dir, load_config, notes_dir, project_root, reset_base, unrecorded_commits, update_stamp_file

BLOCK = 2  # Claude Code / Codex 的 Stop hook：退出码 2 阻止结束，stderr 交给 Agent 继续处理
UPDATED_ENV = "AGENTSKILL_UPDATED"  # 更新后重新调用时设置，避免时间戳写入失败或时长为 0 时无限循环
PULL_TIMEOUT = 60  # 秒，避免网络问题长时间卡住 Stop hook


def hook_input():
    """Stop hook 会立即写入事件 JSON；手动执行时 stdin 可能是终端或一直不关闭的管道，等不到数据就跳过，避免卡住。"""
    try:
        if sys.stdin is None or sys.stdin.isatty() or not select.select([sys.stdin], [], [], 1)[0]:
            return {}
        return json.loads(sys.stdin.read() or "{}")
    except (OSError, ValueError):
        return {}


def update_due(root, cfg):
    """时间戳缺失、损坏或晚于当前时间（时钟回拨）时都视为到期。"""
    try:
        last = float(update_stamp_file(root).read_text().strip())
    except (OSError, ValueError):
        return True
    return not 0 <= time.time() - last < float(cfg["auto_update_interval_hours"]) * 3600


def pull_skill(skill):
    """拉取 AgentDevWorkSpace 的新代码。工作区有改动时跳过；失败只提示，不影响后续初始化。"""
    if git("-C", skill, "status", "--porcelain", "--untracked-files=no"):
        print("AgentDevWorkSpace 工作区有改动，跳过拉取", file=sys.stderr)
        return
    # 输出写临时文件而不是管道：超时只杀 git，ssh 等子进程若还持有管道，subprocess.run 会一直等下去。
    with tempfile.TemporaryFile("w+", encoding="utf-8") as out:
        try:
            r = subprocess.run(["git", "-C", skill, "pull", "--ff-only"], stdin=subprocess.DEVNULL, stdout=out, stderr=out,
                               timeout=PULL_TIMEOUT, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
        except subprocess.TimeoutExpired:
            print(f"拉取 AgentDevWorkSpace 超时（{PULL_TIMEOUT} 秒），继续使用当前版本", file=sys.stderr)
            return
        if r.returncode:
            out.seek(0)
            print(f"拉取 AgentDevWorkSpace 失败，继续使用当前版本：\n{out.read()}", file=sys.stderr)


def auto_update(root, cfg, event):
    """到期时拉取 AgentDevWorkSpace 并重新执行 setup.sh，成功后重新调用 verify.py 并返回其退出码；未到期或更新失败时返回 None，由当前进程继续。"""
    if not cfg["auto_update"] or os.environ.get(UPDATED_ENV) or not update_due(root, cfg):
        return None
    skill = skill_dir()
    if not skill:
        print(f"找不到 AgentDevWorkSpace（{ENV / 'agentskill-path'}），跳过自动更新：请重新执行 AgentDevWorkSpace 的 setup.sh", file=sys.stderr)
        return None
    # 执行前写入时间戳：失败时等下个周期再试，不在每轮对话结束时重复执行。
    stamp = update_stamp_file(root)
    stamp.parent.mkdir(parents=True, exist_ok=True)
    stamp.write_text(f"{int(time.time())}\n")
    pull_skill(str(skill))
    # AgentDevWorkSpace 初始化自身时 setup.sh 不接受显式根目录，靠执行目录判断。
    args = [] if root.resolve() == skill.resolve() else [str(root)]
    # 捕获输出：Stop hook 退出码为 2 时 stderr 会交给 Agent，成功时的输出不应混入。
    r = subprocess.run(["sh", str(skill / "scripts" / "setup.sh"), *args],
                       cwd=root, capture_output=True, text=True)
    if r.returncode:
        print(f"自动更新失败（setup.sh 退出码 {r.returncode}），继续本次校验：\n{r.stderr}", file=sys.stderr)
        return None
    # setup.sh 已用新的模板包覆盖工作区副本，重新调用的是新版本的 verify.py。
    # stdin 已被读取，把事件原样传给新进程，stop_hook_active 才不会丢失。
    python = ENV / "venv" / "bin" / "python"
    return subprocess.run([str(python), __file__], input=json.dumps(event), text=True,
                          env={**os.environ, UPDATED_ENV: "1"}).returncode


def prune(notes, limit):
    existing = sorted(notes.glob("*.md"))
    for old in existing[: max(0, len(existing) - limit)]:
        old.unlink()
        print(f"Note 超过 {limit} 条，已删除最早的：{old.name}", file=sys.stderr)


def main():
    event = hook_input()
    root = project_root()
    cfg = load_config(root)
    code = auto_update(root, cfg, event)
    if code is not None:
        return code
    if not cfg["enabled"]:
        return 0
    notes = notes_dir(root)
    notes.mkdir(parents=True, exist_ok=True)

    pending = unrecorded_commits(root, cfg)
    if not pending:
        # 全部已记录，或基线不可用（首次执行、rebase 等）：基线前移到 HEAD。
        reset_base(root)
    prune(notes, int(cfg["max_notes"]))
    if not pending:
        return 0
    print(f"有 {len(pending)} 笔提交尚未记录到 Note，请按 notes skill（agent-workspace/skills/common/notes/SKILL.md）写 Note，在项目根目录执行：\n"
          'agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/create.py <topic>', file=sys.stderr)
    # Stop hook 已经因本脚本续跑过一轮时不再阻止，避免循环。
    return 0 if event.get("stop_hook_active") else BLOCK


if __name__ == "__main__":
    sys.exit(main())
