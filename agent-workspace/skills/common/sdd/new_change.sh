#!/bin/sh
# 用法（在项目根目录执行）：sh agent-workspace/skills/common/sdd/new_change.sh <名称>
# 新建变更：agent-workspace/<个人目录>/change/NNN-<slug>/，详见 new.sh。
exec sh "$(dirname "$0")/new.sh" change "$@"
