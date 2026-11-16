#!/usr/bin/env python3
"""会话开始时（Claude Code / Codex 的 SessionStart hook，新对话或 /clear）展示 SDD 欢迎语。

输出 JSON：systemMessage 供客户端展示，首行是 AgentDevWorkSpace 的本地和远端版本号；additionalContext 交给 Agent，说明快捷命令的处理方式。
版本行由 notes skill 的 `update.py --welcome` 生成：当场请求远端版本，本地落后时立即在后台更新（不等待）；
update.py 不可用时只显示本地版本（agentskill-path 指向的 AgentDevWorkSpace 中的 publish/version）。
Codex CLI 输入前的欢迎语由 scripts/codex.sh 启动入口打印，不要求 Agent 在首次回复复述。
读不到 welcome.md 时不输出，不影响会话。
"""
import json
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent  # agent-workspace/skills/<common|custom>/sdd/
shared = HERE.parent if (HERE.parent / "_version.py").is_file() else HERE.parent.parent / "common"
sys.path.insert(0, str(shared))
from _version import parse_version, format_version

try:
    from render_welcome import render_welcome
except ImportError:
    render_welcome = None


try:
    text = (HERE / "welcome.md").read_text(encoding="utf-8").strip()
except OSError:
    sys.exit(0)


WS = HERE.parents[2]  # agent-workspace/


def interpreter():
    try:
        path = (WS / ".agent/env/python-path").read_text(encoding="utf-8").strip()
        if path:
            return path
    except OSError:
        pass
    return str(WS / ".agent/env/venv/bin/python")


def version_line():
    updater = WS / "skills" / "custom" / "notes" / "update.py"
    if not updater.is_file():
        updater = WS / "skills" / "common" / "notes" / "update.py"
    try:
        r = subprocess.run([interpreter(), str(updater), "--welcome"],
                           stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10)
        line = r.stdout.strip()
        if r.returncode == 0 and line:
            return line
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        skill = Path((WS / ".agent" / "env" / "agentskill-path").read_text(encoding="utf-8").strip())
        v = (skill / "publish" / "version").read_text(encoding="utf-8").strip()
    except OSError:
        return ""
    try:
        return f"AgentDevWorkSpace 版本：本地 {format_version(parse_version(v, allow_legacy=True))}"
    except ValueError:
        return ""



line = version_line()
if render_welcome is not None:
    text = render_welcome(text, line)
elif line:
    text = f"{line}\n\n{text}"

context = ("SDD 快捷命令：用户输入「创建feature:<名称>」「创建bugfix:<名称>」「创建change:<名称>」「创建research:<名称>」"
           "（或 new_feature / new_bugfix / new_change / new_research <名称>）时，按 sdd skill 执行对应的创建脚本，再进入 SDD 流程。")
print(json.dumps({
    "systemMessage": text,
    "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": context},
}, ensure_ascii=False))
