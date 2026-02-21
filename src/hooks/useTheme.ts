import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'mdx-workspace-theme'

/**
 * Custom hook for theme management
 * - Reads from localStorage
 * - Defaults to "system" if no preference
 * - Provides theme, setTheme, resolvedTheme
 * - Toggles dark class on document.documentElement
 * - Listens to prefers-color-scheme media query
 */
export function useTheme() {
  // Initialize theme from localStorage or default to system
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored === 'light' || stored === 'dark' || stored === 'system') 
      ? stored 
      : 'system'
  })

  // Track the system preference
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  // Resolved theme (actual light/dark after resolving system preference)
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  // Listen to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Apply dark class to document.documentElement
  useEffect(() => {
    const root = document.documentElement
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolvedTheme])

  // Persist theme changes to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  return {
    theme,
    setTheme,
    resolvedTheme,
  }
}
