/**
 * File Explorer Component
 * Main file tree explorer with search, actions, and workspace management
 */

import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Separator } from '~/components/ui/separator';
import { FileTreeActions } from './FileTreeActions';
import { FileSearch } from './FileSearch';
import { FileTreeNode } from './FileTreeNode';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import type { FileNode } from '~/types/filesystem';

export function FileExplorer() {
  const { state, openWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(state.activeFilePath);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

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
    </div>
  );
}
