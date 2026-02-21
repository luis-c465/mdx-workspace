/**
 * File Tree Actions Component
 * Action buttons for the file explorer (new file, folder, refresh)
 */

import { useState } from 'react';
import { FolderPlus, FilePlus, RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { NewItemInput } from './NewItemInput';

export function FileTreeActions() {
  const { state, refreshTree } = useWorkspace();
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTree();
    } catch (error) {
      console.error('Failed to refresh tree:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        aria-label="New file"
        onClick={() => setCreatingItem('file')}
        disabled={!state.rootHandle}
      >
        <FilePlus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        aria-label="New folder"
        onClick={() => setCreatingItem('folder')}
        disabled={!state.rootHandle}
      >
        <FolderPlus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        aria-label="Refresh"
        onClick={handleRefresh}
        disabled={!state.rootHandle || isRefreshing}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>

      {/* Render new item input as a portal/floating element */}
      {creatingItem && state.rootHandle && (
        <div className="fixed inset-0 z-50" onClick={() => setCreatingItem(null)}>
          <div className="absolute top-20 left-4 bg-background border rounded-md p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <NewItemInput
              type={creatingItem}
              parentHandle={state.rootHandle}
              onComplete={() => setCreatingItem(null)}
              depth={0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
