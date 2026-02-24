/**
 * File Explorer Component
 * Main file tree explorer with search, actions, and workspace management
 */

import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Separator } from '~/components/ui/separator';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { cn } from '~/lib/utils';
import type { FileNode } from '~/types/filesystem';
import { DragGhostItem } from './DragGhostItem';
import { FileTreeActions } from './FileTreeActions';
import { FileSearch } from './FileSearch';
import { FileTreeNode } from './FileTreeNode';

const ROOT_DROP_ID = '__workspace_root__';

function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }

    if (node.kind === 'directory' && node.children) {
      const match = findNodeByPath(node.children, path);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function getParentPath(path: string): string {
  const lastSlashIndex = path.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    return '';
  }
  return path.slice(0, lastSlashIndex);
}

interface RootDropZoneProps {
  draggingNode: FileNode | null;
  isDndDebug: boolean;
  logDnd: (message: string, details: Record<string, unknown>) => void;
}

function RootDropZone({ draggingNode, isDndDebug, logDnd }: RootDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: ROOT_DROP_ID,
  });

  useEffect(() => {
    if (!isDndDebug) {
      return;
    }

    logDnd('root drop hover changed', {
      isRootDropOver: isOver,
      draggingPath: draggingNode?.path ?? null,
    });
  }, [isOver, draggingNode, isDndDebug, logDnd]);

  return (
    <div className="shrink-0 border-t p-2">
      <div
        ref={setNodeRef}
        className={cn(
          'h-12 rounded-sm border border-dashed border-transparent px-2 text-xs text-muted-foreground transition-colors',
          draggingNode && 'border-border/70 bg-muted/10',
          isOver && 'border-primary/70 bg-primary/10 text-foreground'
        )}
      >
        {draggingNode && (
          <div className="flex h-full items-center justify-center">
            Drop here to move to workspace root
          </div>
        )}
      </div>
    </div>
  );
}

