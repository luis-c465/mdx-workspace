import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import { ScrollArea } from '~/components/ui/scroll-area'
import { cn } from '~/lib/utils'
import { useOutline, type OutlineHeading } from '~/contexts/OutlineContext'
import { useWorkspace } from '~/contexts/WorkspaceContext'

interface OutlineTreeNode extends OutlineHeading {
  children: OutlineTreeNode[]
}

function buildOutlineTree(headings: OutlineHeading[]): OutlineTreeNode[] {
  const roots: OutlineTreeNode[] = []
  const stack: OutlineTreeNode[] = []

  for (const heading of headings) {
    const node: OutlineTreeNode = {
      ...heading,
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  }

  return roots
}

interface OutlineNodeProps {
  node: OutlineTreeNode
  collapsedKeys: Set<string>
  onToggleNode: (key: string) => void
  onJumpToHeading: (key: string) => void
}

function OutlineNode({ node, collapsedKeys, onToggleNode, onJumpToHeading }: OutlineNodeProps) {
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsedKeys.has(node.key)
  const label = node.text.trim() || 'Untitled heading'

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: `${(node.level - 1) * 12}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => onToggleNode(node.key)}
            aria-label={isCollapsed ? 'Expand heading' : 'Collapse heading'}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block h-6 w-6" aria-hidden="true" />
        )}

        <button
          type="button"
          className="flex h-7 min-w-0 flex-1 items-center rounded-sm px-1 text-left text-sm text-foreground/90 transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => onJumpToHeading(node.key)}
          title={label}
        >
          <span className="truncate">{label}</span>
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <OutlineNode
              key={child.key}
              node={child}
              collapsedKeys={collapsedKeys}
              onToggleNode={onToggleNode}
              onJumpToHeading={onJumpToHeading}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OutlinePanel() {
  const { headings, scrollToHeading } = useOutline()
  const { state } = useWorkspace()
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [collapsedHeadingKeys, setCollapsedHeadingKeys] = useState<Set<string>>(new Set())

  const headingTree = useMemo(() => buildOutlineTree(headings), [headings])
  const activeFile = state.openFiles.find((file) => file.path === state.activeFilePath)
  const isMarkdownActive = activeFile?.fileType === 'markdown'

  const handleToggleNode = (key: string) => {
    setCollapsedHeadingKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleJumpToHeading = (key: string) => {
    scrollToHeading?.(key)
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Outline
          </h2>
        </div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setIsPanelCollapsed((previous) => !previous)}
          aria-label={isPanelCollapsed ? 'Expand outline panel' : 'Collapse outline panel'}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', isPanelCollapsed && '-rotate-90')} />
        </button>
      </div>

      {!isPanelCollapsed && (
        <ScrollArea className="flex-1 border-t">
          <div className="p-2">
            {!state.activeFilePath ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Open a file to view its outline</p>
            ) : !isMarkdownActive ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Outline is available for markdown files only</p>
            ) : headings.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No headings found in this file</p>
            ) : (
              <ul className="space-y-0.5">
                {headingTree.map((node) => (
                  <OutlineNode
                    key={node.key}
                    node={node}
                    collapsedKeys={collapsedHeadingKeys}
                    onToggleNode={handleToggleNode}
                    onJumpToHeading={handleJumpToHeading}
                  />
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
