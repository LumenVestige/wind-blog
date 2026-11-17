# 删除 setup-agent-workspace 命令及相关脚本：任务

关联：[spec.md](spec.md)、[plan.md](plan.md)

- [x] T1：确认删除边界、现有改动与依赖环境，完成约束检查和实施方案（R1–R3；验证：引用检索、git status、文件审查）。
- [x] T2：新增可直接运行的自动化验收检查，先确认当前实现不满足删除要求（R1–R3；验证：node --test 01-validation/check-removal.mjs）。
- [x] T3：删除命令、入口、专属测试并清理 README（R1、R2；验证：验收检查、npm run、引用检索）。
- [x] T4：校验保留内容、写 Note 和 summary，完成格式与目录检查（R3；验证：git diff --check、SDD 布局校验、本地 Note 校验）。
