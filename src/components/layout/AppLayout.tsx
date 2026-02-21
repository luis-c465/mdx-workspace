import { useState, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '~/components/ui/resizable'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { EditorArea } from './EditorArea'
import { WorkspaceSearch } from '~/components/search/WorkspaceSearch'
import { CommandPalette } from '~/components/CommandPalette'
import { useWindowFocusRefresh } from '~/hooks/useWindowFocusRefresh'

export function AppLayout() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Auto-refresh file tree on window focus
  useWindowFocusRefresh();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Workspace search (Ctrl/Cmd+Shift+F)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }

      // Toggle sidebar (Ctrl/Cmd+B or Ctrl/Cmd+\)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === '\\')) {
        e.preventDefault();
        setIsSidebarVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        onSearchClick={() => setIsSearchOpen(true)}
        onToggleSidebar={() => setIsSidebarVisible(prev => !prev)}
        isSidebarCollapsed={!isSidebarVisible}
      />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          {isSidebarVisible && (
            <>
              <ResizablePanel
                id="sidebar"
                defaultSize="20%"
                minSize="15%"
                maxSize="40%"
                className="transition-all duration-200"
              >
                <Sidebar />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel defaultSize={`${isSidebarVisible ? 80 : 100}%`}>
            <EditorArea />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Command Palette (Ctrl/Cmd+P) */}
      <CommandPalette />

      {/* Workspace Search Panel (Ctrl/Cmd+Shift+F) */}
      <WorkspaceSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  )
}
