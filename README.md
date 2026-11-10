# VisionSY Dashboard

独立媒体管理界面：[https://visionsy-dashboard.pages.dev](https://visionsy-dashboard.pages.dev)。
Cloudflare Pages 通过 GitHub 集成跟随本仓库 `main` 自动构建和发布。

浏览器直接访问 daemon 的管理 API。Pages Functions 只处理控制台登录和连接配置同步，
不会连接 daemon、转发媒体或下载数据库备份。界面沿用原有布局。

## 云端账号与 KV

生产 KV：`VisionSY_Dashboard`，绑定名称 `DASHBOARD_KV`。

KV 保存控制台管理员用户名、登录校验值、加密连接配置、配置版本、短期登录失败计数及退出会话记录。
管理员密码在浏览器经 PBKDF2-SHA256（600,000 次）派生密钥；AES-256-GCM 加密的连接配置才上传 KV。
发送到登录接口的是独立用途的派生校验值，服务端进一步加盐哈希存储。
浏览器解密密钥和 daemon 明文连接密钥均不上传云端，密钥不放入 URL。
Cookie 使用 HttpOnly / Secure / SameSite=Strict，写接口检查来源与 CSRF，密码变化使其他会话失效。

首次访问填写自选管理员用户名、密码及部署时生成的初始化授权码。授权码只用于首次初始化，
服务端仅保存其哈希；公开访客无法直接抢先注册。本站不开放注册第二个管理员。
当前部署的授权码保存在部署工作区被 Git 忽略的 `.local/初始化授权码.txt`，不在 GitHub 和网页中公开。
旧浏览器本地账号不会自动变成云端账号；首次设置云端账号后，需要重新添加 daemon。

此后换设备或清除浏览器数据，可使用同一云端账号登录获取连接配置。
刷新页面后仍需输入密码解密连接。密码丢失无法解密原有连接，重置需由部署管理员执行并重新添加连接。
KV 是最终一致性存储：跨地区修改与会话撤销可能延迟 60 秒以上；配置保存携带版本号，
发现过期版本会要求重新登录，但 KV 不提供原子比较写入。请避免多设备同时修改同一套连接配置。
登录失败计数也是尽力限制；大型公网部署可额外配置 Cloudflare 速率限制。

生产环境需要三个绑定/变量（在 Cloudflare 项目设置中管理，不写进源码）：

- `DASHBOARD_KV`：KV namespace 绑定。
- `DASHBOARD_SESSION_SECRET`：随机会话签名密钥，secret_text。
- `DASHBOARD_SETUP_HASH`：随机初始化授权码的 SHA-256 哈希，secret_text。

Preview 自动部署已关闭；不要将未经审查的预览代码连接生产 KV。

## 本地静态运行

```bash
npm ci
npm run build
npm start
```

默认 `http://localhost:8090`，监听可由 `HOST`、`PORT` 调整。也可 `docker compose up -d --build --wait`。
没有 Pages Functions 的本地静态服务器仍使用原有浏览器本地加密存储，不连接生产 KV。
本地账号和云端账号各自独立。加密依赖随静态文件提供，无第三方 CDN 或遥测。

## 连接 daemon

在 daemon 配置面板的实际来源：

```dotenv
MANAGEMENT_ALLOWED_ORIGINS=https://visionsy-dashboard.pages.dev,http://localhost:8090
```

填写管理员电脑能够访问的 daemon 地址、端口、协议和连接密钥。`127.0.0.1` 指向管理员电脑。
云端面板使用 HTTPS，因此 daemon 也需要 HTTPS；HTTP 局域网 daemon 可继续用本地 HTTP 面板测试。
允许来源需包含协议和非默认端口，不带路径或结尾斜杠。daemon 修改环境后需重新创建容器。
浏览器可能询问访问本地网络的权限。所有用户/图库/素材/任务/邮件/备份操作都由浏览器直接请求 daemon，
管理 API 使用 Bearer 头，不携带媒体站 Cookie。控制台不提供独立密钥管理页。

## Pages 构建设置

| 配置 | 值 |
| --- | --- |
| GitHub 仓库 | `noah-dreamer/VisionSY_Dashboard` |
| Pages 项目 | `visionsy-dashboard` |
| 生产分支 | `main`，开启 Git 推送自动部署 |
| 框架预设 | None |
| 根目录 | 仓库根目录 |
| 构建命令 | `npm run build` |
| 输出目录 | `public` |
| Node 版本 | `22`（`.node-version`） |

Pages 自动按 lockfile 安装依赖并编译 `functions/`；无需启动 server.mjs，也无需 Direct Upload 或 GitHub Actions 部署。
`public/_headers` 设置静态响应头；Functions 自身设置 JSON 安全响应头及 no-store。
`public/_routes.json` 限制 Functions 只处理 `/api/*`；`404.html` 禁止不存在的地址回退到 SPA。
业务页面继续使用 URL hash 路由，无需改写规则。

## 验证

```bash
npm test
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node test/direct.browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node test/layout.browser.mjs
```

Node 测试覆盖本地加密存储、跨设备云端同步、密码轮换、旧会话失效、过期配置拒绝、来源/认证校验和静态服务器。
浏览器联调使用相邻 `VisionSY_Private/deploy/docker/.split-local/credentials.json`，或通过
`VISIONSY_LAYOUT_CREDENTIALS` 指定绝对路径，不输出凭据。云端账号流程不使用该本地测试凭据。
