/**
 * File Tree Node Component
 * Recursive tree node for files and directories with context menu support
 */

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Circle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '~/components/ui/context-menu';
import { EmojiPicker } from './EmojiPicker';
import { NewItemInput } from './NewItemInput';
import type { FileNode } from '~/types/filesystem';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  searchQuery?: string;
}

export function FileTreeNode({ node, depth, searchQuery }: FileTreeNodeProps) {
  const { state, openFile, deleteEntry, isDirty } = useWorkspace();
  const [isExpanded, setIsExpanded] = useState(!!searchQuery); // Auto-expand when searching
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);

  const isActive = state.activeFilePath === node.path;
  const dirty = node.kind === 'file' && isDirty(node.path);

  // Auto-expand directories when searching
  useMemo(() => {
    if (searchQuery && node.kind === 'directory' && node.children) {
      setIsExpanded(true);
    }
  }, [searchQuery, node.kind, node.children]);

  const handleClick = async () => {
    if (node.kind === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      // Open file
      try {
        await openFile(node.path, node.handle as FileSystemFileHandle);
      } catch (error) {
        console.error('Failed to open file:', error);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry(node.path);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleNewFile = () => {
    setCreatingItem('file');
    if (node.kind === 'directory') {
      setIsExpanded(true);
    }
  };

  const handleNewFolder = () => {
    setCreatingItem('folder');
    if (node.kind === 'directory') {
      setIsExpanded(true);
    }
  };

  const handleChangeIcon = () => {
    if (node.kind === 'file') {
      setShowEmojiPicker(true);
    }
  };

  // Get directory handle for creating new items
  const getDirHandle = (): FileSystemDirectoryHandle | null => {
    if (node.kind === 'directory') {
      return node.handle as FileSystemDirectoryHandle;
    }
    return null;
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-sm cursor-pointer text-sm transition-colors',
              'hover:bg-accent/50',
              isActive && 'bg-accent text-accent-foreground font-medium',
              !isActive && 'text-foreground'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {/* Expand/collapse chevron for directories */}
            {node.kind === 'directory' && (
              <span className="shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            )}
            
            {/* Icon */}
            <span className="shrink-0">
              {node.kind === 'directory' ? (
                isExpanded ? (
                  <FolderOpen className="h-4 w-4" />
                ) : (
                  <Folder className="h-4 w-4" />
                )
              ) : node.icon ? (
                <span className="text-base leading-none">{node.icon}</span>
              ) : (
                <File className="h-4 w-4" />
              )}
            </span>

            {/* Name */}
            <span className="truncate flex-1">{node.name}</span>

            {/* Dirty indicator */}
            {dirty && (
              <Circle className="h-2 w-2 fill-current shrink-0" />
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          {node.kind === 'directory' && (
            <>
              <ContextMenuItem onClick={handleNewFile}>
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={handleNewFolder}>
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          {node.kind === 'file' && (
            <>
              <ContextMenuItem onClick={handleChangeIcon}>
                Change Icon
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={handleDelete} className="text-destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Emoji Picker */}
      {showEmojiPicker && node.kind === 'file' && (
        <EmojiPicker
          node={node}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Children (for directories) */}
      {node.kind === 'directory' && isExpanded && (
        <div>
          {/* New item input */}
          {creatingItem && (
            <NewItemInput
              type={creatingItem}
              parentHandle={getDirHandle()}
              onComplete={() => setCreatingItem(null)}
              depth={depth + 1}
            />
          )}

          {/* Existing children */}
          {node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
