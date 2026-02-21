/**
 * IndexedDB Storage Layer using idb-keyval
 * Persists FileSystemDirectoryHandle and app settings
 */

import { createStore, del, get, set } from 'idb-keyval';

// Create a custom IndexedDB store for the MDX Workspace
const mdxWorkspaceStore = createStore('mdx-workspace-store', 'mdx-workspace-keyval');

// Key constants
const DIRECTORY_HANDLE_KEY = 'workspace-directory-handle';

/**
 * Save the workspace directory handle to IndexedDB
 */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(DIRECTORY_HANDLE_KEY, handle, mdxWorkspaceStore);
}

/**
 * Retrieve the workspace directory handle from IndexedDB
 */
export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return await get<FileSystemDirectoryHandle>(DIRECTORY_HANDLE_KEY, mdxWorkspaceStore);
}

/**
 * Clear the saved directory handle (e.g., when user closes workspace)
 */
export async function clearDirectoryHandle(): Promise<void> {
  await del(DIRECTORY_HANDLE_KEY, mdxWorkspaceStore);
}

/**
 * Save an app setting to IndexedDB
 */
export async function saveSetting(key: string, value: any): Promise<void> {
  await set(`setting-${key}`, value, mdxWorkspaceStore);
}

/**
 * Retrieve an app setting from IndexedDB
 */
export async function getSetting<T = any>(key: string): Promise<T | undefined> {
  return await get<T>(`setting-${key}`, mdxWorkspaceStore);
}

/**
 * Delete a specific setting from IndexedDB
 */
export async function deleteSetting(key: string): Promise<void> {
  await del(`setting-${key}`, mdxWorkspaceStore);
}
