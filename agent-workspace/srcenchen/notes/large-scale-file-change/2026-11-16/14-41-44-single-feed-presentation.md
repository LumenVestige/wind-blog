# 单列首页放大卡片与渐变头图并减少每页文章数

时间：2026-11-16 14:41:44

## Outcome

- 单列文章卡片提高高度、内边距、标题字号和列表间距；有图时右侧使用通高大头图，并以 CSS mask 向文字侧渐隐，适配深浅色和悬停背景。
- 有图文字限制到独立区域，无图使用完整卡片宽度；手机改为上图下文，图片下边缘渐隐。
- 单列默认页大小由 12 改为 6，双列保持 12；首页 SSR / JSON 共用布局及默认页大小，分页链接省略相应默认 pageSize，兼容原合法显式页大小。
- 更新 README 与 SDD 文档；不涉及数据库迁移或插件接口。

## Verification

- 检查 `git diff` 中的单列样式作用域、移动端覆盖、分页参数与首次 SSR / JSON 共用路径。
- 沿用用户「不测试了」要求，未运行自动化测试、类型检查、浏览器验证或构建。本轮未 commit / push。

## 文件改动

```
     2  README.md
    17  agent-workspace/srcenchen/change/001-single-feed-presentation/plan.md
    24  agent-workspace/srcenchen/change/001-single-feed-presentation/spec.md
     7  agent-workspace/srcenchen/change/001-single-feed-presentation/tasks.md
     8  src/components/blog/blog-page-view.tsx
     5  src/components/blog/blog-pagination.tsx
     6  src/lib/pagination.ts
     8  src/server/blog/page-data.ts
    80  src/styles/blog-mizuki.css
```