export function FileExplorer() {
  const { state, openWorkspace, moveEntry } = useWorkspace();
  const isDndDebug = import.meta.env.DEV;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(state.activeFilePath);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<FileNode | null>(null);
  const lastCollisionSignatureRef = useRef('');
  const lastOverIdRef = useRef<string | null>(null);

  const logDnd = (message: string, details: Record<string, unknown>) => {
    if (!isDndDebug) {
      return;
    }

    console.log(`[FileExplorer DnD] ${message}`, details);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const filteredDroppableContainers = args.droppableContainers.filter(
      (container) => String(container.id) !== String(args.active.id)
    );

    const collisions = pointerWithin({
      ...args,
      droppableContainers: filteredDroppableContainers,
    });

    if (isDndDebug) {
      const collisionIds = collisions.map((collision) => String(collision.id));
      const signature = `${String(args.active.id)}|${collisionIds.join(',')}`;

      if (signature !== lastCollisionSignatureRef.current) {
        lastCollisionSignatureRef.current = signature;

        logDnd('collision update', {
          activeId: String(args.active.id),
          collisionIds,
          rootRegistered: filteredDroppableContainers.some((container) => String(container.id) === ROOT_DROP_ID),
          rootColliding: collisionIds.includes(ROOT_DROP_ID),
          droppableCount: filteredDroppableContainers.length,
        });
      }
    }

    return collisions;
  };

  const { rootHandle, fileTree, isLoading } = state;

  // Filter file tree based on search query
  const filterTree = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();
    
    return nodes.reduce<FileNode[]>((acc, node) => {
      if (node.kind === 'directory' && node.children) {
        // Recursively filter children
        const filteredChildren = filterTree(node.children, query);
        
        // Include directory if it matches or has matching children
        if (node.name.toLowerCase().includes(lowerQuery) || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren,
          });
        }
      } else if (node.kind === 'file') {
        // Include file if name matches
        if (node.name.toLowerCase().includes(lowerQuery)) {
          acc.push(node);
        }
      }
      
      return acc;
    }, []);
  };

  const filteredTree = filterTree(fileTree, searchQuery);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F2') {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      if (isTypingTarget || renamingPath || !selectedPath) {
        return;
      }

      e.preventDefault();
      setRenamingPath(selectedPath);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPath, renamingPath]);

  const handleDragStart = (event: DragStartEvent) => {
    const node = event.active.data.current?.node as FileNode | undefined;

    if (node) {
      setDraggingNode(node);
      logDnd('drag start', {
        activeId: String(event.active.id),
        sourcePath: node.path,
        sourceKind: node.kind,
      });
      return;
    }

    const activeId = String(event.active.id);
    const fallbackNode = findNodeByPath(fileTree, activeId);
    setDraggingNode(fallbackNode);

    logDnd('drag start (fallback node)', {
      activeId,
      sourcePath: fallbackNode?.path ?? null,
      sourceKind: fallbackNode?.kind ?? null,
    });
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!isDndDebug) {
      return;
    }

    const overId = event.over ? String(event.over.id) : null;
    if (overId === lastOverIdRef.current) {
      return;
    }

    lastOverIdRef.current = overId;

    logDnd('drag move over changed', {
      activeId: String(event.active.id),
      overId,
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const sourceNode = draggingNode;
    const targetId = event.over ? String(event.over.id) : null;
    setDraggingNode(null);

    if (!sourceNode || !targetId) {
      logDnd('drag end ignored (missing source or target)', {
        sourcePath: sourceNode?.path ?? null,
        targetId,
      });
      return;
    }

    const sourcePath = sourceNode.path;
    const sourceParentPath = getParentPath(sourcePath);

    if (targetId === ROOT_DROP_ID) {
      if (!sourceParentPath) {
        logDnd('drag end ignored (already at root)', {
          sourcePath,
          targetId,
        });
        return;
      }

      try {
        const movedPath = await moveEntry(sourcePath, '');
        setSelectedPath(movedPath);
        logDnd('move to root success', {
          sourcePath,
          movedPath,
          targetId,
        });
      } catch {
        logDnd('move to root failed', {
          sourcePath,
          targetId,
        });
        // Error toasts are handled by the context
      }

      return;
    }

    const targetNode = findNodeByPath(fileTree, targetId);
    if (!targetNode || targetNode.kind !== 'directory') {
      logDnd('drag end ignored (target not a directory)', {
        sourcePath,
        targetId,
      });
      return;
    }

    const targetPath = targetNode.path;
    if (
      sourcePath === targetPath ||
      sourceParentPath === targetPath ||
      targetPath.startsWith(`${sourcePath}/`)
    ) {
      logDnd('drag end ignored (invalid directory move)', {
        sourcePath,
        sourceParentPath,
        targetPath,
      });
      return;
    }

    try {
      const movedPath = await moveEntry(sourcePath, targetPath);
      setSelectedPath(movedPath);
      logDnd('move to directory success', {
        sourcePath,
        targetPath,
        movedPath,
      });
    } catch {
      logDnd('move to directory failed', {
        sourcePath,
        targetPath,
      });
      // Error toasts are handled by the context
    }
  };

  const handleDragCancel = () => {
    setDraggingNode(null);
    lastOverIdRef.current = null;
    logDnd('drag cancel', {});
  };

  // If no workspace is open, show the open workspace button
  if (!rootHandle) {
    return (
      <div className="h-full flex flex-col border-r">
        <div className="p-3 shrink-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Explorer
          </h2>
        </div>
        <Separator />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              No workspace opened
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={openWorkspace}
              disabled={isLoading}
            >
              {isLoading ? 'Opening...' : 'Open Workspace'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r">
      {/* Header with actions */}
      <div className="p-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Explorer
          </h2>
          <FileTreeActions />
        </div>

        {/* Search input */}
        <FileSearch value={searchQuery} onChange={setSearchQuery} />
      </div>

      <Separator />

      {/* File tree */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Loading...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? 'No files match your search' : 'No files in workspace'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredTree.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    searchQuery={searchQuery}
                    selectedPath={selectedPath}
                    renamingPath={renamingPath}
                    onSelectNode={setSelectedPath}
                    onStartRename={setRenamingPath}
                    onFinishRename={() => setRenamingPath(null)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <RootDropZone draggingNode={draggingNode} isDndDebug={isDndDebug} logDnd={logDnd} />

        <DragOverlay dropAnimation={null}>
          {draggingNode ? <DragGhostItem node={draggingNode} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
