import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { ThemeProvider } from './contexts/ThemeContext'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'

// Import filesystem tests for development/verification
import './lib/filesystem-tests'
import './lib/workspace-tests'

// Register service worker with update notification
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a toast notification when a new version is available
    if (confirm('New version available! Click OK to update.')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
