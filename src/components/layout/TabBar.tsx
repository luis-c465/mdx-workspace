import { X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface Tab {
  path: string
  name: string
  icon?: string
  isDirty: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTabPath: string | null
  onTabClick: (path: string) => void
  onTabClose: (path: string, force?: boolean) => void
}

export function TabBar({ tabs, activeTabPath, onTabClick, onTabClose }: TabBarProps) {
  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="border-b bg-muted/30 shrink-0 overflow-x-auto">
      <div className="flex items-center">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={cn(
              'group relative flex items-center gap-2 px-3 py-2 border-r cursor-pointer hover:bg-muted/50 transition-colors min-w-[120px] max-w-[200px]',
              activeTabPath === tab.path && 'bg-background'
            )}
            onClick={() => onTabClick(tab.path)}
          >
            {/* Icon or emoji */}
            {tab.icon && (
              <span className="text-sm shrink-0">{tab.icon}</span>
            )}
            
            {/* File name */}
            <span className="text-sm truncate flex-1">
              {tab.name}
            </span>

            {/* Dirty indicator or close button */}
            {tab.isDirty ? (
              <Button
                variant="ghost"
                size="icon"
                className="group/dirty relative h-3 w-3 p-0 shrink-0 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path, true)
                }}
                aria-label="Close tab and discard changes"
              >
                <span className="absolute inset-0 flex items-center justify-center transition-opacity group-hover/dirty:opacity-0">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <X className="h-2.5 w-2.5 text-destructive opacity-0 transition-opacity group-hover/dirty:opacity-100" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }}
                aria-label="Close tab"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
