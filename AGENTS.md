# AGENTS.md — wind-blog

独立**单租户**博客平台（从 CWXU-Algo-Prj 博客系统抽离并强化）。Next.js + SQLite，兼容 GoAlgo Blog Obsidian 插件。

- 首次访问进入 `/setup` 初始化唯一站长；之后禁止注册（`POST /api/setup`、`/user/auth/register` 在已初始化时返回 403）
- 主题：仅维护 Mizuki（`src/components/blog/mizuki-shell.tsx`、`src/styles/blog-mizuki.css`）；旧 Chirpy / Simple 配置统一解析为 Mizuki。`blog-chirpy.css` 暂保留共用的正文和移动目录样式。
- 博客仅首次打开/刷新时 SSR；进入站内后使用 History API + JSON API 在客户端渲染。导航、预取和刷新不可调用 Next Router 的 push/prefetch/refresh 触发 RSC；文章 hover/focus 预取须接到 JSON 接口，点击复用请求。

## 结构

```
src/app/            页面（根路径博客、/manage/*；旧 /blog、/dashboard、/blog-plaza 兼容转发）+ /api
src/db/             schema.sql（唯一真源）、index.ts（连接/事务）、migrate.ts、seed.ts
src/lib/            password / jwt / markdown / slug / upyun / settings / api（信封）
src/server/users.ts 用户
src/server/blog/    articles categories tags site pages static-sites reports admin
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

- 评论功能已下线：相关接口、后台与前台入口均已移除。`blog_comments` / `blog_guest_comments` / `blog_comment_likes` 等表与 `blog_articles.comment_count` 仍留在 `schema.sql`，仅为保留历史数据，代码不再读写。
- 文章摘要模式和草稿标记存在 `blog_article_options`，新增 schema 仍只写 `schema.sql`。
- 多实例共用代码时必须分别设置 `DB_PATH`、`JWT_SECRET`、`INSTANCE_ID`；仅信任自行覆盖转发头的反向代理。

- 管理端使用 shadcn/ui + 语义 token，导航唯一注册表为 `src/lib/admin-nav.ts`，二级入口按任务分组。
- 内容模块默认进入列表，通过明确的新建按钮进入表单；静态页面 `/manage/pages` 与静态站点 `/manage/static-sites` 分开管理。
- 设置按模块独立保存，`/api/manage/settings` 使用版本号防止旧表单覆盖新配置；修改时保留原插件兼容接口。

<!-- agentskill:begin 以下内容由 AgentDevWorkSpace 的 init.sh 追加，重新执行时会被替换，请勿修改 -->

# AGENTS.md

## 工作方式

- 只做需求所需的最小改动，保留与任务无关的改动。
- 只跑覆盖本次改动的检查，汇报实际跑过的命令。
- 未经用户要求，不 commit、不 push、不做破坏性操作。

## agent-workspace/ 目录

项目根目录下的 `agent-workspace/` 是 Agent 工作区，由 `scripts/init.sh` 创建，AgentDevWorkSpace 的文件都放在这里：

- `skills/`：Agent 加载的 skill，随项目提交；
  - `common/`：从 AgentDevWorkSpace 的 `skills/`（通用 skill 模板包）复制，每次执行 setup 都整体覆盖，不要在这里修改；
  - `custom/`：项目自己的 skill，setup 从不改动；与 `common/` 同名时优先加载 `custom/` 中的，定制通用 skill 时先把它从 `common/` 复制过来再改；
- `<个人目录>/`：每人一个，目录名由 `git config user.name` 生成（转小写，空格和标点换成 `-`，例如 `Tony Chen` → `tony-chen`），除 `specs/` 外随项目提交；
  - `specs/`：个人的自定义约束 `constraints.md`，补充通用开发约束（见 `sdd` skill）；setup 时写入 `.gitignore`，不提交；
  - `feature/`、`bugfix/`、`change/`：每个新功能、bug 修复、变更一个目录 `NNN-<slug>/`，内含 `spec.md`、`plan.md`、`tasks.md`（见 `sdd` skill）；
  - `notes/`：Note 记录（见 `notes` skill）；只改动各人 `notes/` 的提交不会触发新的 Note；
- `config/`：配置，`notes.json5` 见 `notes` skill；不提交；
- `.agent/`：本机使用，不提交；
  - `env/`：`venv/` 是 `setup.sh` 创建的 Python 环境，依赖由 `deps.sh` 安装，skill 中的 Python 脚本都用它运行；另有 Note 校验的状态文件和 AgentDevWorkSpace 的路径；
  - `profiles/`、`evals/`：预留。

## Skills

SDD 流程、Note、Git 提交规则和开发知识库检索封装成 skill，在 `agent-workspace/skills/common/` 下；`init.sh` 把每个 skill 链接到 `.claude/skills/`（Claude Code 按需加载，同名时指向 `custom/`）。用到时读取对应的 `SKILL.md`（`custom/` 中有同名 skill 时读 `custom/` 中的）：

- `sdd`（`agent-workspace/skills/common/sdd/SKILL.md`）：用户输入「创建feature:<名称>」「创建bugfix:<名称>」「创建change:<名称>」（或 new_feature / new_bugfix / new_change <名称>）时，按它创建对应的目录；新功能和跨模块的改动，必须先读通用开发约束和个人约束，再按它写 spec / plan / tasks，spec 中逐条做约束检查后才能实现。
- `notes`（`agent-workspace/skills/common/notes/SKILL.md`）：改变行为、架构、接口或数据格式的改动，必须写一条 Note；Stop hook 提示有提交尚未记录到 Note 时，按它创建。
- `knowledge`（`agent-workspace/skills/common/knowledge/SKILL.md`）：搜索或回顾历史开发痕迹（以前做过什么、某个需求或 bug 的方案、为什么这样设计、某笔提交的来龙去脉）时，按它检索，用检索到的文档作为依据回答。
- `git-commit`（`agent-workspace/skills/common/git-commit/SKILL.md`）：每笔提交信息必须以 `[fix]` / `[feature]` / `[del]` / `[update]` 标签开头；提交前按它编写提交信息。

<!-- agentskill:end -->
