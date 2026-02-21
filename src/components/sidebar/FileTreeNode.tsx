/**
 * File Tree Node Component
 * Recursive tree node for files and directories with context menu support
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Circle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '~/components/ui/context-menu';
import { EmojiPicker } from './EmojiPicker';
import { NewItemInput } from './NewItemInput';
import { Input } from '~/components/ui/input';
import type { FileNode } from '~/types/filesystem';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  searchQuery?: string;
  selectedPath: string | null;
  renamingPath: string | null;
  onSelectNode: (path: string) => void;
  onStartRename: (path: string) => void;
  onFinishRename: () => void;
}

export function FileTreeNode({
  node,
  depth,
  searchQuery,
  selectedPath,
  renamingPath,
  onSelectNode,
  onStartRename,
  onFinishRename,
}: FileTreeNodeProps) {
  const { state, openFile, deleteEntry, renameEntry, isDirty } = useWorkspace();
  const [isExpanded, setIsExpanded] = useState(!!searchQuery); // Auto-expand when searching
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);
  const [renameName, setRenameName] = useState(node.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isActive = state.activeFilePath === node.path;
  const isSelected = selectedPath === node.path;
  const isRenaming = renamingPath === node.path;
  const dirty = node.kind === 'file' && isDirty(node.path);

  // Auto-expand directories when searching
  useEffect(() => {
    if (searchQuery && node.kind === 'directory' && node.children) {
      setIsExpanded(true);
    }
  }, [searchQuery, node.kind, node.children]);

  useEffect(() => {
    if (!isRenaming) {
      return;
    }

    setRenameName(node.name);
    setRenameError(null);

    requestAnimationFrame(() => {
      const input = renameInputRef.current;
      if (!input) {
        return;
      }

      input.focus();

      if (node.kind === 'file') {
        const extensionIndex = node.name.lastIndexOf('.');
        if (extensionIndex > 0) {
          input.setSelectionRange(0, extensionIndex);
          return;
        }
      }

      input.select();
    });
  }, [isRenaming, node.name, node.kind]);

  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Name cannot be empty';
    }

    const invalidChars = /[<>:"|?*\\/]/g;
    if (invalidChars.test(value)) {
      return 'Name contains invalid characters';
    }

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(value.toUpperCase())) {
      return 'Reserved name not allowed';
    }

    return null;
  };

  const handleClick = async () => {
    onSelectNode(node.path);

    if (isRenaming) {
      return;
    }

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

  const handleRename = () => {
    onSelectNode(node.path);
    onStartRename(node.path);
  };

  const handleRenameSubmit = async () => {
    const trimmedName = renameName.trim();
    const validationError = validateName(trimmedName);

    if (validationError) {
      setRenameError(validationError);
      return;
    }

    if (trimmedName === node.name) {
      onFinishRename();
      return;
    }

    try {
      const newPath = await renameEntry(node.path, node.kind, trimmedName);
      onSelectNode(newPath);
      onFinishRename();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename item';
      setRenameError(message);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRenameError(null);
      onFinishRename();
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
            onMouseDown={(e) => {
              if (e.button === 2) {
                onSelectNode(node.path);
              }
            }}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-sm cursor-pointer text-sm transition-colors',
              'hover:bg-accent/50',
              isActive && 'bg-accent text-accent-foreground font-medium',
              !isActive && 'text-foreground',
              isSelected && !isActive && 'bg-accent/40'
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
            {isRenaming ? (
              <div className="flex-1 min-w-0">
                <Input
                  ref={renameInputRef}
                  type="text"
                  value={renameName}
                  onChange={(e) => {
                    setRenameName(e.target.value);
                    setRenameError(null);
                  }}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={onFinishRename}
                  className={cn('h-6 text-sm px-1', renameError && 'border-destructive')}
                  onClick={(e) => e.stopPropagation()}
                />
                {renameError && (
                  <p className="text-xs text-destructive mt-0.5">{renameError}</p>
                )}
              </div>
            ) : (
              <span className="truncate flex-1">{node.name}</span>
            )}

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
          <ContextMenuItem onClick={handleRename}>
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
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
              selectedPath={selectedPath}
              renamingPath={renamingPath}
              onSelectNode={onSelectNode}
              onStartRename={onStartRename}
              onFinishRename={onFinishRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
