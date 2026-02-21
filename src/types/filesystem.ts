/**
 * File System Access API Type Definitions
 * Types for the workspace file tree and filesystem operations
 */

export interface FileNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileNode[];
  icon?: string;
}

export interface WorkspaceState {
  rootHandle: FileSystemDirectoryHandle;
  tree: FileNode[];
}
