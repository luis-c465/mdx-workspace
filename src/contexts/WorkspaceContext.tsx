/**
 * Workspace Context
 * Manages workspace state: file tree, open files, active file, settings
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { WorkspaceState, OpenFile, WorkspaceSettings } from '../types/workspace';
import type { FileNode } from '../types/filesystem';
import {
  openWorkspace as fsOpenWorkspace,
  restoreWorkspace as fsRestoreWorkspace,
  buildFileTree,
  readFile,
  writeFile,
  createFile as fsCreateFile,
  createDirectory as fsCreateDirectory,
  deleteEntry as fsDeleteEntry,
  renameFile as fsRenameFile,
  renameDirectory as fsRenameDirectory,
  readFileIcon,
  getParentDirectoryHandle,
  getFileByPath,
  IMAGE_EXTENSIONS,
} from '../lib/filesystem';
import { getSetting, saveSetting } from '../lib/storage';

const MARKDOWN_EXTENSIONS = ['.md'];

function getFileType(path: string): OpenFile['fileType'] {
  const lowerPath = path.toLowerCase();
  if (MARKDOWN_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return 'markdown';
  }
  if (IMAGE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return 'image';
  }
  return 'unknown';
}

// Action types
type WorkspaceAction =
  | { type: 'SET_ROOT_HANDLE'; payload: FileSystemDirectoryHandle }
  | { type: 'SET_FILE_TREE'; payload: FileNode[] }
  | { type: 'OPEN_FILE'; payload: OpenFile }
  | { type: 'CLOSE_FILE'; payload: string }
  | { type: 'SET_ACTIVE_FILE'; payload: string }
  | { type: 'UPDATE_CONTENT'; payload: { path: string; content: string } }
  | { type: 'MARK_SAVED'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<WorkspaceSettings> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'REFRESH_FILE_ICON'; payload: { path: string; icon?: string } }
  | { type: 'TOGGLE_PIN_FILE'; payload: string }
  | { type: 'SET_OPEN_FILES_AND_ACTIVE'; payload: { openFiles: OpenFile[]; activeFilePath: string | null } };

// Initial state
const initialState: WorkspaceState = {
  rootHandle: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  settings: {
    autoSave: false,
    theme: 'system',
    maxOpenTabs: 0,
  },
  isLoading: false,
};

// Reducer
function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'SET_ROOT_HANDLE':
      return {
        ...state,
        rootHandle: action.payload,
      };

    case 'SET_FILE_TREE':
      return {
        ...state,
        fileTree: action.payload,
      };

    case 'OPEN_FILE': {
      const now = Date.now();
      // Check if file is already open
      const existingFile = state.openFiles.find(f => f.path === action.payload.path);
      if (existingFile) {
        // Just switch to it
        return {
          ...state,
          activeFilePath: action.payload.path,
          openFiles: state.openFiles.map(f =>
            f.path === action.payload.path
              ? { ...f, lastAccessedAt: now }
              : f
          ),
        };
      }

      // Add new file to open files
      return {
        ...state,
        openFiles: [...state.openFiles, { ...action.payload, lastAccessedAt: now }],
        activeFilePath: action.payload.path,
      };
    }

    case 'CLOSE_FILE': {
      const fileIndex = state.openFiles.findIndex(f => f.path === action.payload);
      if (fileIndex === -1) return state;

      const newOpenFiles = state.openFiles.filter(f => f.path !== action.payload);
      
      // If the closed file was active, switch to adjacent tab
      let newActiveFilePath = state.activeFilePath;
      if (state.activeFilePath === action.payload) {
        if (newOpenFiles.length === 0) {
          // No files left
          newActiveFilePath = null;
        } else if (fileIndex < newOpenFiles.length) {
          // Switch to the file at the same index (or the previous one if it was the last)
          newActiveFilePath = newOpenFiles[fileIndex].path;
        } else {
          // Was the last file, switch to the new last file
          newActiveFilePath = newOpenFiles[newOpenFiles.length - 1].path;
        }
      }

      return {
        ...state,
        openFiles: newOpenFiles,
        activeFilePath: newActiveFilePath,
      };
    }

    case 'SET_ACTIVE_FILE':
      return {
        ...state,
        activeFilePath: action.payload,
        openFiles: state.openFiles.map(f =>
          f.path === action.payload
            ? { ...f, lastAccessedAt: Date.now() }
            : f
        ),
      };

    case 'UPDATE_CONTENT': {
      return {
        ...state,
        openFiles: state.openFiles.map(f =>
          f.path === action.payload.path
            ? { ...f, content: action.payload.content }
            : f
        ),
      };
    }

    case 'MARK_SAVED': {
      return {
        ...state,
        openFiles: state.openFiles.map(f =>
          f.path === action.payload
            ? { ...f, savedContent: f.content }
            : f
        ),
      };
    }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'REFRESH_FILE_ICON': {
      return {
        ...state,
        openFiles: state.openFiles.map(f =>
          f.path === action.payload.path
            ? { ...f, icon: action.payload.icon }
            : f
        ),
      };
    }

    case 'TOGGLE_PIN_FILE': {
      return {
        ...state,
        openFiles: state.openFiles.map(f =>
          f.path === action.payload
            ? { ...f, isPinned: !f.isPinned }
            : f
        ),
      };
    }

    case 'SET_OPEN_FILES_AND_ACTIVE':
      return {
        ...state,
        openFiles: action.payload.openFiles,
        activeFilePath: action.payload.activeFilePath,
      };

    default:
      return state;
  }
}

// Context type
interface WorkspaceContextType {
  state: WorkspaceState;
  openWorkspace: () => Promise<void>;
  restoreWorkspace: () => Promise<boolean>;
  openFile: (path: string, handle: FileSystemFileHandle) => Promise<void>;
  closeFile: (path: string, force?: boolean) => Promise<boolean>;
  saveFile: (path: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
  pinFile: (path: string) => void;
  closeOtherTabs: (path: string) => Promise<void>;
  closeTabsToLeft: (path: string) => Promise<void>;
  closeTabsToRight: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  createFile: (dirHandle: FileSystemDirectoryHandle, name: string) => Promise<void>;
  createDirectory: (dirHandle: FileSystemDirectoryHandle, name: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  renameEntry: (path: string, kind: 'file' | 'directory', newName: string) => Promise<string>;
  setActiveFile: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  updateSettings: (settings: Partial<WorkspaceSettings>) => Promise<void>;
  isDirty: (path: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

// Provider component
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const autoSave = await getSetting<boolean>('autoSave');
        const theme = await getSetting<'light' | 'dark' | 'system'>('theme');
        const maxOpenTabs = await getSetting<number>('maxOpenTabs');
        
        dispatch({
          type: 'UPDATE_SETTINGS',
          payload: {
            ...(autoSave !== undefined && { autoSave }),
            ...(theme !== undefined && { theme }),
            ...(maxOpenTabs !== undefined && { maxOpenTabs }),
          },
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }

    loadSettings();
  }, []);

  // Open workspace using directory picker
  const openWorkspace = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Show directory picker and save handle
      const handle = await fsOpenWorkspace();
      dispatch({ type: 'SET_ROOT_HANDLE', payload: handle });

      // Build file tree
      const tree = await buildFileTree(handle);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });
      
      toast.success('Workspace opened successfully');
    } catch (error) {
      console.error('Failed to open workspace:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled - no need to show error
        return;
      }
      toast.error('Failed to open workspace', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Restore workspace from IndexedDB
  const restoreWorkspace = useCallback(async (): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const handle = await fsRestoreWorkspace();
      if (!handle) {
        return false;
      }

      dispatch({ type: 'SET_ROOT_HANDLE', payload: handle });

      // Build file tree
      const tree = await buildFileTree(handle);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });

      return true;
    } catch (error) {
      console.error('Failed to restore workspace:', error);
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Open a file (or switch to it if already open)
  const openFile = useCallback(async (path: string, handle: FileSystemFileHandle) => {
    try {
      const now = Date.now();
      // Check if already open
      const existingFile = state.openFiles.find(f => f.path === path);
      if (existingFile) {
        dispatch({ type: 'SET_ACTIVE_FILE', payload: path });
        return;
      }

      // Enforce tab limit using LRU strategy (excluding active and pinned tabs when possible)
      if (state.settings.maxOpenTabs > 0 && state.openFiles.length >= state.settings.maxOpenTabs) {
        const nonActiveUnpinnedFiles = state.openFiles.filter((f) => f.path !== state.activeFilePath && !f.isPinned);
        const unpinnedFiles = state.openFiles.filter((f) => !f.isPinned);
        const lruCandidate = (nonActiveUnpinnedFiles.length > 0 ? nonActiveUnpinnedFiles : unpinnedFiles)
          .slice()
          .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)[0];

        if (lruCandidate) {
          if (lruCandidate.fileType === 'markdown' && lruCandidate.content !== lruCandidate.savedContent) {
            await writeFile(lruCandidate.handle, lruCandidate.content);
            dispatch({ type: 'MARK_SAVED', payload: lruCandidate.path });
          }

          dispatch({ type: 'CLOSE_FILE', payload: lruCandidate.path });
          toast(`Closed tab to enforce max tab limit: ${lruCandidate.path}`);
        }
      }

      const fileType = getFileType(path);
      let content = '';
      let icon: string | undefined;

      if (fileType === 'markdown') {
        content = await readFile(handle);
        icon = readFileIcon(content);
      }

      const openFile: OpenFile = {
        path,
        handle,
        content,
        savedContent: content, // Initially, saved = current
        fileType,
        lastAccessedAt: now,
        icon,
      };

      dispatch({ type: 'OPEN_FILE', payload: openFile });
    } catch (error) {
      console.error('Failed to open file:', error);
      toast.error('Failed to open file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [state.activeFilePath, state.openFiles, state.settings.maxOpenTabs]);

  // Close a file with dirty check
  const closeFile = useCallback(async (path: string, force = false): Promise<boolean> => {
    const file = state.openFiles.find(f => f.path === path);
    if (!file) return true;

    // Check if dirty
    const dirty = file.fileType === 'markdown' && file.content !== file.savedContent;
    if (dirty && !force) {
      // Prompt user
      const discard = window.confirm(
        `"${path}" has unsaved changes. Do you want to discard them?`
      );
      if (!discard) {
        return false; // User cancelled
      }
    }

    dispatch({ type: 'CLOSE_FILE', payload: path });
    return true;
  }, [state.openFiles]);

  // Save a file
  const saveFile = useCallback(async (path: string) => {
    const file = state.openFiles.find(f => f.path === path);
    if (!file) {
      throw new Error(`File ${path} is not open`);
    }

    if (file.fileType !== 'markdown') {
      return;
    }

    try {
      await writeFile(file.handle, file.content);
      dispatch({ type: 'MARK_SAVED', payload: path });

      // Re-read icon in case it changed
      const icon = readFileIcon(file.content);
      dispatch({ type: 'REFRESH_FILE_ICON', payload: { path, icon } });
      
      toast.success('File saved', { description: path });
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error('Failed to save file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [state.openFiles]);

  // Save the active file
  const saveActiveFile = useCallback(async () => {
    if (!state.activeFilePath) {
      throw new Error('No active file to save');
    }
    await saveFile(state.activeFilePath);
  }, [state.activeFilePath, saveFile]);

  // Toggle pin state for a tab
  const pinFile = useCallback((path: string) => {
    dispatch({ type: 'TOGGLE_PIN_FILE', payload: path });
  }, []);

  // Close all tabs except the specified one
  const closeOtherTabs = useCallback(async (path: string): Promise<void> => {
    const pathsToClose = state.openFiles
      .map((file) => file.path)
      .filter((filePath) => filePath !== path);

    for (const filePath of pathsToClose) {
      const closed = await closeFile(filePath);
      if (!closed) {
        return;
      }
    }
  }, [closeFile, state.openFiles]);

  // Close tabs that appear before the specified tab
  const closeTabsToLeft = useCallback(async (path: string): Promise<void> => {
    const tabIndex = state.openFiles.findIndex((file) => file.path === path);
    if (tabIndex <= 0) {
      return;
    }

    const pathsToClose = state.openFiles
      .slice(0, tabIndex)
      .map((file) => file.path);

    for (const filePath of pathsToClose) {
      const closed = await closeFile(filePath);
      if (!closed) {
        return;
      }
    }
  }, [closeFile, state.openFiles]);

  // Close tabs that appear after the specified tab
  const closeTabsToRight = useCallback(async (path: string): Promise<void> => {
    const tabIndex = state.openFiles.findIndex((file) => file.path === path);
    if (tabIndex === -1 || tabIndex >= state.openFiles.length - 1) {
      return;
    }

    const pathsToClose = state.openFiles
      .slice(tabIndex + 1)
      .map((file) => file.path);

    for (const filePath of pathsToClose) {
      const closed = await closeFile(filePath);
      if (!closed) {
        return;
      }
    }
  }, [closeFile, state.openFiles]);

  // Refresh file tree
  const refreshTree = useCallback(async () => {
    if (!state.rootHandle) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const tree = await buildFileTree(state.rootHandle);
      dispatch({ type: 'SET_FILE_TREE', payload: tree });
    } catch (error) {
      console.error('Failed to refresh tree:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.rootHandle]);

  // Create a file
  const createFile = useCallback(async (dirHandle: FileSystemDirectoryHandle, name: string) => {
    try {
      await fsCreateFile(dirHandle, name);
      await refreshTree();
      toast.success('File created', { description: name });
    } catch (error) {
      console.error('Failed to create file:', error);
      toast.error('Failed to create file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [refreshTree]);

  // Create a directory
  const createDirectory = useCallback(async (dirHandle: FileSystemDirectoryHandle, name: string) => {
    try {
      await fsCreateDirectory(dirHandle, name);
      await refreshTree();
      toast.success('Directory created', { description: name });
    } catch (error) {
      console.error('Failed to create directory:', error);
      toast.error('Failed to create directory', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [refreshTree]);

  // Delete an entry
  const deleteEntry = useCallback(async (path: string) => {
    if (!state.rootHandle) return;

    try {
      // Close the file if it's open
      const fileToClose = state.openFiles.find(f => f.path === path || f.path.startsWith(path + '/'));
      if (fileToClose) {
        const closed = await closeFile(fileToClose.path, false);
        if (!closed) {
          return; // User cancelled
        }
      }

      // Get the item name from the path
      const lastSlashIndex = path.lastIndexOf('/');
      const name = lastSlashIndex === -1 ? path : path.substring(lastSlashIndex + 1);

      // Confirm deletion
      const confirmed = window.confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`
      );
      if (!confirmed) return;

      // Get parent directory handle
      const parentHandle = await getParentDirectoryHandle(state.rootHandle, path);
      
      // Delete the entry
      await fsDeleteEntry(parentHandle, name);
      
      // Refresh tree
      await refreshTree();
      
      toast.success('Deleted successfully', { description: name });
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [state.rootHandle, state.openFiles, closeFile, refreshTree]);

  // Rename a file or directory entry
  const renameEntry = useCallback(async (
    path: string,
    kind: 'file' | 'directory',
    newName: string
  ): Promise<string> => {
    if (!state.rootHandle) {
      throw new Error('No workspace opened');
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new Error('Name cannot be empty');
    }

    const lastSlashIndex = path.lastIndexOf('/');
    const oldName = lastSlashIndex === -1 ? path : path.substring(lastSlashIndex + 1);
    const parentPath = lastSlashIndex === -1 ? '' : path.substring(0, lastSlashIndex);
    const parentHandle = await getParentDirectoryHandle(state.rootHandle, path);

    let targetName = trimmedName;

    if (kind === 'file' && !targetName.includes('.')) {
      const oldDotIndex = oldName.lastIndexOf('.');
      if (oldDotIndex !== -1) {
        targetName = `${targetName}${oldName.substring(oldDotIndex)}`;
      } else {
        targetName = `${targetName}.md`;
      }
    }

    const newPath = parentPath ? `${parentPath}/${targetName}` : targetName;

    try {
      if (kind === 'file') {
        const newHandle = await fsRenameFile(parentHandle, oldName, targetName);

        const nextOpenFiles = state.openFiles.map((file) =>
          file.path === path
            ? { ...file, path: newPath, handle: newHandle }
            : file
        );

        const nextActivePath = state.activeFilePath === path ? newPath : state.activeFilePath;

        dispatch({
          type: 'SET_OPEN_FILES_AND_ACTIVE',
          payload: {
            openFiles: nextOpenFiles,
            activeFilePath: nextActivePath,
          },
        });
      } else {
        await fsRenameDirectory(parentHandle, oldName, targetName);

        const filesNeedingPathUpdate = state.openFiles.filter(
          (file) => file.path === path || file.path.startsWith(`${path}/`)
        );

        const pathToHandle = new Map<string, FileSystemFileHandle>();
        await Promise.all(
          filesNeedingPathUpdate.map(async (file) => {
            const renamedPath = `${newPath}${file.path.slice(path.length)}`;
            const newFileHandle = await getFileByPath(state.rootHandle as FileSystemDirectoryHandle, renamedPath);
            pathToHandle.set(renamedPath, newFileHandle);
          })
        );

        const nextOpenFiles = state.openFiles.map((file) => {
          if (!(file.path === path || file.path.startsWith(`${path}/`))) {
            return file;
          }

          const renamedPath = `${newPath}${file.path.slice(path.length)}`;
          const newFileHandle = pathToHandle.get(renamedPath);
          return {
            ...file,
            path: renamedPath,
            ...(newFileHandle ? { handle: newFileHandle } : {}),
          };
        });

        const nextActivePath = state.activeFilePath && (state.activeFilePath === path || state.activeFilePath.startsWith(`${path}/`))
          ? `${newPath}${state.activeFilePath.slice(path.length)}`
          : state.activeFilePath;

        dispatch({
          type: 'SET_OPEN_FILES_AND_ACTIVE',
          payload: {
            openFiles: nextOpenFiles,
            activeFilePath: nextActivePath,
          },
        });
      }

      await refreshTree();
      toast.success('Renamed successfully', { description: targetName });
      return newPath;
    } catch (error) {
      console.error('Failed to rename entry:', error);
      toast.error('Failed to rename', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [state.rootHandle, state.openFiles, state.activeFilePath, refreshTree]);

  // Set active file
  const setActiveFile = useCallback((path: string) => {
    dispatch({ type: 'SET_ACTIVE_FILE', payload: path });
  }, []);

  // Update file content (marks as dirty)
  const updateContent = useCallback((path: string, content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', payload: { path, content } });
  }, []);

  // Update settings (and persist)
  const updateSettings = useCallback(async (settings: Partial<WorkspaceSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });

    // Persist to IndexedDB
    try {
      for (const [key, value] of Object.entries(settings)) {
        await saveSetting(key, value);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  // Check if a file is dirty
  const isDirty = useCallback((path: string): boolean => {
    const file = state.openFiles.find(f => f.path === path);
    if (!file) return false;
    if (file.fileType !== 'markdown') return false;
    return file.content !== file.savedContent;
  }, [state.openFiles]);

  const value: WorkspaceContextType = {
    state,
    openWorkspace,
    restoreWorkspace,
    openFile,
    closeFile,
    saveFile,
    saveActiveFile,
    pinFile,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
    refreshTree,
    createFile,
    createDirectory,
    deleteEntry,
    renameEntry,
    setActiveFile,
    updateContent,
    updateSettings,
    isDirty,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// Custom hook to use workspace context
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}
