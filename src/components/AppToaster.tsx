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

  // In an iOS standalone PWA the page extends under the status bar, so a
  // toast pinned to the viewport top would sit behind the system chrome.
  // Sonner's defaults are 24px (16px on mobile); push both clear of the
  // safe-area inset so the first line of text stays readable.
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      offset={{ top: 'calc(24px + env(safe-area-inset-top, 0px))' }}
      mobileOffset={{ top: 'calc(16px + env(safe-area-inset-top, 0px))' }}
    />
  )
}
