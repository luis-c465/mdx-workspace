/**
 * Editor Area Component
 * Main editor area with tab bar and MDX editor
 * Shows welcome screen when no file is open
 */

import { useEffect } from 'react'
import { TabBar } from './TabBar'
import { MarkdownEditor } from '~/components/editor/MarkdownEditor'
import { FilePreview } from '~/components/editor/FilePreview'
import { WelcomeScreen } from '~/components/editor/WelcomeScreen'
import { useWorkspace } from '~/contexts/WorkspaceContext'
import { toast } from 'sonner'

export function EditorArea() {
  const { state, setActiveFile, closeFile, updateContent, isDirty, saveActiveFile } = useWorkspace()

  // Manual save keyboard shortcut (Ctrl/Cmd+S) - Step 11
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault() // Prevent browser's default save dialog
        
        // Only save if there's an active file
        if (state.activeFilePath) {
          try {
            await saveActiveFile()
            toast.success('File saved')
          } catch (error) {
            // Error toast is already shown by saveFile function
            console.error('Manual save failed:', error)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.activeFilePath, saveActiveFile])

  // Map open files to tab data
  const tabs = state.openFiles.map((file) => ({
    path: file.path,
    name: file.path.split('/').pop() || file.path,
    icon: file.icon,
    isDirty: isDirty(file.path),
  }))

  const handleTabClick = (path: string) => {
    setActiveFile(path)
  }

  const handleTabClose = (path: string, force = false) => {
    closeFile(path, force)
  }

  // Get active file data
  const activeFile = state.openFiles.find(
    (file) => file.path === state.activeFilePath
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TabBar
        tabs={tabs}
        activeTabPath={state.activeFilePath}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />

      {/* Render editor or welcome screen */}
      {activeFile ? (
        <div className="flex-1 overflow-hidden">
          {activeFile.fileType === 'markdown' ? (
            <MarkdownEditor
              filePath={activeFile.path}
              content={activeFile.content}
              savedContent={activeFile.savedContent}
              onChange={(content) => updateContent(activeFile.path, content)}
            />
          ) : (
            <FilePreview path={activeFile.path} handle={activeFile.handle} />
          )}
        </div>
      ) : (
        <WelcomeScreen />
      )}
    </div>
  )
}
