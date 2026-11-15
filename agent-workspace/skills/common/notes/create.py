#!/usr/bin/env python3
"""在项目根目录的 agent-workspace/<个人目录>/notes/ 下创建 Note，并填入能从脚本获取的内容，在任意目录执行都可以。

用法（在项目根目录执行）：agent-workspace/.agent/env/venv/bin/python agent-workspace/skills/common/notes/create.py <topic-in-kebab-case>
文件名：agent-workspace/<个人目录>/notes/yy-MM-dd-HH-mm-ss-<topic>.md，平铺在 notes/ 下；个人目录名由 git user.name 生成，同 init.sh。

自动填充：
- `时间：` 摘要时间戳，取当前时间；
- `## Git 提交`：尚未记录到任何 Note 的提交（git log --oneline，扫描范围同 verify.py）；没有时删除该节。
每条 Note 独立：每次执行都新建文件，不修改已有 Note，同一 topic 可重复使用。
`## Outcome` / `## Verification` 由 Agent 填写。
"""
import datetime
import re
import sys

sys.dont_write_bytecode = True  # 不在工作区副本中生成 __pycache__

from common import HERE, load_config, notes_dir, project_root, unrecorded_commits

SECTION = re.compile(r"^## Git 提交[ \t]*\n(?:(?!^## ).*\n?)*", re.M)
TIME = re.compile(r"^时间：.*$", re.M)


def commit_block(lines):
    return "## Git 提交\n\n```\n" + "".join(f"{l}\n" for l in lines) + "```\n"


def fill_commits(text, lines):
    """把提交写入 `## Git 提交` 节；没有任何提交时删除该节。"""
    block = commit_block(lines) if lines else ""
    return SECTION.sub(lambda _: block, text, count=1).rstrip("\n") + "\n"


def main():
    if len(sys.argv) != 2:
        sys.exit(f"用法：{sys.argv[0]} <topic-in-kebab-case>")
    topic = sys.argv[1]
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", topic):
        sys.exit(f"topic 只能用小写字母、数字和 -：{topic}")

    root = project_root()
    notes = notes_dir(root)
    notes.mkdir(parents=True, exist_ok=True)
    now = datetime.datetime.now()
    stamp = f"时间：{now:%Y-%m-%d %H:%M:%S}"
    commits = [oneline for _, oneline in (unrecorded_commits(root, load_config(root)) or [])]

    file = notes / f"{now:%y-%m-%d-%H-%M-%S}-{topic}.md"
    if file.exists():
        sys.exit(f"Note 已存在，请稍后重试：{file}")
    text = TIME.sub(stamp, (HERE / "template.md").read_text(encoding="utf-8"), count=1)
    file.write_text(fill_commits(text, commits), encoding="utf-8")
    print(file)
    if commits:
        print(f"已填入 {len(commits)} 笔未记录的提交", file=sys.stderr)


if __name__ == "__main__":
    main()
