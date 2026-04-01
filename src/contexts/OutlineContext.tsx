import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * A heading extracted from the active markdown document.
 */
export interface OutlineHeading {
  /** Lexical node key for the heading. */
  key: string
  /** Heading depth (1 for h1 through 6 for h6). */
  level: 1 | 2 | 3 | 4 | 5 | 6
  /** Plain-text heading label. */
  text: string
}

interface OutlineContextValue {
  headings: OutlineHeading[]
  setHeadings: (headings: OutlineHeading[]) => void
  scrollToHeading: ((key: string) => void) | null
  setScrollToHeading: (handler: ((key: string) => void) | null) => void
}

const OutlineContext = createContext<OutlineContextValue | undefined>(undefined)

interface OutlineProviderProps {
  children: ReactNode
}

/**
 * Provides shared state between the markdown editor and the sidebar outline panel.
 */
export function OutlineProvider({ children }: OutlineProviderProps) {
  const [headings, setHeadings] = useState<OutlineHeading[]>([])
  const [scrollToHeading, setScrollToHeadingState] = useState<((key: string) => void) | null>(null)

  const setScrollToHeading = useCallback((handler: ((key: string) => void) | null) => {
    setScrollToHeadingState(() => handler)
  }, [])

  const value = useMemo<OutlineContextValue>(() => {
    return {
      headings,
      setHeadings,
      scrollToHeading,
      setScrollToHeading,
    }
  }, [headings, scrollToHeading, setScrollToHeading])

  return <OutlineContext.Provider value={value}>{children}</OutlineContext.Provider>
}

/**
 * Reads and updates the markdown outline state for the active editor.
 */
export function useOutline(): OutlineContextValue {
  const context = useContext(OutlineContext)

  if (!context) {
    throw new Error('useOutline must be used within an OutlineProvider')
  }

  return context
}
