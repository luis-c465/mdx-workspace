/**
 * Auto-Save Hook
 * Provides debounced auto-save functionality for the editor
 */

import { useEffect, useRef } from 'react'

interface UseAutoSaveOptions {
  /** Current content in the editor */
  content: string
  /** Last saved content (from disk) */
  savedContent: string
  /** Function to call to save the content */
  saveFn: () => Promise<void>
  /** Whether auto-save is enabled */
  enabled: boolean
  /** Delay in milliseconds before triggering save (default: 300ms) */
  delay?: number
}

/**
 * Debounced auto-save hook
 * 
 * Automatically saves content after a period of inactivity.
 * Only saves when:
 * - enabled is true
 * - content !== savedContent (file is dirty)
 * - delay has passed since last content change
 * 
 * @example
 * ```tsx
 * useAutoSave({
 *   content: editorContent,
 *   savedContent: fileOnDisk,
 *   saveFn: async () => await saveFile(),
 *   enabled: autoSaveEnabled,
 *   delay: 300
 * })
 * ```
 */
export function useAutoSave({
  content,
  savedContent,
  saveFn,
  enabled,
  delay = 300,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Only auto-save if:
    // 1. Auto-save is enabled
    // 2. Content has changed (file is dirty)
    // 3. Not currently saving (prevent concurrent saves)
    const isDirty = content !== savedContent
    
    if (!enabled || !isDirty || isSavingRef.current) {
      return
    }

    // Set up debounced save
    timeoutRef.current = setTimeout(async () => {
      try {
        isSavingRef.current = true
        await saveFn()
      } catch (error) {
        // Errors are handled by the saveFn itself (shows toast)
        console.error('Auto-save failed:', error)
      } finally {
        isSavingRef.current = false
      }
    }, delay)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [content, savedContent, saveFn, enabled, delay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
}
