import { useEffect, useState, useCallback } from 'react'
import { useWorkspace } from '~/contexts/WorkspaceContext'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import { File } from 'lucide-react'
import type { FileNode } from '~/types/filesystem'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { state, openFile } = useWorkspace()

  // Flatten file tree into searchable list
  const flattenFiles = useCallback((nodes: FileNode[], parentPath = ''): FileNode[] => {
    const result: FileNode[] = []
    
    for (const node of nodes) {
      const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name
      
      if (node.kind === 'file' && node.name.endsWith('.md')) {
        result.push({ ...node, path: fullPath })
      }
      
      if (node.kind === 'directory' && node.children) {
        result.push(...flattenFiles(node.children, fullPath))
      }
    }
    
    return result
  }, [])

  const allFiles = flattenFiles(state.fileTree)

  // Keyboard shortcut: Ctrl/Cmd+P
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleSelectFile = async (file: FileNode) => {
    if (file.kind === 'file') {
      try {
        await openFile(file.path, file.handle as FileSystemFileHandle)
        setOpen(false)
      } catch (error) {
        console.error('Failed to open file:', error)
      }
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type to search files..." />
      <CommandList>
        <CommandEmpty>No files found.</CommandEmpty>
        <CommandGroup heading="Files">
          {allFiles.map((file) => (
            <CommandItem
              key={file.path}
              value={file.path}
              onSelect={() => handleSelectFile(file)}
            >
              <File className="mr-2 h-4 w-4" />
              <span>{file.icon && `${file.icon} `}{file.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
