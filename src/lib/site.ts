/** Canonical public origin, used when a request has no forwarded host. */
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://www.xiaoyuzhoufm.dev'

export const SITE_NAME = '宇宙备份'

export const SITE_TITLE = '宇宙备份 · 小宇宙音频播放与下载'

export const SITE_DESCRIPTION =
  '粘贴小宇宙单集或播客链接，在线播放并下载音频、原图封面与节目简介。无需登录，仅供个人备份。'
