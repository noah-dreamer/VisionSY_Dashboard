# VisionSY Dashboard

纯静态管理面板，保持原有界面。管理员的浏览器通过 HTTP(S) 管理 API **直接连接 daemon**。
Dashboard 服务器只发送 HTML、JS、CSS、图片，不保存账号、密钥或连接，不代理请求。

## 启动

```bash
cd VisionSY_Dashboard
npm ci
npm run build
npm start
```

默认 `http://localhost:8090`，可通过 `HOST`、`PORT` 调整静态服务器监听地址。
也可将 `public/` 内容直接放在任意静态网站服务器；不需要 Node 后端或数据库。
Docker 构建会自动打包浏览器依赖：

```bash
docker compose up -d --build --wait
```

## 连接和本地账号

首次访问，在浏览器创建解锁账号，然后添加 daemon 地址、端口、协议和连接密钥。
原登录、设置与管理页面布局不变；控制台账号只用于解密当前浏览器的连接存储，不是服务器管理员认证。
daemon 仍独立验证连接密钥及其绑定管理员的权限；面板不再提供密钥管理功能。

连接配置使用 PBKDF2-SHA256（600,000 次）派生密钥及 AES-256-GCM 加密后写入 localStorage。
解密密钥只在内存中，刷新或关闭页面后需要重新解锁。退出即锁定；跨标签页修改配置会锁定旧会话以避免覆盖。
浏览器代码和加密依赖随静态文件提供，无第三方 CDN、远程脚本、遥测；HTTP 局域网测试也可运行。
密码、连接密钥均不发往 Dashboard 服务器；API 使用 Bearer 请求头，不使用 Cookie，不将密钥放入 URL。

更换浏览器/电脑、清除网站数据或改变面板来源后，需要重新设置本地账号并添加 daemon。
遗忘解锁密码后不能恢复连接密钥，需清除面板网站数据再配置。原服务端 `dashboard_data` 卷不再挂载；
已有卷保留以供人工迁移，不自动删除。升级后首次访问需要初始化当前浏览器并重新添加连接。

## daemon 配置

设置 daemon 环境变量，例如：

```dotenv
MANAGEMENT_ALLOWED_ORIGINS=http://192.168.1.10:8090,https://dashboard.example.com
```

来源必须包含协议、主机和非默认端口，不带路径和结尾斜杠。不设置时沿用 `DASHBOARD_URL`；
均为空则不允许跨域面板。daemon 修改环境后须重建/重新创建容器。
只对管理 API 处理 CORS，不开放媒体网站 Cookie。允许预检和备份文件名响应头，不允许携带 Cookie。
浏览器可能询问访问本地网络的权限，需允许。HTTP 面板适用于可信局域网联调；
正式使用 HTTPS 面板和 HTTPS daemon，HTTPS 面板不能直接连接 HTTP daemon。
`127.0.0.1` / `localhost` 指向**管理员电脑**，不再指向 Dashboard 容器。
面板服务器无需能访问 daemon，只需管理员电脑可访问。

## 验证

```bash
npm test
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node test/direct.browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node test/layout.browser.mjs
```

浏览器测试使用 相邻主项目的 `VisionSY_Private/deploy/docker/.split-local/credentials.json`，也可通过 `VISIONSY_LAYOUT_CREDENTIALS` 指定绝对路径 中的本机测试凭据；不输出凭据。
覆盖浏览器直连、错误密钥、CORS、实际 CRUD、备份下载、刷新解锁和原有页面布局。


## Cloudflare Pages（GitHub 自动部署）

面板地址：[https://visionsy-dashboard.pages.dev](https://visionsy-dashboard.pages.dev)。
Pages 项目已连接本仓库，推送到 `main` 会自动触发生产构建。

GitHub 仓库：`noah-dreamer/VisionSY_Dashboard`。使用 Pages 的 Git 集成连接此仓库，不使用 Direct Upload。

| 配置 | 值 |
| --- | --- |
| Pages 项目名称 | `visionsy-dashboard` |
| 生产分支 | `main` |
| 框架预设 | None |
| 根目录 | 仓库根目录 |
| 构建命令 | `npm run build` |
| 构建输出目录 | `public` |
| Node 版本 | `22`（`.node-version`） |
| 生产自动部署 | 开启 |
| 其他分支预览 | 关闭（避免无必要的预览站点） |

Pages 自动安装 package-lock.json 中锁定的依赖。`npm run build` 只生成本地加密依赖的浏览器 bundle，
不需要启动 server.mjs，不需要 Functions、Worker、数据库或 Cloudflare API token。
`public/_headers` 提供静态站点的安全响应头，`404.html` 禁止不存在的接口自动回退到 SPA。
所有功能路由继续使用 URL hash，无需重写规则。

后续在 `main` 提交并推送后，由 Cloudflare 的 GitHub 集成自动构建和发布。Pages 与 GitHub 的授权需要允许访问此私有仓库。

部署地址使用 HTTPS。连接 daemon 时也应使用 HTTPS，并把面板实际来源（如 `https://visionsy-dashboard.pages.dev`）
加入 daemon 的 `MANAGEMENT_ALLOWED_ORIGINS`。该设置在 daemon 端，不能靠 Pages 响应头替代。
现有 HTTP 局域网 daemon 仍可使用本地 HTTP 面板测试；云端 HTTPS 面板不会代理或绕过混合内容限制。
Pages 上的账号和连接仍仅保存在访问者自己的浏览器，不会从本地面板自动同步。
