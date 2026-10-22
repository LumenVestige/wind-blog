# AGENTS.md — wind-blog

独立**单租户**博客平台（从 CWXU-Algo-Prj 博客系统抽离并强化）。Next.js + SQLite，兼容 GoAlgo Blog Obsidian 插件。

- 首次访问进入 `/setup` 初始化唯一站长；之后禁止注册（`POST /api/setup`、`/user/auth/register` 在已初始化时返回 403）
- 主题：仅维护 Mizuki（`src/components/blog/mizuki-shell.tsx`、`src/styles/blog-mizuki.css`）；旧 Chirpy / Simple 配置统一解析为 Mizuki。`blog-chirpy.css` 暂保留共用的正文和移动目录样式。

## 结构

```
src/app/            页面（根路径博客、/manage/*；旧 /blog、/dashboard、/blog-plaza 兼容转发）+ /api
src/db/             schema.sql（唯一真源）、index.ts（连接/事务）、migrate.ts、seed.ts
src/lib/            password / jwt / markdown / slug / upyun / settings / api（信封）
src/server/users.ts 用户
src/server/blog/    articles categories tags comments site pages static-sites reports admin
src/server/api/     auth / blog / admin 处理函数 + router.ts（路径分发）
src/components/     ui（shadcn 风格）、blog、dashboard
scripts/migrate.ts  旧站→新站迁移
tests/              vitest
```

## 约定

- **数据库**：`node:sqlite`（Node ≥22.5，本项目 Node 26）。schema 改动写进 `src/db/schema.sql`（幂等 `IF NOT EXISTS`），不要另建迁移文件。
- **API**：所有 HTTP API 由 `src/app/api/[...path]/route.ts` → `src/server/api/router.ts` 统一分发，key 为 `"METHOD 路径"`。新增接口在此注册。
- **响应信封**：统一 `{ code, message, data }`；`code=0` 成功。插件兼容接口必须保持既有字段（见 README）。
- **时间戳**：库内为 SQLite ISO 字符串，对外 API 一律 Unix 秒（`isoToUnix`）。
- **布尔**：库内 0/1，用 `toBool` / `fromBool`。
- **鉴权**：`Authorization: Bearer <jwt>` 或 cookie `wind_token`。服务端组件用 `getViewer()`。
- **图片 URL**：库内多为 path-only key，读取时用 `expandUrl()` 按当前又拍云域名展开。
- **搜索**：默认模糊（`LIKE '%kw%'`），与分页 total 一致。
- **登 录密码**：客户端 SHA-256 → 服务端 `bcrypt(lower(sha256))`；文章密码为 `bcrypt(明文)`。

## 命令

```bash
npm run dev / build / start
npm run typecheck
npm test
npm run db:seed
npm run migrate -- --old-url ... --new-url ...
```

## 注意

- 不提交密钥；又拍云凭据只存库内 `site_settings`，由后台设置页维护。
- 改插件兼容接口后必须跑 `npm test`（含 `tests/plugin-contract.test.ts`）。
- `.env.local` 与 `data/*.db` 不入库。

- 访客不是用户：留言存在 `blog_guest_comments`，审核后公开；负数评论 ID 区分旧登录用户评论。
- 文章摘要模式和草稿标记存在 `blog_article_options`，新增 schema 仍只写 `schema.sql`。
- 多实例共用代码时必须分别设置 `DB_PATH`、`JWT_SECRET`、`INSTANCE_ID`；仅信任自行覆盖转发头的反向代理。

- 管理端使用 shadcn/ui + 语义 token，导航唯一注册表为 `src/lib/admin-nav.ts`，二级入口按任务分组。
- 内容模块默认进入列表，通过明确的新建按钮进入表单；静态页面 `/manage/pages` 与静态站点 `/manage/static-sites` 分开管理。
- 设置按模块独立保存，`/api/manage/settings` 使用版本号防止旧表单覆盖新配置；修改时保留原插件兼容接口。
