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
  onTabClose: (path: string) => void
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
            <div className="shrink-0">
              {tab.isDirty ? (
                <div className="w-2 h-2 rounded-full bg-primary" />
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
                  tab.isDirty && 'opacity-0'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }}
                aria-label="Close tab"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
