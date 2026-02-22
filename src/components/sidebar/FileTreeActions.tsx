/**
 * File Tree Actions Component
 * Action buttons for the file explorer (new file, folder, refresh)
 */

import { useState } from 'react';
import { CalendarDays, FolderPlus, FilePlus, RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { NewItemInput } from './NewItemInput';

export function FileTreeActions() {
  const { state, openFile, refreshTree } = useWorkspace();
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpeningDailyNote, setIsOpeningDailyNote] = useState(false);

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

  const handleOpenDailyNote = async () => {
    if (!state.rootHandle) return;

    setIsOpeningDailyNote(true);

    try {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const fileName = `${day}-${month}-${year}.md`;

      let hasTreeChanges = false;
      let dailyHandle: FileSystemDirectoryHandle;

      try {
        dailyHandle = await state.rootHandle.getDirectoryHandle('daily');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          dailyHandle = await state.rootHandle.getDirectoryHandle('daily', { create: true });
          hasTreeChanges = true;
        } else {
          throw error;
        }
      }

      let noteHandle: FileSystemFileHandle;

      try {
        noteHandle = await dailyHandle.getFileHandle(fileName);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          noteHandle = await dailyHandle.getFileHandle(fileName, { create: true });
          hasTreeChanges = true;
        } else {
          throw error;
        }
      }

      if (hasTreeChanges) {
        await refreshTree();
      }

      await openFile(`daily/${fileName}`, noteHandle);
    } catch (error) {
      console.error('Failed to open daily note:', error);
    } finally {
      setIsOpeningDailyNote(false);
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
        aria-label="Open daily note"
        onClick={handleOpenDailyNote}
        disabled={!state.rootHandle || isOpeningDailyNote}
      >
        <CalendarDays className="h-3.5 w-3.5" />
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
              parentPath=""
              onComplete={() => setCreatingItem(null)}
              depth={0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
