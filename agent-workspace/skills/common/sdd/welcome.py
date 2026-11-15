#!/usr/bin/env python3
"""会话开始时（Claude Code / Codex 的 SessionStart hook，新对话或 /clear）展示 SDD 欢迎语。

输出 JSON：systemMessage 显示给用户（内容为同目录 welcome.md）；additionalContext 交给 Agent，说明快捷命令的处理方式。
读不到 welcome.md 时不输出，不影响会话。
"""
import json
import sys
from pathlib import Path

try:
    text = (Path(__file__).resolve().parent / "welcome.md").read_text(encoding="utf-8").strip()
except OSError:
    sys.exit(0)

context = ("SDD 快捷命令：用户输入「创建feature:<名称>」「创建bugfix:<名称>」「创建change:<名称>」"
           "（或 new_feature / new_bugfix / new_change <名称>）时，按 sdd skill 执行对应的创建脚本，再进入 SDD 流程。")
print(json.dumps({
    "systemMessage": text,
    "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": context},
}, ensure_ascii=False))
