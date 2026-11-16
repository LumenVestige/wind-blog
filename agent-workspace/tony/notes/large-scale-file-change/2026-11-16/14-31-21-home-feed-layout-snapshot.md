# 记录首页布局设置及阅读进度条层级的未提交改动

时间：2026-11-16 14:31:21

## Outcome

- 根据 Stop hook 提示，记录当前工作区 20 个文件、176 行未提交改动；本轮仅补充 Note，不修改现有业务代码或暂存状态。
- 后台外观设置新增首页单列、双列选择，默认双列，窄屏显示单列；配置保存到 site_settings.home_layout，非法值拒绝写入，旧客户端省略字段时保留当前值，并沿用模块版本检查。
- SSR 与首页 JSON 数据返回相同布局，博客 shell、加载占位和文章列表使用对应列数；同步补充 README、SDD 文档及设置和首页数据测试。
- 阅读进度条 z-index 调整为 60，显示在导航栏上方、路由进度条下方。

## Verification

- 本轮核对 git status、暂存区差异与已有需求完成说明，并执行 create.py --type large-scale-file-change home-feed-layout-snapshot 生成文件清单和改动快照。
- 既有 summary.md 记录定向测试 4 个文件、28 项通过，npm run typecheck 通过；这些是历史记录，本轮未重新运行业务测试或类型检查。
- 既有完成说明指出真实浏览器验证和生产构建未执行。

## 文件改动

```
     1  README.md
    17  agent-workspace/srcenchen/feature/001-home-feed-layout/plan.md
    27  agent-workspace/srcenchen/feature/001-home-feed-layout/spec.md
     9  agent-workspace/srcenchen/feature/001-home-feed-layout/summary.md
     7  agent-workspace/srcenchen/feature/001-home-feed-layout/tasks.md
     3  src/app/(site)/layout.tsx
     2  src/components/blog/blog-page-view.tsx
     2  src/components/blog/mizuki-shell.tsx
     3  src/components/blog/shell-types.ts
    17  src/components/dashboard/blog-settings.tsx
     3  src/lib/admin-settings.ts
    10  src/lib/blog-layout.ts
     3  src/lib/blog-page.ts
     4  src/server/blog/page-data.ts
     5  src/server/blog/site.ts
     7  src/server/manage-settings.ts
     7  src/styles/blog-mizuki.css
     3  src/styles/motion.css
    19  tests/blog-page-api.test.ts
    27  tests/manage.test.ts
```
