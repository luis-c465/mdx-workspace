import { File, Folder } from 'lucide-react'
import type { FileNode } from '~/types/filesystem'

interface DragGhostItemProps {
  node: FileNode
}

export function DragGhostItem({ node }: DragGhostItemProps) {
  return (
    <div className="inline-flex max-w-64 items-center gap-2 rounded-md border bg-popover px-2 py-1 text-sm shadow-lg">
      <span className="shrink-0">
        {node.kind === 'directory' ? (
          node.icon ? (
            <span className="text-base leading-none">{node.icon}</span>
          ) : (
            <Folder className="h-4 w-4" />
          )
        ) : node.icon ? (
          <span className="text-base leading-none">{node.icon}</span>
        ) : (
          <File className="h-4 w-4" />
        )}
      </span>
      <span className="truncate">{node.name}</span>
    </div>
  )
}
