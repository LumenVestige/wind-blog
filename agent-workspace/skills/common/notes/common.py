"""notes 脚本共用：git 调用、项目根目录定位、配置读取与未记录提交扫描。

脚本在工作区副本 <项目根目录>/agent-workspace/skills/common/notes/ 中运行（init.sh 从 AgentDevWorkSpace 的 skills/ 复制），
按自身位置找到项目根目录，按 agent-workspace/.agent/env/agentskill-path 找到 AgentDevWorkSpace。
"""
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]  # 项目根目录（本文件位于 agent-workspace/skills/common/notes/）
ENV = ROOT / "agent-workspace" / ".agent" / "env"

try:
    import json5
except ImportError:
    sys.exit(f"缺少依赖 json5：请重新执行 AgentDevWorkSpace 的 setup.sh，并用 {ENV / 'venv' / 'bin' / 'python'} 运行")

# hook 环境会导出 GIT_DIR，影响 git -C 的结果。
for var in ("GIT_DIR", "GIT_WORK_TREE"):
    os.environ.pop(var, None)


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def project_root():
    """按本文件的位置取项目根目录；不在工作区副本中运行（例如直接运行 AgentDevWorkSpace 模板包中的脚本）时报错退出。"""
    if [x.name for x in HERE.parents[:3]] != ["common", "skills", "agent-workspace"]:
        sys.exit(f"{HERE} 不是工作区中的 notes skill：请运行 <项目根目录>/agent-workspace/skills/common/notes/ 下的脚本")
    return ROOT


def skill_dir():
    """AgentDevWorkSpace 仓库目录，由 init.sh 写入；文件缺失或目录不存在时返回 None。"""
    try:
        d = Path((ENV / "agentskill-path").read_text(encoding="utf-8").strip())
    except OSError:
        return None
    return d if (d / "scripts" / "setup.sh").is_file() else None


def user_dir_name(root):
    """与 init.sh 一致：git user.name 的 ASCII 字母转小写，空白、标点和控制字符换成 -，合并连续的 -，去掉首尾的 -；非 ASCII 字符原样保留。"""
    name = re.sub(r"[A-Z]", lambda m: m.group().lower(), git("-C", str(root), "config", "user.name"))
    return re.sub(r"[\x00-\x20\x7f!-/:-@\[-`{-~]+", "-", name).strip("-")


def notes_dir(root):
    """当前用户的 Note 目录：agent-workspace/<个人目录>/notes。"""
    name = user_dir_name(root)
    if not name:
        sys.exit("未配置 git user.name（或其中没有可用字符），找不到个人目录：请先执行 git config --global user.name <名字>")
    return root / "agent-workspace" / name / "notes"


def all_notes(root):
    """所有人的 Note，用于判断提交是否已记录：别人的提交记在别人的个人目录中。"""
    return (root / "agent-workspace").glob("*/notes/*.md")


def base_file(root):
    return ENV / "note-base"


def update_stamp_file(root):
    return ENV / "last-update"


def load_config(root):
    """读取 agent-workspace/config/notes.json5，缺少的键用本 skill 的默认配置 config.json5 补齐。"""
    cfg = json5.loads((HERE / "config.json5").read_text(encoding="utf-8"))
    p = root / "agent-workspace" / "config" / "notes.json5"
    if p.exists():
        try:
            user = json5.loads(p.read_text(encoding="utf-8") or "{}")
        except ValueError as e:
            sys.exit(f"配置文件格式错误：{p}：{e}")
        scan = {**cfg["scan"], **user.get("scan", {})}
        cfg.update(user)
        cfg["scan"] = scan
    return cfg


def recorded_hashes(root):
    text = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in all_notes(root))
    return set(re.findall(r"\b[0-9a-f]{7,40}\b", text))


def unrecorded_commits(root, cfg):
    """按扫描配置返回基线之后、hash 未出现在任何 Note 中的提交，元素为 (完整 hash, git log --oneline 行)，从新到旧。

    返回 None 表示基线不可用（首次执行或基线已失效），调用方应把基线重置为 HEAD。
    """
    scan = cfg["scan"]
    if not scan.get("commits", True):
        return []
    state = base_file(root)
    if not state.exists():
        return None
    if not git("-C", str(root), "rev-parse", "-q", "--verify", "HEAD"):
        return []
    # 基线为空表示 setup 时仓库还没有提交，从第一笔提交算起。
    base = state.read_text().strip()
    if base and not git("-C", str(root), "rev-parse", "-q", "--verify", f"{base}^{{commit}}"):
        return None
    args = ["-C", str(root), "log", "--format=%H%x09%h %s", f"{base}..HEAD" if base else "HEAD"]
    if not scan.get("include_merges", False):
        args.append("--no-merges")
    # Note 随项目提交：只改动各人 notes/ 的提交不计入，否则提交 Note 本身又会触发新的 Note。
    excludes = [*scan.get("exclude_paths", []), "agent-workspace/*/notes/*"]
    args += ["--", *scan.get("paths", []), *(f":(exclude){p}" for p in excludes)]
    recorded = recorded_hashes(root)
    result = []
    for line in filter(None, git(*args).splitlines()):
        full, oneline = line.split("\t", 1)
        if not any(full.startswith(h) for h in recorded):
            result.append((full, oneline))
    return result


def reset_base(root):
    state = base_file(root)
    state.parent.mkdir(parents=True, exist_ok=True)
    state.write_text(git("-C", str(root), "rev-parse", "-q", "--verify", "HEAD") + "\n")
