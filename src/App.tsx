import { useEffect, useState } from 'react'
import './App.css'
import { useWorkspace } from './contexts/WorkspaceContext'
import { Button } from './components/ui/button'
import { AppLayout } from './components/layout/AppLayout'
import { Toaster } from './components/ui/sonner'
import { Loader2 } from 'lucide-react'

function App() {
  const { state, openWorkspace, restoreWorkspace } = useWorkspace()
  const [isRestoring, setIsRestoring] = useState(true)

  // Attempt to restore workspace on mount
  useEffect(() => {
    async function tryRestore() {
      try {
        await restoreWorkspace()
      } catch (error) {
        console.error('Failed to restore workspace:', error)
      } finally {
        setIsRestoring(false)
      }
    }

    tryRestore()
  }, [restoreWorkspace])

  // Show loading state while restoring
  if (isRestoring) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-lg">Restoring workspace...</p>
        </div>
      </div>
    )
  }

  // Show landing screen if no workspace is open
  if (!state.rootHandle) {
    return (
      <>
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <div className="text-center space-y-6 max-w-md px-4">
            <h1 className="text-4xl font-bold">MDX Workspace</h1>
            <p className="text-muted-foreground">
              A local-first markdown editor with WYSIWYG editing, file management, and full-text search.
            </p>
            <Button onClick={openWorkspace} size="lg">
              Open Workspace
            </Button>
          </div>
        </div>
        <Toaster />
      </>
    )
  }

  // Show workspace UI with full AppLayout
  return (
    <>
      <AppLayout />
      <Toaster />
    </>
  )
}

export default App
