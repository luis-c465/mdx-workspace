/**
 * Markdown Editor Component
 * Main WYSIWYG editor using @mdxeditor/editor with all plugins configured
 */

import { useMemo, useCallback } from 'react'
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

import { EditorToolbar } from './EditorToolbar'
import { searchPlugin } from './search/searchPlugin'
import { useThemeContext } from '~/contexts/ThemeContext'
import { useWorkspace } from '~/contexts/WorkspaceContext'
import { saveImage } from '~/lib/filesystem'
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

export function MarkdownEditor({
  filePath,
  content,
  savedContent,
  onChange,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useThemeContext()
  const { state, refreshTree, saveFile } = useWorkspace()

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
      linkDialogPlugin(),

      // Images - with workspace image upload handler
      imagePlugin({
        imageUploadHandler: handleImageUpload,
      }),

      // Tables
      tablePlugin(),

      // Code blocks with CodeMirror
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({
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
      }),

      // Toolbar
      toolbarPlugin({
        toolbarContents: () => <EditorToolbar />,
      }),

      // Search & Replace plugin (Step 10)
      searchPlugin(),
    ],
    [savedContent, handleImageUpload] // Re-create plugins when savedContent or handleImageUpload changes
  )

  // Apply dark theme class
  const editorClassName = resolvedTheme === 'dark' ? 'dark-theme dark-editor' : ''

  return (
    <div className="h-full w-full">
      <MDXEditor
        key={filePath} // Force re-mount on file switch
        markdown={content}
        onChange={onChange}
        plugins={plugins}
        className={editorClassName}
        contentEditableClassName="prose dark:prose-invert max-w-none"
      />
    </div>
  )
}
