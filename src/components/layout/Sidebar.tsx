import { OutlinePanel } from '~/components/sidebar/OutlinePanel'
import { FileExplorer } from '~/components/sidebar/FileExplorer'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/components/ui/resizable'

export function Sidebar() {
  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize="30%" minSize="12%" maxSize="60%" collapsible>
        <OutlinePanel />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="70%" minSize="25%">
        <FileExplorer />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
