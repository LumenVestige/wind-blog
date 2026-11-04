# Wind Blog

一个轻量、独立的**单租户**博客平台：**Next.js (App Router) + SQLite**，兼容 **GoAlgo Blog Obsidian 插件**，支持 **又拍云** 图床（上传地址可在后台自定义），并附带 **旧站 → 新站自动迁移脚本**。

## 特性

- **单租户**：首次访问进入**系统初始化**，创建唯一站长账号；此后不再开放注册
- **登录**：客户端 SHA-256 + 服务端 bcrypt、JWT 鉴权
- **文章**：Markdown、自动或手工摘要、封面预览与移除、分类、标签、置顶、草稿、密码保护、私密、公开
- **互动**：访客昵称留言（站长审核后公开）、3 层回复、匿名点赞；后台可独立关闭评论或点赞，无需访客注册
- **博客外观**：**Mizuki** 主题（Chirpy / Simple 已停止维护，旧配置自动使用 Mizuki）、明暗模式、副标题、社交链接、自定义导航页面
- **渲染与预取**：首次打开或刷新时 SSR 输出完整内容；站内导航、筛选、分页、返回与解锁刷新均通过 `/api/blog/page` JSON 接口在客户端渲染。文章链接悬停 200ms / 获得焦点时预取，按下时立即预取，点击复用请求；预取不计阅读量，不发送 RSC 请求。
- **导航文章**：关于 / 友链可关联普通文章，默认不显示入口；关联后仅链接可见，不进入首页、归档或搜索。旧关于 / 友链正文会一次性转为这类文章，首页介绍不再展示。
- **静态站点**：上传 zip 发布到又拍云，`/static/{slug}/`（兼容 `/blog/{user}/static/{slug}/`）
- **站长后台**：文章、服务器草稿、本地草稿恢复、置顶、分类、页面编辑 / 发布 / 导航、留言审核、统计、站点外观、图床与账户设置
- **Obsidian 插件兼容**：现有插件只需把 `baseUrl` 指到本站即可
- **旧站迁移**：给定新旧站地址与账号密码，一键搬迁文章 / 分类 / 标签 / 页面 / 主题（图片不迁移）

## 快速开始

```bash
npm install
cp .env.example .env.local        # 填写 JWT_SECRET（openssl rand -hex 32）等
npm run dev                       # http://localhost:3000
```

- 首次访问 `http://localhost:3000` 会自动进入 `/setup`，创建唯一站长账号（可同时配置又拍云）
- 初始化完成后，根路径 `/` 就是博客首页；`/blog/{用户名}` 旧链接兼容转发
- 工作台 `/manage`；文章 `/manage/articles`；静态页面 `/manage/pages`；静态站点 `/manage/static-sites`；设置 `/manage/settings`；旧 `/dashboard/*` 路径兼容转发
- 无需再手动 seed（可选：`npm run db:seed` 用 `.env.local` 里的 `ADMIN_*` 直接建号（密码至少 12 字符），适用于自动化部署）

## 环境变量

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥（≥32 字符随机值；生产环境必填，示例占位值会被拒绝） |
| `DB_PATH` | SQLite 文件路径，默认 `./data/wind-blog.db` |
| `NEXT_PUBLIC_SITE_URL` | 站点公开地址 |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `db:seed` 初始站管 |
| `CWXU_OBSIDIAN_PUBLISH_TOKEN` | 插件发布令牌（用于初始化） |

## 又拍云图床

在 **站点设置 → 存储与上传** 填写 `bucket / operator / password / 访问域名(CDN) / 协议`，可选 `API Host`。
配置后：

