import { LogoMark } from './Logo'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 px-5 pt-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-5 opacity-80" />
          <p className="text-[12px] leading-5 text-muted-foreground">
            宇宙备份 · 基于小宇宙公开页面数据，仅供个人备份与学习。
          </p>
        </div>
        <p className="text-[12px] leading-5 text-muted-foreground">
          音频与封面版权归创作者所有，请尊重原创。
        </p>
      </div>
    </footer>
  )
}
