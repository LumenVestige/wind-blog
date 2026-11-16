#!/usr/bin/env python3
"""检查需求目录（agent-workspace/<个人目录>/<feature|bugfix|change|research>/NNN-<slug>/）中的文件是否已归类。

规则（见本目录 SKILL.md「需求目录内的文件」）：
- 根目录只放 spec.md、plan.md、tasks.md、summary.md；
- 其他文件（调研、诊断、证据、截图、脚本、数据等）放进一级子目录 NN-<主题>/（两位编号 + 主题，例如 01-baseline/）；
  子目录内部可以再分层，不再检查。

用法（在项目根目录执行）：agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/sdd/check_layout.py [--all]
- 作为 Claude Code / Codex 的 Stop hook：只检查当前用户个人目录中新增（未提交）的文件，已提交的旧文件不追溯；
  有未归类的文件时以退出码 2 把清单交回 Agent；Agent 已因 Stop hook 继续过一次（stop_hook_active）时只提示不再阻止，避免循环。
- 手动执行加 --all：检查当前用户全部需求目录（含已提交的文件），有问题时退出码 1。
非 git 工程、未配置 git user.name 或没有需求目录时什么都不做。
"""
import json
import re
import select
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # 不在工作区副本中生成 __pycache__

BLOCK = 2  # Stop hook：退出码 2 阻止结束，stderr 交给 Agent
ROOT_FILES = {"spec.md", "plan.md", "tasks.md", "summary.md"}
SUBDIR = re.compile(r"^\d{2}-[^/]+$")
TYPES = ("feature", "bugfix", "change", "research")
REQ_DIR = re.compile(r"^\d{3}-")
JUNK = {".DS_Store", "Thumbs.db", "__pycache__", ".gitkeep"}


def hook_input():
    """Stop hook 会立即写入事件 JSON；手动执行时 stdin 可能是终端或一直不关闭的管道，等不到数据就跳过。"""
    try:
        if sys.stdin is None or sys.stdin.isatty() or not select.select([sys.stdin], [], [], 1)[0]:
            return {}
        return json.loads(sys.stdin.read() or "{}")
    except (OSError, ValueError):
        return {}


def git(root, *args):
    r = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def user_dir_name(root):
    """与 init.sh、new.sh 一致：git user.name 的 ASCII 字母转小写，空白、标点和控制字符换成 -，合并连续的 -，去掉首尾的 -。"""
    name = re.sub(r"[A-Z]", lambda m: m.group().lower(), (git(root, "config", "user.name") or "").strip())
    return re.sub(r"[\x00-\x20\x7f!-/:-@\[-`{-~]+", "-", name).strip("-")


def new_files(root, base):
    """base 下新增（未跟踪、已暂存新增、重命名 / 复制目标）的文件，路径相对项目根目录；不含被忽略的文件。"""
    out = git(root, "status", "--porcelain", "-z", "--untracked-files=all", "--", base)
    if out is None:
        return []
    items, entries, i = [], out.split("\0"), 0
    while i < len(entries):
        e = entries[i]
        i += 1
        if len(e) < 4:
            continue
        code, path = e[:2], e[3:]
        if code[0] in "RC":
            i += 1  # -z 下重命名 / 复制的原路径紧随其后
        if code == "??" or code[0] in "ARC":
            items.append(path)
    return items


def all_files(root, base):
    return [str(p.relative_to(root)) for p in (root / base).rglob("*") if p.is_file()]


def problems(paths, base):
    """按需求目录归并不合规的文件：{需求目录: [(相对需求目录的路径, 原因)]}。"""
    found = {}
    for path in sorted(paths):
        parts = Path(path).parts
        # agent-workspace/<个人目录>/<类型>/<NNN-slug>/...
        if len(parts) < 5 or parts[2] not in TYPES or not REQ_DIR.match(parts[3]):
            continue
        if any(p in JUNK for p in parts[4:]):
            continue
        req, rest = "/".join(parts[:4]), parts[4:]
        if len(rest) == 1:
            if rest[0] in ROOT_FILES:
                continue
            reason = "根目录只放 spec.md、plan.md、tasks.md、summary.md"
        elif not SUBDIR.match(rest[0]):
            reason = f"子目录 {rest[0]}/ 未按 NN-<主题> 命名"
        else:
            continue
        found.setdefault(req, []).append(("/".join(rest), reason))
    return found


def report(found):
    lines = ["需求目录中有未归类的文件（规则见 sdd skill「需求目录内的文件」）："]
    for req, items in found.items():
        lines.append(f"- {req}/")
        lines += [f"    {p}：{why}" for p, why in items]
    lines.append("请移到对应的 NN-<主题>/ 子目录（例如 01-baseline/、02-<批次或主题>/），同步更新文档中的链接和脚本中的相对路径；"
                 "跨主题的总结写进根目录 summary.md。")
    return "\n".join(lines)


def main():
    manual = "--all" in sys.argv[1:]
    event = {} if manual else hook_input()
    here = Path(__file__).resolve()
    # 本文件位于 <项目根目录>/agent-workspace/skills/<common|custom>/sdd/。
    if [x.name for x in here.parents[2:4]] != ["skills", "agent-workspace"]:
        sys.exit(f"{here} 不是工作区中的 sdd skill：请运行 <项目根目录>/agent-workspace/skills/common/sdd/check_layout.py")
    root = here.parents[4]
    if git(root, "rev-parse", "--is-inside-work-tree") is None:
        return 0
    user = user_dir_name(root)
    base = f"agent-workspace/{user}"
    if not user or not (root / base).is_dir():
        return 0
    found = problems(all_files(root, base) if manual else new_files(root, base), base)
    if not found:
        if manual:
            print("需求目录已全部归类")
        return 0
    print(report(found), file=sys.stderr)
    if manual:
        return 1
    return 0 if event.get("stop_hook_active") else BLOCK


if __name__ == "__main__":
    sys.exit(main())
