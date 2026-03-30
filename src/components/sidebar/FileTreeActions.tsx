/**
 * File Tree Actions Component
 * Action buttons for the file explorer (new file, folder, refresh)
 */

import { useState } from 'react';
import { CalendarDays, CalendarRange, FolderPlus, FilePlus, RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { NewItemInput } from './NewItemInput';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDailyNotePathInfo(date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  const fileDay = String(normalizedDate.getDate()).padStart(2, '0');
  const fileMonth = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const fileYear = normalizedDate.getFullYear();
  const dayName = shortDayNames[normalizedDate.getDay()];
  const fileName = `${fileDay}-${fileMonth}-${fileYear}-${dayName}.md`;

  const dayOfWeek = normalizedDate.getDay() || 7;
  const monday = new Date(normalizedDate);
  monday.setDate(normalizedDate.getDate() - dayOfWeek + 1);

  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const isoYear = thursday.getFullYear();

  const januaryFourth = new Date(isoYear, 0, 4);
  januaryFourth.setHours(0, 0, 0, 0);
  const januaryFourthDay = januaryFourth.getDay() || 7;

  const firstWeekMonday = new Date(januaryFourth);
  firstWeekMonday.setDate(januaryFourth.getDate() - januaryFourthDay + 1);

  const weekNumber = Math.floor((monday.getTime() - firstWeekMonday.getTime()) / (7 * DAY_IN_MS)) + 1;
  const week = String(weekNumber).padStart(2, '0');
  const weekStartMonth = shortMonthNames[monday.getMonth()];
  const weekStartDay = String(monday.getDate()).padStart(2, '0');
  const weekFolderName = `${isoYear}-${weekStartMonth}-${weekStartDay}-W${week}`;

  return { fileName, weekFolderName };
}

export function FileTreeActions() {
  const { state, openFile, refreshTree } = useWorkspace();
  const [creatingItem, setCreatingItem] = useState<'file' | 'folder' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openingNoteType, setOpeningNoteType] = useState<'daily' | 'weekly' | null>(null);

  const isOpeningDailyNote = openingNoteType === 'daily';
  const isOpeningWeeklyNote = openingNoteType === 'weekly';

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

  const getOrCreateDirectoryHandle = async (
    parentHandle: FileSystemDirectoryHandle,
    directoryName: string
  ): Promise<{ handle: FileSystemDirectoryHandle; created: boolean }> => {
    try {
      const handle = await parentHandle.getDirectoryHandle(directoryName);
      return { handle, created: false };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        const handle = await parentHandle.getDirectoryHandle(directoryName, { create: true });
        return { handle, created: true };
      }

      throw error;
    }
  };

  const getOrCreateFileHandle = async (
    parentHandle: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<{ handle: FileSystemFileHandle; created: boolean }> => {
    try {
      const handle = await parentHandle.getFileHandle(fileName);
      return { handle, created: false };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        const handle = await parentHandle.getFileHandle(fileName, { create: true });
        return { handle, created: true };
      }

      throw error;
    }
  };

  const handleOpenNote = async (noteType: 'daily' | 'weekly') => {
    if (!state.rootHandle) return;

    setOpeningNoteType(noteType);

    try {
      const now = new Date();
      const { fileName: dailyFileName, weekFolderName } = getDailyNotePathInfo(now);
      const fileName = noteType === 'daily' ? dailyFileName : `week-${weekFolderName}.md`;

      const dailyDirectory = await getOrCreateDirectoryHandle(state.rootHandle, 'daily');
      const weekDirectory = await getOrCreateDirectoryHandle(dailyDirectory.handle, weekFolderName);
      const noteFile = await getOrCreateFileHandle(weekDirectory.handle, fileName);

      const hasTreeChanges = dailyDirectory.created || weekDirectory.created || noteFile.created;

      if (hasTreeChanges) {
        await refreshTree();
      }

      await openFile(`daily/${weekFolderName}/${fileName}`, noteFile.handle);
    } catch (error) {
      console.error(`Failed to open ${noteType} note:`, error);
    } finally {
      setOpeningNoteType(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>New file</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Open note"
                disabled={!state.rootHandle || isOpeningDailyNote || isOpeningWeeklyNote}
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Open note</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onSelect={() => void handleOpenNote('daily')}>
            <CalendarDays className="h-4 w-4" />
            Daily note
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleOpenNote('weekly')}>
            <CalendarRange className="h-4 w-4" />
            Weekly note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>New folder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>

      {/* Render new item input as a portal/floating element */}
      {creatingItem && state.rootHandle && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close new item input"
            onClick={() => setCreatingItem(null)}
          />
          <div className="absolute top-20 left-4 z-10 bg-background border rounded-md p-2 shadow-lg">
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
