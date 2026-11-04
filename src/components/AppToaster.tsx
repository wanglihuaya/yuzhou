import { useEffect, useState } from 'react'

import { Toaster as SonnerToaster } from '@/components/ui/sonner'

export function AppToaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement

    const update = () => {
      setTheme(root.classList.contains('dark') ? 'dark' : 'light')
    }

    update()

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return <SonnerToaster theme={theme} position="top-center" />
}
