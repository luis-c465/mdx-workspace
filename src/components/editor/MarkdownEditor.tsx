/**
 * Markdown Editor Component
 * Main WYSIWYG editor using @mdxeditor/editor with all plugins configured
 */

import { useMemo, useCallback, useRef, useEffect, type MouseEvent } from 'react'
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
  frontmatterPlugin,
  markdownShortcutPlugin,
  diffSourcePlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { basicDark } from 'cm6-theme-basic-dark'
import { basicLight } from 'cm6-theme-basic-light'

import { EditorToolbar } from './EditorToolbar'
import { ImageDialog } from './ImageDialog'
import { LinkDialog } from './LinkDialog'
import { searchPlugin } from './search/searchPlugin'
import { useThemeContext } from '~/contexts/ThemeContext'
import { useWorkspace } from '~/contexts/WorkspaceContext'
import { saveImage, resolveImagePreviewSrc } from '~/lib/filesystem'
import { toast } from 'sonner'
import { useAutoSave } from '~/hooks/useAutoSave'

interface MarkdownEditorProps {
  /** File path (used as key to force re-mount on file switch) */
  filePath: string
  /** Current editor content */
  content: string
  /** Last saved content from disk (for diff mode) */
  savedContent: string
  /** Content change handler */
  onChange: (content: string) => void
}

function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

export function MarkdownEditor({
  filePath,
  content,
  savedContent,
  onChange,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useThemeContext()
  const { state, refreshTree, saveFile } = useWorkspace()
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const imagePreviewUrlCacheRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    return () => {
      for (const objectUrl of imagePreviewUrlCacheRef.current.values()) {
        URL.revokeObjectURL(objectUrl)
      }
      imagePreviewUrlCacheRef.current.clear()
    }
  }, [filePath])

  // Auto-save hook - saves content after 300ms of inactivity (Step 11)
  useAutoSave({
    content,
    savedContent,
    saveFn: useCallback(async () => {
      await saveFile(filePath)
    }, [filePath, saveFile]),
    enabled: state.settings.autoSave,
    delay: 300,
  })

  // Image upload handler - saves images to workspace assets/ folder
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      if (isSvgFile(file)) {
        toast.error('SVG images are not supported')
        throw new Error('SVG images are not supported')
      }

      // Ensure we have a workspace root handle
      if (!state.rootHandle) {
        toast.error('No workspace is open. Cannot save image.')
        throw new Error('No workspace root handle available')
      }

      // Save the image to the assets/ directory
      const relativePath = await saveImage(state.rootHandle, file)

      // Refresh the file tree so the new image appears in the sidebar
      await refreshTree()

      // Show success notification
      toast.success(`Image saved: ${relativePath}`)

      return relativePath
    } catch (error) {
      console.error('Failed to upload image:', error)

      // Check if permission was lost
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.error('Permission denied. Please re-open the workspace.')
      } else {
        toast.error(`Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      throw error
    }
  }, [state.rootHandle, refreshTree])

  const handleImagePreview = useCallback(async (imageSource: string): Promise<string> => {
    if (!state.rootHandle) {
      return imageSource
    }

    const isRelativePath = imageSource.startsWith('./') || imageSource.startsWith('../')
    if (!isRelativePath) {
      return imageSource
    }

    const cachedUrl = imagePreviewUrlCacheRef.current.get(imageSource)
    if (cachedUrl) {
      return cachedUrl
    }

    try {
      const objectUrl = await resolveImagePreviewSrc(state.rootHandle, imageSource)
      imagePreviewUrlCacheRef.current.set(imageSource, objectUrl)
      return objectUrl
    } catch (error) {
      console.error('Failed to resolve image preview source:', error)
      return imageSource
    }
  }, [state.rootHandle])

  // Configure all plugins
  const plugins = useMemo(
    () => [
      // Basic formatting
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),

      // Links
      linkPlugin(),
      linkDialogPlugin({
        LinkDialog,
      }),

      // Images - with workspace image upload handler and custom shadcn dialog
      imagePlugin({
        imageUploadHandler: handleImageUpload,
        imagePreviewHandler: handleImagePreview,
        allowSetImageDimensions: true,
        ImageDialog,
      }),

      // Tables
      tablePlugin(),

      // Code blocks with CodeMirror
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({
        codeMirrorExtensions: [resolvedTheme === 'dark' ? basicDark : basicLight],
        codeBlockLanguages: {
          js: 'JavaScript',
          jsx: 'JavaScript (React)',
          ts: 'TypeScript',
          tsx: 'TypeScript (React)',
          css: 'CSS',
          html: 'HTML',
          json: 'JSON',
          python: 'Python',
          markdown: 'Markdown',
          bash: 'Bash',
          txt: 'Plain Text',
        },
      }),

      // Directives (Admonitions)
      directivesPlugin({
        directiveDescriptors: [AdmonitionDirectiveDescriptor],
      }),

      // Front matter
      frontmatterPlugin(),

      // Markdown shortcuts (e.g., # for heading, > for quote)
      markdownShortcutPlugin(),

      // Diff/Source mode with disk content as baseline
      diffSourcePlugin({
        viewMode: 'rich-text',
        diffMarkdown: savedContent,
        codeMirrorExtensions: [resolvedTheme === 'dark' ? basicDark : basicLight],
      }),

      // Toolbar
      toolbarPlugin({
        toolbarContents: () => <EditorToolbar />,
      }),

      // Search & Replace plugin (Step 10)
      searchPlugin(),
    ],
    [savedContent, handleImageUpload, handleImagePreview, resolvedTheme] // Re-create plugins when handlers, savedContent, or theme changes
  )

  // Apply dark theme class
  const editorClassName = resolvedTheme === 'dark' ? 'dark-theme dark-editor' : ''

  const handleBackgroundMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    // Keep normal behavior for editable/interactive elements.
    if (
      target.closest('[contenteditable="true"]') ||
      target.closest('button, a, input, textarea, select, [role="button"]')
    ) {
      return
    }

    const container = editorContainerRef.current
    if (!container) {
      return
    }

    const editorRoot = container.querySelector('.mdxeditor')
    if (!(editorRoot instanceof HTMLElement) || !editorRoot.contains(target)) {
      return
    }

    const contentEditable = container.querySelector('[contenteditable="true"]')
    if (contentEditable instanceof HTMLElement) {
      event.preventDefault()
      contentEditable.focus()

      const selection = window.getSelection()
      if (!selection) {
        return
      }

      const range = document.createRange()
      range.selectNodeContents(contentEditable)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [])

  return (
    <div ref={editorContainerRef} className="h-full w-full" onMouseDown={handleBackgroundMouseDown}>
      <MDXEditor
        key={`${filePath}-${resolvedTheme}`} // Force re-mount on file or theme switch
        markdown={content}
        onChange={onChange}
        plugins={plugins}
        className={editorClassName}
        contentEditableClassName="prose dark:prose-invert max-w-none"
      />
    </div>
  )
}
