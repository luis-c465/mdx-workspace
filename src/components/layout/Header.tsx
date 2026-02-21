import { useState } from 'react'
import { Moon, Sun, Settings, Search, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { Separator } from '~/components/ui/separator'
import { SettingsDialog } from '~/components/settings/SettingsDialog'
import { useThemeContext } from '~/contexts/ThemeContext'
import { useWorkspace } from '~/contexts/WorkspaceContext'

interface HeaderProps {
  onSearchClick?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ onSearchClick, onToggleSidebar, isSidebarCollapsed }: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { resolvedTheme, setTheme } = useThemeContext()
  const { state, updateSettings } = useWorkspace()
  const autoSave = state.settings.autoSave

  const toggleTheme = () => {
    // Toggle between light and dark (ignoring system for now for simplicity)
    // User can set to system via settings panel later if needed
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const handleAutoSaveToggle = (checked: boolean) => {
    updateSettings({ autoSave: checked })
  }

  return (
    <header className="border-b px-4 py-2 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-2">
        {/* Sidebar toggle button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar (Ctrl+B)"
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        
        <h1 className="text-lg font-semibold">MDX Workspace</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchClick}
          aria-label="Search workspace"
          title="Search workspace (Ctrl+Shift+F)"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Auto-save toggle */}
        <div className="flex items-center gap-2">
          <Switch 
            checked={autoSave}
            onCheckedChange={handleAutoSaveToggle}
            id="auto-save"
          />
          <label 
            htmlFor="auto-save" 
            className="text-sm cursor-pointer select-none"
          >
            Auto-save
          </label>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Settings button */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </header>
  )
}
