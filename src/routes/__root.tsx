import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import Footer from '../components/Footer'
import Header from '../components/Header'
import { AudioPlayerProvider } from '../components/AudioPlayer'
import { AppToaster } from '../components/AppToaster'
import { LibraryProvider } from '../components/LibraryProvider'
import {
  DesktopLibrarySidebar,
  MobileLibrarySheet,
} from '../components/LibrarySidebar'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: '宇宙备份 · 小宇宙音频播放与下载',
      },
      {
        name: 'description',
        content:
          '粘贴小宇宙单集或播客链接，在线播放并下载音频、原图封面与节目简介。无需登录，仅供个人备份。',
      },
      {
        name: 'theme-color',
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#151413',
        media: '(prefers-color-scheme: dark)',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: '宇宙备份',
      },
      {
        name: 'format-detection',
        content: 'telephone=no',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-[10px] tracking-[0.22em] text-brand uppercase">
        404 · Lost in space
      </p>
      <h1 className="mt-3 font-heading text-[28px] font-bold tracking-[-0.02em]">
        这里没有声音。
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        这个页面可能已经漂移到宇宙边缘了。
      </p>
      <Link
        to="/"
        search={{ url: undefined }}
        className="mt-6 inline-flex h-10 items-center rounded-[4px] bg-primary px-4 text-[13px] font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90"
      >
        回到首页
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
        <script
          defer
          src="https://analyse.commands.top/script.js"
          data-website-id="f0b412f9-8fe3-4d43-9889-9cd0e7316857"
        />
        <script
          defer
          src="https://analyse.commands.top/recorder.js"
          data-website-id="f0b412f9-8fe3-4d43-9889-9cd0e7316857"
        />
      </head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <AudioPlayerProvider>
          <LibraryProvider>
            <Header />
            <DesktopLibrarySidebar />
            <div className="flex w-full flex-1 flex-col">{children}</div>
            <Footer />
            <MobileLibrarySheet />
          </LibraryProvider>
        </AudioPlayerProvider>
        <AppToaster />
        <Scripts />
      </body>
    </html>
  )
}
