/**
 * Workspace State Type Definitions
 * Types for managing open files, tabs, and workspace settings
 */

export interface OpenFile {
  /** File path relative to workspace root */
  path: string;
  /** File system handle */
  handle: FileSystemFileHandle;
  /** Current editor content (may be unsaved) */
  content: string;
  /** Last content read from / written to disk (for diff mode) */
  savedContent: string;
  /** File type for editor/preview rendering */
  fileType: 'markdown' | 'image' | 'unknown';
  /** Last timestamp this tab was focused/opened (for LRU tab eviction) */
  lastAccessedAt: number;
  /** Optional emoji icon from front-matter */
  icon?: string;
  /** Pinned tabs are excluded from automatic tab eviction */
  isPinned?: boolean;
}

export interface WorkspaceSettings {
  /** Enable auto-save */
  autoSave: boolean;
  /** Delay in milliseconds before triggering auto-save */
  autoSaveDelay: number;
  /** Show a notification after saving a file */
  autoSaveNotify: boolean;
  /** Theme preference (handled by ThemeContext, stored here for persistence) */
  theme: 'light' | 'dark' | 'system';
  /** Maximum number of open tabs (0 means unlimited) */
  maxOpenTabs: number;
}

export interface WorkspaceState {
  /** Root workspace directory handle */
  rootHandle: FileSystemDirectoryHandle | null;
  /** File tree structure */
  fileTree: import('./filesystem').FileNode[];
  /** Currently open files/tabs */
  openFiles: OpenFile[];
  /** Path of the currently active file (shown in editor) */
  activeFilePath: string | null;
  /** User settings */
  settings: WorkspaceSettings;
  /** Loading state (e.g., building tree, opening workspace) */
  isLoading: boolean;
}