- 唯一站长可在编辑器上传图片；允许 JPEG、PNG、GIF、WebP、ICO、SVG，最大 10MB；按实际内容识别格式并设置存储扩展名与 Content-Type，兼容 Obsidian 附件扩展名与内容不一致的情况
- 文章图片以 `/{uploadDir}/{sha256}{ext}` 内容寻址存储；读接口按当前 CDN 域名展开为完整 URL，**换域名即时生效**
- 首页列表封面使用当前 CDN 的 `!cover640` 缩略图版本；需在又拍云创建 `cover640`（限定宽度 640px、WebP、质量 75%，间隔标识符 `!`）。外链和已带处理后缀的封面保持原地址，正文及 API 仍返回原图
- 头像存储为 path-only key（`/{uploadDir}/avatar/...`），同样按当前域名展开

## 兼容 Obsidian 插件

本站实现与 GoAlgo Blog 插件完全一致的接口与响应信封：

- `POST /api/user/auth/login`（客户端 SHA-256 密码）→ `{ success, message, jwtToken }`
- `GET /api/user/blog/activation/status`、`image-upload/status`
- `GET /api/user/blog/category/mine`、`tags`
- `GET/POST /api/user/blog/article/{mine,get,create,update}`
- `POST /api/user/blog/images/check`、`POST /api/user/upload`（multipart，返回 `{url,hash}`）
- `GET /api/user/blog/obsidian-plugin/latest`、`POST .../publish`

在插件设置里把 **服务器地址** 改成你的 wind-blog 地址即可。

## 旧站迁移

```bash
npm run migrate -- \
  --old-url https://旧站 \
  --old-username alice --old-password secret \
  --new-url http://localhost:3000 \
  --new-username alice --new-password secret \
  [--new-register] \
  [--password-articles=private|skip|keep] \
  [--include-comments] \
  [--rewrite-domain https://旧CDN=https://新CDN] \
  [--dry-run]
```

迁移内容：文章（含正文）、分类、标签、页面、**主题与站点设置**。**图片与静态站点文件不迁移**（正文图片 URL 默认保留，可用 `--rewrite-domain` 改写域名）。密码文章无法还原明文，默认转为「私密」。`--password-articles=keep` 仅在目标已有密码文章时保留目标密码，否则安全转为私密并提示。

新站若尚未初始化，`--new-register` 会用给定账号完成初始化（单租户只允许一个账号）。

## 主要命令

```bash
npm run dev          # 开发
npm run build        # 生产构建
npm run start        # 生产运行
npm run typecheck    # 类型检查
npm test             # 单元 / API / 插件契约测试
npm run db:migrate   # 应用 schema
npm run db:seed      # 初始化站管
npm run migrate      # 旧站迁移

npm run setup-agent-skill   # 接入 / 更新 AgentSkill（可选，见下）
```

## AgentSkill（可选）

