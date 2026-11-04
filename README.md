# 宇宙备份 · Cosmos Archive

粘贴小宇宙（[xiaoyuzhoufm.com](https://www.xiaoyuzhoufm.com)）的单集或播客链接，解析、在线播放并下载：

- 单集音频的网页内播放（底部播放条；点击展开播放器：移动端为底部抽屉，宽屏为右下角浮层，含大封面、进度拖动、倍速、睡眠定时、后退 15 秒 / 前进 30 秒）
- 播放列表：单个播放只把当前单集放进队列；播客页可用单集行尾的「加入待播列表」逐集添加，或用列表底部的「加入播放列表」批量加入，底部列表按钮展开队列，可切换、清除，播完自动下一集
- `/episode/<id>`、`/podcast/<id>` 路径直达，支持把链接域名替换为 `xiaoyuzhoufm.dev`
- 单集音频（`mp3` / `m4a` / `wav` / `ogg` / `flac` / `aac` 等）
- 单集封面原图
- 播客封面原图
- 主播头像原图
- 节目简介 `.txt`
- 单集页的完整 shownotes（安全过滤后的富文本）与公开评论
- 播客页最新单集的逐集下载与批量下载
- 首页热榜：没有任何链接时展示近期热门单集，点击即可解析
- 搜索：顶部搜索框或 `⌘K` / `Ctrl K` 打开命令面板，按关键词搜索单集并直接解析
- 本地收藏与历史：桌面端右侧浮动栏（可收起、内部滚动）、移动端右上角抽屉，收藏播客或回看打开过的内容
- PWA：可添加到主屏幕并独立窗口启动；Service Worker 缓存名带构建版本号，发版后提示更新并清空旧缓存
- 分享卡片：单集/播客路径与 `?url=` 链接被社交平台抓取时，服务端按标题与封面生成 1200×630 的 OG 图

基于 **TanStack Start**（React 19 + Vite）、**shadcn/ui** 与 **Base UI**（播放器抽屉的 snap point）构建，界面参照
[小宇宙单集页](https://www.xiaoyuzhoufm.com/episode/6ae876cf97726cd4675b98f1) 的视觉语言：
白色纸面、顶部若隐若现的横线纸背景、取自星球标志的青色（`#0A7CA0`）强调色、DIN Alternate /
PingFang 字体组合，以及蓝绿渐变的星球标志。无需登录小宇宙账号。

> 灵感来自 [LGiki/cosmos-enhanced](https://github.com/LGiki/cosmos-enhanced) 浏览器扩展。本项目把「网页内提取 → 原生下载」的思路迁移到了独立 Web 应用。
>
> 源码：[wanglihuaya/yuzhou](https://github.com/wanglihuaya/yuzhou)（MIT）。

## 快速开始

```bash
pnpm install
pnpm dev
```

默认打开 `http://localhost:3000`（端口被占用时 Vite 会自动换一个）。

生产构建与启动：

```bash
pnpm build
pnpm start
```

`pnpm start` 用 `srvx` 以生产模式运行 `dist/server/server.js`，并把
`dist/client` 作为静态资源目录，默认监听 `3000` 端口（用
`pnpm start --port 8080` 可换端口）。只做本地预览时也可以运行 `pnpm preview`。

要求 Node.js 20+、pnpm 10+。

## 支持的输入

- 单集页面：`https://www.xiaoyuzhoufm.com/episode/<24 位 ID>`
- 播客页面：`https://www.xiaoyuzhoufm.com/podcast/<24 位 ID>`
- 路径直达：`<本站>/episode/<24 位 ID>` 或 `<本站>/podcast/<24 位 ID>`
- 别名域名：把上面的 `www.xiaoyuzhoufm.com` 换成 `www.xiaoyuzhoufm.dev` 即可
- 直接输入 24 位 ID：会先按单集解析，找不到再按播客解析
- 从小宇宙 App 复制的分享文案：会自动提取其中的链接

解析结果会写入地址栏的 `?url=` 参数，方便直接分享或刷新恢复；通过
`/episode/<id>`、`/podcast/<id>` 打开时则保留路径。

收藏与历史只保存在当前浏览器的 `localStorage` 中：历史记录打开过的单集和播客，
收藏记录点击收藏的播客（单集页收藏的是它所属的播客）。两者都不会上传到服务器。

桌面端（≥ 1024px）下收藏与历史是一个浮动在页面最右侧的独立面板：固定在视口内、
不随页面滚动，有最大高度，内容超出时在面板内部滚动；标题栏与顶部书签按钮都可以
展开 / 收起，不使用遮罩或背景模糊。更窄的窗口和手机使用顶部右上角的抽屉：
抽屉从屏幕顶部展开到最底部，背后带半透明遮罩与背景模糊。

## 热榜

首页在没有链接时展示「热榜」：近期热门单集，点击条目会直接进入解析流程。
数据来自公开的 [中文播客榜](https://xyzrank.com)（无需登录），服务端抓取后缓存
30 分钟；榜单不可用时会自动隐藏，不影响页面其他功能。

## 搜索

顶部导航的搜索框（移动端为放大镜图标）或 `⌘K` / `Ctrl K` 会打开命令面板：
输入节目名、主播或关键词，结果以列表展示封面、播客名、时长与播放量，回车或点击
即可进入解析流程。搜索同样使用公开的 [中文播客榜](https://xyzrank.com)
接口（`/api/episodes?offset=0&limit=50&q=…`），由服务端请求并做 5 分钟内存缓存，
避免浏览器跨域与重复请求；输入有 260ms 防抖，并处理加载、空结果与请求失败状态。

## 自定义域名（xiaoyuzhoufm.dev）

`xiaoyuzhoufm.dev` 不是另一个应用，而是同一份 Node 部署的别名：把域名解析到
同一台服务器后，`www.xiaoyuzhoufm.com` → `www.xiaoyuzhoufm.dev` 的链接会落到
相同的路由（`/episode/<id>`、`/podcast/<id>`），解析、播放、下载与评论完全一致。

在 Cloudflare 上二选一：

- **代理 DNS（推荐）**：为 `xiaoyuzhoufm.dev` 和 `www` 添加指向服务器的
  A / AAAA（或 CNAME）记录，并开启橙云代理。源站使用 Cloudflare Origin
  Certificate，SSL/TLS 模式设为 Full (strict)。
- **Cloudflare Tunnel**：在服务器上运行 `cloudflared`，把域名指向本机的
  `http://127.0.0.1:3000`，不需要开放端口或配置源站证书。

应用默认监听 `3000`，前面用 Nginx / Caddy 终止 TLS 即可：

```nginx
server {
  listen 443 ssl;
  server_name www.xiaoyuzhoufm.dev;
  # ssl_certificate ...
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

裸域建议跳转到 `www`（Cloudflare Redirect Rule 或 Nginx 均可）。`.dev` 在
HSTS 预加载列表中，别名必须始终使用 HTTPS。

> **为什么不部署到 Cloudflare Workers？** 小宇宙的 WAF 会拒绝任何携带
> `Cf-Worker` 请求头的访问（HTTP 403），而 Workers 对外发起的子请求会被
> 运行时强制加上该头，且无法覆盖或移除。因此页面解析必须由普通服务器完成；
> 把域名直接解析到现有服务器即可，不需要 Worker。

## 移动端与微信

页面针对 iOS Safari 与微信内置浏览器做了适配：

- `viewport-fit=cover` 加安全区内边距，刘海与 Home Indicator 不会遮挡内容。
- 窄屏输入框使用 16px 字号，聚焦时 iOS 不会自动放大页面。
- 主要操作在移动端保持 40–44px 触控高度，主按钮为 44px。
- 支持亮色 / 深色 / 跟随系统三种主题。

微信内置浏览器（`MicroMessenger`）会拦截文件下载，因此：

- 页面顶部显示「微信内无法直接保存文件」提示，可一键复制本页链接。
- 在微信里点击任何下载按钮，不会跳到空白页，而是弹出「在浏览器打开」的分步说明。
- 可以复制本页链接或单个下载地址，粘贴到 Safari / 系统浏览器后继续下载。
- 批量下载同样会被拦截并给出说明，不会静默失败。

## PWA 与发版缓存

- `public/manifest.json` 提供应用名称、图标与 `standalone` 启动方式，
  图标由 `public/favicon.svg` 生成（192 / 512 / maskable，iOS 另用
  `apple-touch-icon`）。
- `public/sw.js` 同时负责 CDN 流式下载与 PWA 缓存。构建时 `vite.config.ts`
  会把「包版本-时间戳」写入 `BUILD_ID`，缓存名形如
  `yuzhou-static-0.0.4-<build>`，每次发版都是全新的缓存桶。
- 页面导航始终**网络优先**，保证发版后拿到新的 HTML；`/assets/` 带内容哈希，
  使用 cache-first；图标与 manifest 使用 stale-while-revalidate；
  `/_serverFn/`、`/api/`、下载流与 `sw.js` 本身不进入缓存。
- 新 worker 安装后先等待，页面弹出「新版本已就绪」；用户点刷新后发送
  `SKIP_WAITING`，新 worker 激活时删除所有旧版本缓存。这样既不会在用户
  听音频时强制刷新，也不会长期停留在旧版本。
- 注册时使用 `updateViaCache: 'none'`，并在标签页回到前台时每 15 分钟检查
  一次，避免浏览器 HTTP 缓存拖住 `sw.js` 的更新。
- 开发环境（`BUILD_ID` 未被替换）不启用任何缓存，只保留流式下载，避免 HMR
  读到旧资源。

## 分享卡片（OG Image）

社交平台抓取链接时不会执行 JavaScript，因此 `/episode/<id>`、`/podcast/<id>`
与带 `?url=` 的首页会在 SSR 阶段识别常见爬虫（Twitter、Telegram、Slack、
Discord、微信等）的 UA，完成一次解析后输出 `og:*` / `twitter:*` 标签。普通
访问者不触发额外的上游请求，仍走原有的客户端解析流程。

- 分享图使用 [ogimagecn](https://www.ogimagecn.com/docs) 的 `photo` / `simple`
  组件（Satori JSX）排版：`src/server/og.tsx` 先用 `satori` 生成 SVG，再用
  `@resvg/resvg-wasm` 栅格化为 1200×630 PNG，不依赖原生二进制。
- 中文字形需要 CJK 字体：`src/assets/fonts/noto-sans-sc-{400,700}.woff` 是
  简体子集（各约 1.5 MB），构建时内联进只在服务端加载的 chunk。
- 封面由服务端下载后以 data URI 交给 Satori，只允许 `*.xyzcdn.net` 与
  `*.xiaoyuzhoufm.com`，避免分享图接口变成开放代理；取图失败时回退到品牌渐变。
- 图片按查询参数做进程内 LRU 缓存，响应带
  `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`。
- SSR 输出对爬虫和普通访问者不同，响应会带上 `Vary: User-Agent`，避免中间缓存
  把两份 HTML 混用。
- 绝对地址默认使用 `https://www.xiaoyuzhoufm.dev`；部署到其他域名时在构建时
  设置 `VITE_SITE_URL=https://example.com`。

## 界面风格（小宇宙同款）

界面不依赖第三方主题包，而是照着[小宇宙单集页](https://www.xiaoyuzhoufm.com/episode/6ae876cf97726cd4675b98f1)
重做了一套设计语言：

- **纸面与横线**：白色背景，页面顶部是一段 1px / 6px 的浅灰横线纸，向下渐隐。
- **青色**：品牌色取自星球标志的起点色 `#25B4E1`，在浅色纸面上加深为 `#0A7CA0`
  以保证白字可读，深色模式提亮为 `#5AC8E8`。用于链接、主按钮、状态点与激活态。
- **字体**：标题使用 DIN Alternate / Barlow Semi Condensed / PingFang 的组合，
  正文回落到系统 UI 字体，与小宇宙网页端一致。
- **标志**：`src/components/Logo.tsx` 中的蓝绿渐变星球（`#25B4E1 → #85C5D0 → #E5D5BE`），
  与站点 favicon 同源。
- **形状**：控件 4px、面板 6–8px 圆角，封面 6px 并带一层柔和投影；
  仅顶部导航与底部播放条使用半透明背景模糊。

`src/cosmos-theme.css` 提供颜色、字体、圆角与 shadcn/ui 的组件重绘；`src/styles.css`
只保留 Tailwind 入口、纸面横线、封面阴影、show notes 排版与减弱动效。

- 浅色是参照页面原本的样子：纯白纸面、细分割线、青色点缀。
- 深色是同一套纸面在黄昏后的版本：冷炭黑背景、相同细线、提亮的青色。
- 字体全部使用系统字体，不加载远程字体文件。

## 工作原理

```
浏览器
  │  1. 输入链接
  ▼
TanStack Start Server Function  ──►  https://www.xiaoyuzhoufm.com/episode|podcast/<id>
  │                                      解析页面内嵌的 __NEXT_DATA__
  ▼
返回结构化数据（音频直链、原图、简介、时长、发布时间…）
  │
  ▼
浏览器发起下载  ──►  媒体 CDN（media.xyzcdn.net / image.xyzcdn.net）
                          ▲ 浏览器直连，不经过本站服务器
```

### 下载为什么不经过服务器？

小宇宙的 CDN（`media.xyzcdn.net` / `image.xyzcdn.net`）返回
`Access-Control-Allow-Origin: *`，允许网页直接读取，所以下载完全由浏览器完成。
按能力从高到低：

1. **Service Worker 流式中转（首选，桌面与手机通用）**：页面跳到同源的
   `/__cosmos_stream?url=…&filename=…`，`public/sw.js` 拦截该请求，把 CDN
   响应流原样返回并加上 `Content-Disposition: attachment`。下载交给浏览器
   **原生下载管理器**：有进度、可后台、可断点续传，内存不随文件增长。
2. **File System Access API**（桌面 Chromium）：`showSaveFilePicker` 直接
   流式写入磁盘。手机浏览器均不支持该 API。
3. **Blob 缓冲**：`fetch` 后生成 Blob 保存。桌面上限 120MB，手机 24–48MB
   （按 `deviceMemory` 判断），避免长度音频撑爆内存。
4. **直接打开 CDN 地址**：超过上限时退化为浏览器内联处理。
5. `/api/download` 代理仅在以上全部失败时兜底。

服务端只负责解析页面数据，因此下载不消耗服务器带宽。

### `/api/download` 兜底代理

代理路由仍然保留：流式转发文件，写入
`Content-Disposition: attachment; filename*=UTF-8''…`，支持 `Range` 断点续传。
**安全限制**：只允许 `https://*.xyzcdn.net` 与 `https://*.xiaoyuzhoufm.com`，其他域名统一返回 `403`。

## 核心文件

| 文件 | 职责 |
| --- | --- |
| `src/lib/xiaoyuzhou.ts` | 链接解析、页面抓取、`__NEXT_DATA__` 提取、数据归一化、文件名生成 |
| `src/lib/sanitize.ts` | 无依赖的白名单 HTML 过滤器：showednotes 富文本安全渲染 |
| `public/sw.js` | Service Worker：CDN 流式下载 + PWA 缓存（按构建版本分桶、安装等待、旧缓存清理） |
| `public/manifest.json` | PWA 清单：名称、图标、`standalone` 启动方式 |
| `vite.config.ts` | 构建时把版本号与时间戳写入 `sw.js` 的 `BUILD_ID` |
| `src/lib/browser.ts` | 下载策略：Service Worker → File System Access → Blob → 直链 |
| `src/routes/api/download.ts` | 流式下载代理、域名白名单、中文文件名、Range 支持（兜底） |
| `src/routes/api/og.ts` | 分享图接口：参数清洗、PNG 响应与缓存头 |
| `src/server/og.tsx` | Satori + resvg-wasm 渲染：字体、封面内联、LRU 缓存 |
| `src/lib/share-meta.ts` | 爬虫识别、解析结果 → OG 元数据、SSR `head` 标签 |
| `src/components/og/*` | ogimagecn 的 `photo` / `simple` 分享图组件 |
| `src/assets/fonts/*` | Noto Sans SC 简体子集（OG 图中文排版） |
| `src/components/ArchiveApp.tsx` | 页面状态、单集/播客视图、播放入口、收藏、批量下载、微信下载提示 |
| `src/components/AudioPlayer.tsx` | 全局播放器：底部播放条、Base UI Drawer 播放器 / 队列抽屉、倍速、播放队列、Media Session |
| `src/components/LibraryProvider.tsx` | 收藏与历史状态、`localStorage` 读写、侧边栏开关 |
| `src/components/LibrarySidebar.tsx` | 桌面右侧浮动面板、移动端抽屉、收藏/历史 tab 与列表 |
| `src/components/HotList.tsx` | 首页热榜列表与加载占位 |
| `src/lib/hot.ts` | 热榜数据抓取、字段归一化与 30 分钟缓存 |
| `src/components/SearchCommand.tsx` | 顶部搜索入口、`⌘K` / `Ctrl K` 命令面板、结果列表与加载状态 |
| `src/components/ui/command.tsx` | shadcn/ui 风格的 command 组件（基于 cmdk + Radix Dialog） |
| `src/lib/search.ts` | 搜索 Server Function：参数校验、关键词截断与 5 分钟 LRU 缓存 |
| `src/lib/xyzrank.ts` | 中文播客榜接口地址、归一化（时长分钟 → 秒）与公共类型 |
| `src/components/Cover.tsx` | 封面图与加载失败占位 |
| `src/lib/library.ts` | 收藏/历史数据结构、存储与去重、URL 归一化 |
| `src/components/PathArchive.tsx` | 把 `/episode/<id>`、`/podcast/<id>` 路径接入现有解析页 |
| `src/routes/episode.$eid.tsx` | 单集路径路由，校验 24 位 ID |
| `src/routes/podcast.$pid.tsx` | 播客路径路由，校验 24 位 ID |
| `src/routes/index.tsx` | `?url=` 搜索参数与首页入口 |
| `src/styles.css` | Tailwind 入口、纸面横线、封面阴影、show notes 排版 |
| `src/cosmos-theme.css` | 小宇宙同款主题 tokens 与 shadcn/ui 组件重绘 |
| `src/lib/wechat.ts` | 微信 UA 检测与下载拦截通知 |
| `src/components/ui/*` | shadcn/ui 组件 |

## 实现细节

- **播放**：音频直接由 CDN 流式播放，不经过本站服务器。播放器挂在根布局上，切换页面不会中断；播放状态、进度与音量交给浏览器原生 `<audio>`，并通过 Media Session API 接入系统锁屏 / 媒体键。付费或私有单集不会出现播放入口。
- **播放器与队列**：点击底部播放条展开播放器（大封面、进度、±15/30 秒、倍速、15/30/45/60 分钟睡眠定时）。移动端是底部抽屉：基于 Base UI Drawer 的 snap point，固定为视口高度的 3/5，顶部手柄可以向下拖动收起；宽屏（≥ 768px）改为右下角浮动的卡片，位于底部播放条上方并留出边距，高度更矮，从右侧滑入，点击卡片外关闭。播放列表入口是控制区下方单独一行的列表图标，打开后只有顶部详情区换成队列列表，底部播放控制保持不变；在播客页点单集播放时只把这一集放进队列；需要整张列表时，用行尾的「加入待播列表」逐集添加，或点列表底部的「加入播放列表」批量加入。小屏幕上的二级操作收进单集行尾的「更多」下拉菜单。队列可切换当前单集或清除其余条目，一集播完会自动播放队列中的下一集。队列只保存在内存中，刷新页面后重置。
- **数据来源**：服务端 `fetch` 小宇宙公开网页，解析 `<script id="__NEXT_DATA__">` 中的 `pageProps`，不依赖需要登录的私有 API。
- **搜索**：命令面板参考 shadcn/ui 的 Command Dialog（cmdk + Radix Dialog），`⌘K` / `Ctrl K` 全局唤起；查询经 260ms 防抖后调用 Server Function，由服务端请求中文播客榜的 `/api/episodes`，结果按关键词缓存 5 分钟（最多 30 条）。选中结果后跳转首页 `?url=`，复用现有解析流程；接口不返回封面或标题的条目会被丢弃。
- **简介与评论**：`shownotes` 是 HTML，先经 `src/lib/sanitize.ts` 白名单过滤（只保留排版标签与 http/https/mailto 链接，丢弃脚本、样式、iframe 等）再渲染为富文本；评论取公开页面内的前 20 条，保留主播 / 置顶标记、点赞数与内嵌回复，评论正文始终按纯文本显示。
- **缓存**：服务端内存缓存 5 分钟（最多 60 条），避免重复抓取页面。
- **原图**：自动去掉 CDN 图片地址末尾的 `@small` / `@middle` / `@large` / `@thumbnail` 尺寸后缀。
- **文件名**：`单集标题 - 播客标题.ext`，自动过滤 `\ / : * ? " < > |` 等非法字符。
- **批量下载**：每次点击间隔 800ms，避免浏览器一次性拦截；浏览器若提示“下载多个文件”，需要手动允许。
- **微信适配**：检测 `MicroMessenger` UA；所有下载入口统一经过 `DownloadLink` / `guardedDownload`，在微信内改为「在浏览器打开」说明弹窗。
- **SPA 适配**：不依赖 DOM 选择器，因此小宇宙前端改版时只需关注页面数据格式。

## 已知限制

- 播客页的公开 HTML 只包含**最新 15 集**；更多历史单集需要登录小宇宙 App，本项目不会收集账号信息，也不绕过限制。
- 付费 / 私有单集会显示「付费 / 受限」，不会尝试播放或下载。
- 网页内播放依赖音频 CDN 可访问；部分网络环境下可能需要下载后离线收听。
- 别名域名与默认域名由同一台服务器提供，服务器不可用时两者都不可用。
- 微信内置浏览器可以播放音频，但锁屏或切到后台时可能被系统暂停；保存文件仍需在系统浏览器中打开。
- 微信内置浏览器不能直接保存文件，需要按页面提示在系统浏览器中打开。
- iOS Safari 批量下载多个文件时可能逐次询问权限，请选择允许。
- 小宇宙页面结构调整可能导致解析失败，此时可在服务端日志中查看抓取结果。
- 热榜依赖第三方公开榜单「中文播客榜」的接口；接口不可用或格式变化时，热榜会自动隐藏，不影响解析与下载。
- 播放器使用普通进度条：小宇宙公开页面没有逐集波形数据，而长播客在浏览器内完整解码的音频缓冲区过大，因此没有实现真实声纹；拖动进度条时会放大，便于查看当前位置。
- 下载的文件仅供个人备份；请遵守平台规则与创作者版权，不要二次传播或商用。

## 免责声明

本项目仅用于学习 Web 开发与个人离线备份。音频、封面、简介等内容的版权归原作者与平台所有。使用本项目产生的任何后果由使用者自行承担。

## License

MIT
