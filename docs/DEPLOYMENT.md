# 两个独立博客实例

一份源码和 Docker 镜像，两个容器、数据库和配置。每个实例各自初始化唯一站长，不存在跨站共享用户或数据。

```text
/root/blog/
  app/                 源码（不包含本地 .env.local 和数据库）
  compose.yaml
  .env                 当前发布的镜像标签
  sec/.env             sec 独立密钥与实例名称，权限 600
  sec/data/wind-blog.db
  syc/.env             syc 独立密钥与实例名称，权限 600
  syc/data/wind-blog.db
```

| 实例 | 容器 | 反向代理上游 |
| --- | --- | --- |
| sec | wind-blog-sec | http://127.0.0.1:3101 |
| syc | wind-blog-syc | http://127.0.0.1:3102 |

端口只绑定服务器回环地址。现有 OpenResty 使用 host 网络，可直接访问。两个域名分别代理到对应端口，保持原始 Host 并由代理覆盖转发头：

```nginx
location / {
    proxy_pass http://127.0.0.1:3101; # syc 使用 3102
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 34m;
}
```

实例启用 `TRUST_PROXY=1`，支持之后配置的 HTTPS 域名及浏览器同源写入校验。不要在其前方放置允许客户端原样注入转发头的代理。若希望固定公开源，可分别在实例 `.env` 设置 `PUBLIC_SITE_URL=https://对应域名`，然后重建容器。

配置反向代理后，分别访问每个站点的 `/setup` 创建该站唯一站长。应用密钥已经各自生成；SSH 密码不会写入代码或容器配置。

## 日常管理

```bash
cd /root/blog
docker compose ps
docker compose logs --tail=100 sec
docker compose restart sec
# 修改实例 .env 后需重建容器，而不是仅 restart
docker compose up -d sec
```

## GitHub Actions 发布

`main` 每次提交都会执行 `.github/workflows/release.yml`：在 GitHub 上编译 Dockerfile，并推送

```text
registry.cn-hangzhou.aliyuncs.com/sanenchen/wind-blog:<commit sha>
registry.cn-hangzhou.aliyuncs.com/sanenchen/wind-blog:latest
```

仓库 Secrets 需要配置：

| 名称 | 值 |
| --- | --- |
| `ACR_USERNAME` | `sanenchen` |
| `ACR_PASSWORD` | 阿里云镜像仓库访问凭证密码，不是阿里云登录密码 |
| `DEPLOY_SCRIPT` | 镜像推送成功后执行的部署脚本。可使用 `$IMAGE_TAG`（本次提交 sha） |

这台服务器访问不了镜像仓库 VPC 地址，使用公网地址。先登录一次：

```bash
docker login --username=sanenchen registry.cn-hangzhou.aliyuncs.com
install -m 755 /root/blog/app/deploy/upgrade-wind-blog.sh /root/upgrade-wind-blog.sh
```

之后升级并删除旧镜像：

```bash
~/upgrade-wind-blog.sh            # 拉取 latest
~/upgrade-wind-blog.sh <commit>   # 拉取指定提交
```

脚本会更新 `/root/blog/.env` 的 `WIND_BLOG_IMAGE`，重建 `sec` 和 `syc`。升级失败时恢复上一版镜像。

## 发布更新

当前服务器约 1.9GB 内存、无 swap，只用于运行实例。此机器请使用下文“上传构建产物”流程，不执行 Next 编译。每个博客容器限制 384MB 内存，避免应用进程耗尽宿主机资源。

将源码更新到 `/root/blog/app`，不覆盖实例配置和 `data`。下列源码构建命令应在内存充足的构建机器执行；当前服务器使用预构建运行目录生成镜像。构建成功后才切换镜像：

```bash
cd /root/blog
docker build -t wind-blog:release-YYYYMMDD-HHMM ./app
# 将 .env 的 WIND_BLOG_IMAGE 更新为新标签，保留旧标签便于回滚
docker compose up -d
docker compose ps
```

回滚时把 `WIND_BLOG_IMAGE` 改回旧标签，再执行 `docker compose up -d`。数据库格式有变化时先备份；不要删除实例数据目录。

## 备份与恢复

SQLite 使用 WAL，不应在运行中只复制主 `.db` 文件。可以用 SQLite 的 `VACUUM INTO` 导出一致快照：

```bash
cd /root/blog
mkdir -p sec/data/backups syc/data/backups
chown -R 1000:1000 sec/data/backups syc/data/backups
docker compose exec sec node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DB_PATH);db.exec(\"VACUUM INTO '/data/backups/backup-YYYYMMDD.db'\");db.close()"
```

备份包含站点设置和图床凭据，请限制读取权限。恢复时停止对应容器，保存现有 `.db`、`-wal`、`-shm`，用备份替换主库、清除旧 WAL/SHM，再恢复目录所有者 1000:1000 并启动对应实例。

## 忘记站长密码

```bash
cd /root/blog
docker compose exec sec node scripts/reset-password.mjs
# syc 改用 docker compose exec syc ...
```

交互输入新密码，不回显；至少 12 位。重置后所有旧登录会话失效，博客内容不受影响。此命令不能创建第二位站长。

## 小内存服务器：上传构建产物

如果服务器内存较小，先在开发机器构建，再打包适用于 Linux x64 / glibc 的运行目录。打包脚本从 lockfile 指定的 npm 地址获取对应原生依赖并校验完整性，排除本地 `.env` 和数据库：

```bash
npm ci
npm test
npm run build
node scripts/package-runtime.mjs /tmp/wind-blog-release/runtime
# 将 runtime 目录上传到服务器 /root/blog/runtime-app
cd /root/blog/runtime-app
docker build --pull=false -t wind-blog:release-YYYYMMDD-HHMM .
```

此镜像构建只打包运行文件，不在小内存服务器上执行 Next 编译。第一次启动前可用镜像中的 Node 初始化实例配置，无需在宿主机安装 Node/Python：

```bash
docker run --rm --user root -v /root/blog:/deployment --entrypoint node wind-blog:release-YYYYMMDD-HHMM /deployment/app/deploy/configure-instances.mjs
```

初始化脚本只在配置文件不存在时创建独立密钥，不覆盖已有实例配置，不创建站长账号。
