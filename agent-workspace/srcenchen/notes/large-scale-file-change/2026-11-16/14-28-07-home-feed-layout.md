# 新增首页单列与双列布局设置

时间：2026-11-16 14:28:07

## Outcome

- 后台「站点设置 → 外观」增加首页布局，支持双列和单列，默认双列；窄屏均为单列。
- 配置使用现有 site_settings 表的 home_layout 键，沿用鉴权、事务及模块版本检查；非法值拒绝写入，旧客户端缺省字段时保留原选择。
- 首次 SSR、后续 JSON 首页导航和筛选翻页均返回布局；博客 shell 供加载占位继承列数，文章列表显式使用页面数据。
- 补充相关设置与首页数据测试、README 和 SDD 文档。保留本次会话初始化及进度条修复，移除开发服务自动改写的 yarn.lock。

## Verification

- `npm test -- tests/manage.test.ts tests/blog-page-api.test.ts tests/blog-first-paint.test.ts tests/blog-json-prefetch.test.ts`：4 个测试文件、28 项通过。
- `npm run typecheck`：通过。
- 用户要求「不测试了，commit push」，已停止后续测试并关闭临时开发服务；真实浏览器验证与生产构建未执行。

## 文件改动

```
     4  AGENTS.md
     1  README.md
     6  agent-workspace/skills/common/knowledge/SKILL.md
     2  agent-workspace/skills/common/knowledge/search.sh
     4  agent-workspace/skills/common/sdd/SKILL.md
     3  agent-workspace/skills/common/sdd/welcome.py
    17  agent-workspace/srcenchen/feature/001-home-feed-layout/plan.md
    25  agent-workspace/srcenchen/feature/001-home-feed-layout/spec.md
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
