import { createContext, useContext, type ReactNode } from 'react'
import { useTheme, type Theme, type ResolvedTheme } from '~/hooks/useTheme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: ResolvedTheme
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Theme context provider
 * Wraps useTheme hook and provides theme state to all children
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeValue = useTheme()

  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access theme context
 * Must be used within ThemeProvider
 */
export function useThemeContext() {
  const context = useContext(ThemeContext)
  
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  
  return context
}