[AgentSkill](https://github.com/LumenVestige/AgentSkill) 是通用的 Agent 协作规范。接入或更新：

```bash
npm run setup-agent-skill
```

脚本会把 AgentSkill 克隆到 `scripts/dev/AgentSkill`（已存在则 `git pull --ff-only`，工作区有改动时跳过），再执行它的 `setup.sh` 初始化 `CLAUDE.md` 软链接、`.agents/`、Python 虚拟环境、Stop hook 和 `commit-msg` 标签校验。可重复执行。

AgentSkill 是独立仓库，克隆目录和 `.agents/` 都不纳入本仓库版本管理。需要换用其他地址时设置 `AGENT_SKILL_REPO`。

## 技术栈

Next.js 15 App Router · React 19 · TypeScript · Tailwind v4 + shadcn/ui 风格组件 · SQLite（`node:sqlite`，零原生依赖） · `jose`（JWT） · `bcryptjs` · `markdown-it` + `highlight.js` + `sanitize-html` · `fflate`（zip）

## 项目结构

```
src/
  app/                     Next.js 页面与 /api 路由
  db/                      schema.sql、连接、迁移、seed
  lib/                     密码、JWT、markdown、slug、又拍云、设置、HTTP 封装
  server/                  业务逻辑（users、blog/*、api 路由分发）
  components/              UI（ui 基础组件、blog、dashboard）
scripts/migrate.ts         旧站迁移 CLI
scripts/dev/agent-skill.mjs 接入 / 更新 AgentSkill
tests/                     单元 / API / 插件契约测试
```

## 安全与上传限制

- 浏览器使用 HttpOnly、SameSite=Lax 登录 Cookie；HTTPS 请求设置 Secure。Obsidian 仍使用 Bearer JWT。
- 修改登录密码会立即使已有 JWT 失效；此次升级前的 JWT 需重新登录。
- 密码文章在未解锁时不返回正文或摘要，评论同样要求解锁。解锁有效期两小时，修改文章密码会使旧令牌失效。
- 登录每个账户标识每 15 分钟最多 20 次，站点全局最多 1000 次；文章解锁每篇每 15 分钟最多 30 次，全站最多 1000 次。限流状态存于 SQLite。
- JSON 请求体最多 2MB；静态站点 ZIP 最多 32MB，最多 1000 个文件，单文件解压后最多 16MB，总展开大小最多 128MB。
- 静态站点替换使用独立上传目录，完整上传后切换记录；旧版本文件仍保留在又拍云，可按存储策略清理。
- `NEXT_PUBLIC_SITE_URL` 应填写实际访问源（包含协议和端口），用于浏览器跨站写请求校验。

## 独立实例部署

支持一份镜像维护多个完全隔离的单站长实例，参考 [部署文档](docs/DEPLOYMENT.md) 和 `deploy/compose.yaml`。每个实例分别设置 `DB_PATH`、`JWT_SECRET`、`INSTANCE_ID`。`PUBLIC_SITE_URL` 可在运行时指定，反向代理部署可启用 `TRUST_PROXY=1` 并由可信代理覆盖转发头。

后台提供站点名称、访客留言/点赞开关、修改密码和退出登录。邮件通知尚未实现，因此界面不显示通知开关。旧广场地址重定向至本站首页；保留插件所需的旧接口字段，但前台不再展示多用户平台入口。


### 管理端操作规范

- 工作台聚合写作入口与待审核留言；内容管理、访客与数据、站点设置使用可折叠二级菜单。
- 内容模块默认进入列表，通过新建或上传按钮进入编辑流程。静态页面编辑 Markdown，静态站点上传 ZIP，两者独立管理。
- 设置分为基本信息、外观、页面内容、社交链接、访客互动、存储与上传、账号安全。每个模块独立保存，敏感字段不回传，空白存储密码保留原值。
- 外观设置可分别配置正文字体（系统 / 霞鹜文楷）、界面 UI 字体（遵循正文 / 系统 / 霞鹜文楷）、普通英文字体（Maple Mono / 霞鹜文楷 Mono / 不额外替换）及代码块字体（Maple Mono / 霞鹜文楷 Mono / 系统等宽 / 遵循正文）。默认正文使用系统字体，UI 遵循正文，英文及代码块使用 Maple Mono；已有的文楷开关会保留为正文选择。代码块和源码编辑区优先使用独立设置，行内代码遵循周围正文。
- 字体由本站提供，均使用 `font-display: swap`。只有普通英文使用 Maple Mono 时才预加载约 74 KB 的常规体；其他字体在页面加载完成、浏览器空闲时加载。代码块专用字体等代码块或源码编辑区进入视口附近再加载，并支持切换文章后新插入的代码块。文楷按字符分片下载，英文 Mono 使用限制为拉丁字符的独立字体声明，不会替换中文。
- `npm install`、`npm run dev` 和 `npm run build` 会自动准备 `public/fonts/`（忽略安装脚本时可运行 `npm run fonts:prepare`）。仅复制 Maple Mono 拉丁字形及文楷 / 文楷 Mono 常规、粗体分片，保留字体许可；部署需包含 `public/`，版本化字体资源可缓存一年。
- `/api/manage/settings` 使用模块版本检查并发修改；冲突时保留当前输入，用户可重新加载或撤销修改。原有插件兼容接口继续保留。
- 管理端采用 shadcn/ui 组件与语义颜色；页面切换、折叠与弹层动画支持减少动态效果偏好。
