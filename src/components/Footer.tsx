import { Orbit } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border/50 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-8 text-[11px] leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-md bg-muted text-muted-foreground">
            <Orbit className="size-3" />
          </span>
          <p>宇宙备份 · 基于小宇宙公开页面数据，仅供个人备份与学习。</p>
        </div>
        <p>音频与封面版权归创作者所有，请尊重原创。</p>
      </div>
    </footer>
  )
}
