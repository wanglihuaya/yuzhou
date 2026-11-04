import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  FAVORITES_LIMIT,
  HISTORY_LIMIT,
  loadFavorites,
  loadHistory,
  saveFavorites,
  saveHistory,
  type LibraryItem,
} from '@/lib/library'

interface LibraryContextValue {
  /** Opened episodes/podcasts, newest first (localStorage). */
  history: LibraryItem[]
  /** Favorited podcasts/shows, newest first (localStorage). */
  favorites: LibraryItem[]
  addHistory: (item: LibraryItem) => void
  /** Toggle a show; returns true when it is now favorited. */
  toggleFavorite: (item: LibraryItem) => boolean
  removeFavorite: (url: string) => void
  clearHistory: () => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  /** Floating panel on wide screens; independent from the mobile drawer. */
  desktopPanelOpen: boolean
  setDesktopPanelOpen: (open: boolean) => void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<LibraryItem[]>([])
  const [favorites, setFavorites] = useState<LibraryItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(true)
  const favoritesRef = useRef<LibraryItem[]>([])

  useEffect(() => {
    setHistory(loadHistory())
    const stored = loadFavorites()
    favoritesRef.current = stored
    setFavorites(stored)
  }, [])

  const addHistory = useCallback((item: LibraryItem) => {
    setHistory((current) => {
      const next = [
        item,
        ...current.filter((existing) => existing.url !== item.url),
      ].slice(0, HISTORY_LIMIT)
      saveHistory(next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback((item: LibraryItem) => {
    const current = favoritesRef.current
    const exists = current.some((existing) => existing.url === item.url)
    const next = exists
      ? current.filter((existing) => existing.url !== item.url)
      : [item, ...current.filter((existing) => existing.url !== item.url)].slice(
          0,
          FAVORITES_LIMIT,
        )

    favoritesRef.current = next
    setFavorites(next)
    saveFavorites(next)
    return !exists
  }, [])

  const removeFavorite = useCallback((url: string) => {
    const next = favoritesRef.current.filter(
      (existing) => existing.url !== url,
    )
    favoritesRef.current = next
    setFavorites(next)
    saveFavorites(next)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  const value = useMemo<LibraryContextValue>(
    () => ({
      history,
      favorites,
      addHistory,
      toggleFavorite,
      removeFavorite,
      clearHistory,
      sidebarOpen,
      setSidebarOpen,
      desktopPanelOpen,
      setDesktopPanelOpen,
    }),
    [
      history,
      favorites,
      addHistory,
      toggleFavorite,
      removeFavorite,
      clearHistory,
      sidebarOpen,
      desktopPanelOpen,
    ],
  )

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext)
  if (!value) {
    throw new Error('useLibrary must be used inside LibraryProvider')
  }
  return value
}
