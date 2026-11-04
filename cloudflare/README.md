# xiaoyuzhoufm.dev · Cloudflare Worker

`www.xiaoyuzhoufm.dev` 是一个反向代理 Worker：它把请求原样转发到部署时配置的
主站（Worker secret `ORIGIN`），因此：

- `https://www.xiaoyuzhoufm.dev/episode/<id>` 与
  `https://www.xiaoyuzhoufm.dev/podcast/<id>` 直接由同一个应用处理，
  地址栏保留 `/episode/<id>` 路径；
- 主站的代码、DNS 和证书都不需要改动；
- 页面、`/assets/*`、`/api/*`、`/sw.js` 都由 Worker 转发，播放、下载、
  Service Worker 与主站行为一致。

主站地址通过 secret 注入，不写进仓库。

## 部署前

1. 先把带 `/episode/$eid`、`/podcast/$pid` 路由的应用重新部署到主站。
   Worker 只是代理，不会自己解析页面。
2. 在 Cloudflare 账号中添加 `xiaoyuzhoufm.dev` 这个 zone（域名服务器指向
   Cloudflare）。`.dev` 在 HSTS 预加载列表中，Worker 的自定义域名会自动
   申请证书，必须走 HTTPS。
3. 确认主站可以被 Cloudflare Worker 访问（公网 HTTPS、无 Cloudflare Access
   之类的拦截）。

## 部署

```bash
cd cloudflare
npx wrangler login
npx wrangler deploy
npx wrangler secret put ORIGIN
```

`wrangler secret put ORIGIN` 会提示输入主站的完整 HTTPS 根地址。在 secret
设置完成前，Worker 会返回 500；设置后立即生效，随后可访问：

```text
https://www.xiaoyuzhoufm.dev/episode/<id>
https://www.xiaoyuzhoufm.dev/podcast/<id>
```

`wrangler.toml` 已把 `www.xiaoyuzhoufm.dev` 和裸域 `xiaoyuzhoufm.dev` 都绑定到
这个 Worker；裸域会 301 到 www。

本地开发时，在 `cloudflare/.dev.vars` 中写入（该文件已被 `.gitignore` 忽略）：

```text
ORIGIN="https://主站根地址"
```

然后运行 `npx wrangler dev`。

## 说明

- `ORIGIN` 只接受不带路径、参数或 hash 的 HTTPS 根地址。
- Worker 会给别名页的响应加上 `X-Robots-Tag: noindex, nofollow`，避免搜索引擎
  把镜像当成独立站点收录。
- 所有请求都会经过 Worker。主站的下载首选路径是浏览器 Service Worker
  直连 CDN（`/__cosmos_stream`），不会占用 Worker 带宽；`/api/download`
  兜底代理会经过 Worker。
- 如果主站返回绝对跳转，Worker 会把 `Location` 改回 `.dev` 域名。
