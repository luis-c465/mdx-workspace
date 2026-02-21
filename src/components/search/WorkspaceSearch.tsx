import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useWorkspaceSearch } from '~/hooks/useWorkspaceSearch';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { SearchResult } from './SearchResult';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '~/components/ui/sheet';

interface WorkspaceSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkspaceSearch({ isOpen, onClose }: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { searchResults, isSearching, isIndexing, indexSize, search, clearSearch } = useWorkspaceSearch();
  const { openFile, state } = useWorkspace();
  const { rootHandle } = state;

  // Debounce search query (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      search(debouncedQuery);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, search, clearSearch]);

  // Clear search when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      clearSearch();
    }
  }, [isOpen, clearSearch]);

  // Handle opening a file from search results
  const handleOpenFile = useCallback(async (path: string) => {
    if (!rootHandle) return;

    try {
      // Navigate to the file handle
      const pathSegments = path.split('/');
      let currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle = rootHandle;

      for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        if (i === pathSegments.length - 1) {
          // Last segment is the file
          const fileHandle = await (currentHandle as FileSystemDirectoryHandle).getFileHandle(segment);
          await openFile(path, fileHandle);
          onClose();
          break;
        } else {
          // Directory segment
          currentHandle = await (currentHandle as FileSystemDirectoryHandle).getDirectoryHandle(segment);
        }
      }
    } catch (error) {
      console.error('Failed to open file from search:', error);
    }
  }, [rootHandle, openFile, onClose]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+Shift+F to toggle search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Search Workspace</SheetTitle>
          <SheetDescription>
            Search across all markdown files in your workspace
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Status Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isIndexing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Indexing files...
                </span>
              ) : (
                <span>{indexSize} files indexed</span>
              )}
            </span>
            {searchResults.length > 0 && (
              <span>{searchResults.length} results</span>
            )}
          </div>

          {/* Results */}
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-1 pr-4">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <SearchResult
                    key={result.id}
                    result={result}
                    onClick={handleOpenFile}
                  />
                ))
              ) : query.trim() ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Start typing to search...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Keyboard Hints */}
          <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Press</span>
              <span className="font-mono bg-muted px-2 py-0.5 rounded">Ctrl+Shift+F</span>
              <span>to close</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Press</span>
              <span className="font-mono bg-muted px-2 py-0.5 rounded">Esc</span>
              <span>to close</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
