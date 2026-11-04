# 宇宙备份 · Cosmos Archive

粘贴小宇宙（[xiaoyuzhoufm.com](https://www.xiaoyuzhoufm.com)）的单集或播客链接，解析、在线播放并下载：

- 单集音频的网页内播放（底部播放器：进度拖动、后退 15 秒 / 前进 30 秒）
- `/episode/<id>`、`/podcast/<id>` 路径直达，支持把链接域名替换为 `xiaoyuzhoufm.dev`
- 单集音频（`mp3` / `m4a` / `wav` / `ogg` / `flac` / `aac` 等）
- 单集封面原图
- 播客封面原图
- 主播头像原图
- 节目简介 `.txt`
- 单集页的完整 shownotes（安全过滤后的富文本）与公开评论
- 播客页最新单集的逐集下载与批量下载

基于 **TanStack Start**（React 19 + Vite）与 **shadcn/ui** 构建，界面参照
[小宇宙单集页](https://www.xiaoyuzhoufm.com/episode/6ae876cf97726cd4675b98f1) 的视觉语言：
白色纸面、顶部若隐若现的横线纸背景、焦糖橙（`#BE621C`）强调色、DIN Alternate /
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

生产构建：

```bash
pnpm build
pnpm preview
```

要求 Node.js 20+、pnpm 10+。

## 支持的输入

- 单集页面：`https://www.xiaoyuzhoufm.com/episode/<24 位 ID>`
- 播客页面：`https://www.xiaoyuzhoufm.com/podcast/<24 位 ID>`
- 路径直达：`<本站>/episode/<24 位 ID>` 或 `<本站>/podcast/<24 位 ID>`
- 镜像域名：把上面的 `www.xiaoyuzhoufm.com` 换成 `www.xiaoyuzhoufm.dev` 即可
- 直接输入 24 位 ID：会先按单集解析，找不到再按播客解析
- 从小宇宙 App 复制的分享文案：会自动提取其中的链接

页面内可以直接试用两个示例：

- 单集：<https://www.xiaoyuzhoufm.com/episode/6ae967cec96c8942ec167f82>
- 播客：<https://www.xiaoyuzhoufm.com/podcast/682c566cc7c5f17595635a2c>

解析结果会写入地址栏的 `?url=` 参数，方便直接分享或刷新恢复；通过
`/episode/<id>`、`/podcast/<id>` 打开时则保留路径。

## 镜像域名（xiaoyuzhoufm.dev）

`www.xiaoyuzhoufm.dev` 是同一个应用的反向代理入口，由
[`cloudflare/`](cloudflare/) 里的 Cloudflare Worker 实现：

- 访问 `https://www.xiaoyuzhoufm.dev/episode/<id>` 或
  `.../podcast/<id>`，Worker 把请求转发到主站，地址栏保留
  `/episode/<id>` 路径，解析、播放、下载、评论与主站完全一致。
- 主站的代码、DNS 与证书不受影响；只新增 Worker 域名。
- 别名页响应带 `X-Robots-Tag: noindex`，不参与搜索引擎收录。
- 页面、静态资源、`/api/*`、`/sw.js` 都经 Worker 转发；播放器与流式下载仍由
  浏览器直连 CDN。

部署步骤见 [`cloudflare/README.md`](cloudflare/README.md)。注意：先部署带路径
路由的应用到主站，再部署 Worker；Worker 只是代理，不会自行解析页面。

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

## 界面风格（小宇宙同款）

界面不依赖第三方主题包，而是照着[小宇宙单集页](https://www.xiaoyuzhoufm.com/episode/6ae876cf97726cd4675b98f1)
重做了一套设计语言：

- **纸面与横线**：白色背景，页面顶部是一段 1px / 6px 的浅灰横线纸，向下渐隐。
- **焦糖橙**：小宇宙页面从封面提取的主题色是 `hsl(26 74.3% 42.7%)`（`#BE621C`），
  这里固定为品牌色，用于链接、主按钮、状态点与激活态。
- **字体**：标题使用 DIN Alternate / Barlow Semi Condensed / PingFang 的组合，
  正文回落到系统 UI 字体，与小宇宙网页端一致。
- **标志**：`src/components/Logo.tsx` 中的蓝绿渐变星球（`#25B4E1 → #85C5D0 → #E5D5BE`），
  与站点 favicon 同源。
- **形状**：控件 4px、面板 6–8px 圆角，封面 6px 并带一层柔和投影，不使用玻璃拟态。

`src/cosmos-theme.css` 提供颜色、字体、圆角与 shadcn/ui 的组件重绘；`src/styles.css`
只保留 Tailwind 入口、纸面横线、封面阴影、show notes 排版与减弱动效。

- 浅色是参照页面原本的样子：纯白纸面、细分割线、焦糖橙点缀。
- 深色是同一套纸面在黄昏后的版本：暖炭黑背景、相同细线、提亮的橙色。
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
| `public/sw.js` | Service Worker：拦截 `/__cosmos_stream`，把 CDN 响应流交给浏览器下载管理器 |
| `src/lib/browser.ts` | 下载策略：Service Worker → File System Access → Blob → 直链 |
| `src/routes/api/download.ts` | 流式下载代理、域名白名单、中文文件名、Range 支持（兜底） |
| `src/components/ArchiveApp.tsx` | 页面状态、单集/播客视图、播放入口、批量下载、微信下载提示 |
| `src/components/AudioPlayer.tsx` | 全局播放器：音频状态、进度拖动、±15/30 秒、Media Session、底部播放条 |
| `src/components/PathArchive.tsx` | 把 `/episode/<id>`、`/podcast/<id>` 路径接入现有解析页 |
| `src/routes/episode.$eid.tsx` | 单集路径路由，校验 24 位 ID |
| `src/routes/podcast.$pid.tsx` | 播客路径路由，校验 24 位 ID |
| `cloudflare/worker.js` | `xiaoyuzhoufm.dev` 反向代理 Worker（固定上游、重写跳转、noindex） |
| `src/routes/index.tsx` | `?url=` 搜索参数与首页入口 |
| `src/styles.css` | Tailwind 入口、纸面横线、封面阴影、show notes 排版 |
| `src/cosmos-theme.css` | 小宇宙同款主题 tokens 与 shadcn/ui 组件重绘 |
| `src/lib/wechat.ts` | 微信 UA 检测与下载拦截通知 |
| `src/components/ui/*` | shadcn/ui 组件 |

## 实现细节

- **播放**：音频直接由 CDN 流式播放，不经过本站服务器。播放器挂在根布局上，切换页面不会中断；播放状态、进度与音量交给浏览器原生 `<audio>`，并通过 Media Session API 接入系统锁屏 / 媒体键。付费或私有单集不会出现播放入口。
- **数据来源**：服务端 `fetch` 小宇宙公开网页，解析 `<script id="__NEXT_DATA__">` 中的 `pageProps`，不依赖需要登录的私有 API。
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
- 镜像域名依赖主站可访问；Worker 只是反向代理，主站不可用时别名也不可用。
- 微信内置浏览器可以播放音频，但锁屏或切到后台时可能被系统暂停；保存文件仍需在系统浏览器中打开。
- 微信内置浏览器不能直接保存文件，需要按页面提示在系统浏览器中打开。
- iOS Safari 批量下载多个文件时可能逐次询问权限，请选择允许。
- 小宇宙页面结构调整可能导致解析失败，此时可在服务端日志中查看抓取结果。
- 下载的文件仅供个人备份；请遵守平台规则与创作者版权，不要二次传播或商用。

## 免责声明

本项目仅用于学习 Web 开发与个人离线备份。音频、封面、简介等内容的版权归原作者与平台所有。使用本项目产生的任何后果由使用者自行承担。

## License

MIT
