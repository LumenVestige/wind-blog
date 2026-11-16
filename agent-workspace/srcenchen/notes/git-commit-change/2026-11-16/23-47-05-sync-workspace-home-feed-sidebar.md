# 同步 AgentDevWorkSpace 并收紧单列首页布局

时间：2026-11-16 23:47:05

## Outcome

- AgentDevWorkSpace 初始化到 0.3.10：`AGENTS.md` 改为引用 `agent-workspace/AGENTS.md`，通用 skills、Note 与欢迎语脚本同步更新。
- 单列首页卡片收紧：最小高度 13.5rem → 11.5rem，内边距与正文间距缩小，摘要行高 1.8 → 1.7，统计行不再被推到卡片底部。
- 首页右侧栏在 1024px 以上滚动时吸顶，导航栏下方保留 1rem 间距；视口不足时侧栏内部滚动，文章页目录侧栏不受影响。

## Verification

- `npm run typecheck` 通过。
- `npm test`：28 个测试文件、232 项全部通过。
- 本地 `npm run dev` 首页返回 200，页面由用户人工确认。

## Git 提交

```
6129312 [update] 收紧单列首页卡片间距；首页侧栏滚动吸顶
bc45bf8 [update] 同步 AgentDevWorkSpace 0.3.10 通用规则与 skill
```
