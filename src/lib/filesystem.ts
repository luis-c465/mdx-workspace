/**
 * File System Access Layer
 * Core filesystem operations using the File System Access API
 */

import type { FileNode } from '../types/filesystem';
import { getDirectoryHandle, saveDirectoryHandle } from './storage';

// Supported file extensions
const MARKDOWN_EXTENSIONS = ['.md'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const ALLOWED_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...IMAGE_EXTENSIONS];

const imageMimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Hidden files and directories to skip
const SKIP_PATTERNS = [
  (name: string) => name.startsWith('.'), // Hidden files
  (name: string) => name === 'node_modules', // Node modules
  (name: string) => name === '__pycache__', // Python cache
  (name: string) => name === '.git', // Git directory
];

/**
 * Open a workspace directory using the File System Access API
 * Shows the directory picker and persists the handle to IndexedDB
 */
export async function openWorkspace(): Promise<FileSystemDirectoryHandle> {
  try {
    // Request directory access with readwrite permission
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Save the handle to IndexedDB for future sessions
    await saveDirectoryHandle(handle);

    return handle;
  } catch (error) {
    // User cancelled or permission denied
    if ((error as Error).name === 'AbortError') {
      throw new Error('Directory selection was cancelled');
    }
    throw error;
  }
}

/**
 * Restore the workspace from IndexedDB
 * Re-requests permission if needed
 */
export async function restoreWorkspace(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await getDirectoryHandle();
    if (!handle) {
      return null;
    }

    // Check and request permission
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    
    if (permission === 'granted') {
      return handle;
    }

    if (permission === 'prompt') {
      const requestedPermission = await handle.requestPermission({ mode: 'readwrite' });
      if (requestedPermission === 'granted') {
        return handle;
      }
    }

    // Permission denied
    return null;
  } catch (error) {
    console.error('Failed to restore workspace:', error);
    return null;
  }
}

/**
 * Check if a file should be included based on extension
 */
function shouldIncludeFile(name: string): boolean {
  const lowerName = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * Check if a file/directory should be skipped
 */
function shouldSkip(name: string): boolean {
  return SKIP_PATTERNS.some(pattern => pattern(name));
}

function getFileExtension(path: string): string {
  const dotIndex = path.lastIndexOf('.');
  return dotIndex === -1 ? '' : path.slice(dotIndex).toLowerCase();
}

export function createImageObjectUrl(file: File, pathHint?: string): string {
  const extension = getFileExtension(pathHint ?? file.name);
  const inferredMimeType = imageMimeTypes[extension];

  if (!file.type && inferredMimeType) {
    const typedBlob = file.slice(0, file.size, inferredMimeType);
    return URL.createObjectURL(typedBlob);
  }

  return URL.createObjectURL(file);
}

async function readFrontmatterIconFromHandle(
  fileHandle: FileSystemFileHandle
): Promise<string | undefined> {
  try {
    const file = await fileHandle.getFile();
    const frontmatterPrefix = await file.slice(0, 500).text();
    return readFileIcon(frontmatterPrefix);
  } catch {
    return undefined;
  }
}

/**
 * Build a file tree from a directory handle
 * Recursively reads directory entries and filters to allowed file types
 */
export async function buildFileTree(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = ''
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  try {
    // Read all entries in the directory
    for await (const entry of dirHandle.values()) {
      // Skip hidden files and node_modules
      if (shouldSkip(entry.name)) {
        continue;
      }

      const path = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        // Recursively read subdirectories
        const dirEntry = entry as FileSystemDirectoryHandle
        const children = await buildFileTree(dirEntry, path);
        const folderIcon = await readFolderIcon(dirEntry)
        
        // Only include directories that have children or are empty but valid
        nodes.push({
          name: entry.name,
          path,
          kind: 'directory',
          handle: dirEntry,
          children,
          icon: folderIcon,
        });
      } else if (entry.kind === 'file') {
        // Only include markdown and image files
        if (shouldIncludeFile(entry.name)) {
          const fileHandle = entry as FileSystemFileHandle;
          const icon = entry.name.toLowerCase().endsWith('.md')
            ? await readFrontmatterIconFromHandle(fileHandle)
            : undefined;

          nodes.push({
            name: entry.name,
            path,
            kind: 'file',
            handle: fileHandle,
            icon,
          });
        }
      }
    }

    // Sort: directories first, then alphabetically
    nodes.sort((a, b) => {
      if (a.kind === b.kind) {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      return a.kind === 'directory' ? -1 : 1;
    });

    return nodes;
  } catch (error) {
    console.error(`Failed to build file tree for ${basePath}:`, error);
    throw error;
  }
}

/**
 * Read a file's content as text
 */
export async function readFile(fileHandle: FileSystemFileHandle): Promise<string> {
  try {
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }
}

/**
 * Write content to a file
 */
export async function writeFile(
  fileHandle: FileSystemFileHandle,
  content: string
): Promise<void> {
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    console.error('Failed to write file:', error);
    throw error;
  }
}

/**
 * Validate and sanitize a filename
 */
function sanitizeFilename(name: string): string {
  // Remove or replace invalid characters
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/^\.+/, '') // Remove leading dots
    .trim();
}

/**
 * Create a new file in a directory
 */
export async function createFile(
  dirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemFileHandle> {
  try {
    // Sanitize and ensure .md extension for markdown files
    let sanitizedName = sanitizeFilename(name);
    
    // Auto-append .md if no extension
    if (!sanitizedName.includes('.')) {
      sanitizedName += '.md';
    }

    // Validate it's a supported file type
    if (!shouldIncludeFile(sanitizedName)) {
      throw new Error(`Unsupported file type. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    // Create the file
    const fileHandle = await dirHandle.getFileHandle(sanitizedName, { create: true });
    
    // Initialize with empty content
    await writeFile(fileHandle, '');

    return fileHandle;
  } catch (error) {
    console.error('Failed to create file:', error);
    throw error;
  }
}

/**
 * Create a new directory
 */
export async function createDirectory(
  dirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  try {
    const sanitizedName = sanitizeFilename(name);
    
    if (!sanitizedName) {
      throw new Error('Invalid directory name');
    }

    return await dirHandle.getDirectoryHandle(sanitizedName, { create: true });
  } catch (error) {
    console.error('Failed to create directory:', error);
    throw error;
  }
}

/**
 * Delete a file or directory entry
 */
export async function deleteEntry(
  dirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<void> {
  try {
    // recursive: true allows deleting non-empty directories
    await dirHandle.removeEntry(name, { recursive: true });
  } catch (error) {
    console.error('Failed to delete entry:', error);
    throw error;
  }
}

async function entryExists(
  dirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await dirHandle.getFileHandle(name);
    return true;
  } catch {
    // Not a file, keep checking
  }

  try {
    await dirHandle.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function copyFileHandle(
  sourceHandle: FileSystemFileHandle,
  targetDirHandle: FileSystemDirectoryHandle,
  targetName: string
): Promise<FileSystemFileHandle> {
  const sourceFile = await sourceHandle.getFile();
  const targetHandle = await targetDirHandle.getFileHandle(targetName, { create: true });
  const writable = await targetHandle.createWritable();
  await writable.write(sourceFile);
  await writable.close();
  return targetHandle;
}

async function copyDirectoryContents(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle
): Promise<void> {
  for await (const entry of sourceDir.values()) {
    if (entry.kind === 'file') {
      await copyFileHandle(entry as FileSystemFileHandle, targetDir, entry.name);
      continue;
    }

    const sourceSubDir = entry as FileSystemDirectoryHandle;
    const targetSubDir = await targetDir.getDirectoryHandle(entry.name, { create: true });
    await copyDirectoryContents(sourceSubDir, targetSubDir);
  }
}

/**
 * Rename a file by copying contents to a new file and deleting the old one.
 */
export async function renameFile(
  dirHandle: FileSystemDirectoryHandle,
  oldName: string,
  newName: string
): Promise<FileSystemFileHandle> {
  try {
    const sanitizedName = sanitizeFilename(newName);
    if (!sanitizedName) {
      throw new Error('Invalid file name');
    }

    if (oldName === sanitizedName) {
      return await dirHandle.getFileHandle(oldName);
    }

    if (await entryExists(dirHandle, sanitizedName)) {
      throw new Error(`An item named "${sanitizedName}" already exists`);
    }

    const sourceHandle = await dirHandle.getFileHandle(oldName);
    const newHandle = await copyFileHandle(sourceHandle, dirHandle, sanitizedName);
    await deleteEntry(dirHandle, oldName);
    return newHandle;
  } catch (error) {
    console.error('Failed to rename file:', error);
    throw error;
  }
}

/**
 * Rename a directory by recursively copying it and deleting the old one.
 */
export async function renameDirectory(
  dirHandle: FileSystemDirectoryHandle,
  oldName: string,
  newName: string
): Promise<FileSystemDirectoryHandle> {
  try {
    const sanitizedName = sanitizeFilename(newName);
    if (!sanitizedName) {
      throw new Error('Invalid directory name');
    }

    if (oldName === sanitizedName) {
      return await dirHandle.getDirectoryHandle(oldName);
    }

    if (await entryExists(dirHandle, sanitizedName)) {
      throw new Error(`An item named "${sanitizedName}" already exists`);
    }

    const sourceDir = await dirHandle.getDirectoryHandle(oldName);
    const targetDir = await dirHandle.getDirectoryHandle(sanitizedName, { create: true });
    await copyDirectoryContents(sourceDir, targetDir);
    await deleteEntry(dirHandle, oldName);
    return targetDir;
  } catch (error) {
    console.error('Failed to rename directory:', error);
    throw error;
  }
}

/**
 * Move a file or directory entry to another directory.
 * This uses copy + delete because the File System Access API has no native move API.
 */
export async function moveEntry(
  rootHandle: FileSystemDirectoryHandle,
  sourcePath: string,
  targetDirPath: string
): Promise<void> {
  try {
    const normalizedSourcePath = sourcePath.trim();
    const normalizedTargetPath = targetDirPath.trim();

    if (!normalizedSourcePath) {
      throw new Error('Invalid source path');
    }

    if (normalizedSourcePath === normalizedTargetPath || normalizedTargetPath.startsWith(`${normalizedSourcePath}/`)) {
      throw new Error('Cannot move a directory into itself or one of its descendants');
    }

    const sourceParentHandle = await getParentDirectoryHandle(rootHandle, normalizedSourcePath);
    const targetDirHandle = await getDirectoryByPath(rootHandle, normalizedTargetPath);

    const lastSlashIndex = normalizedSourcePath.lastIndexOf('/');
    const sourceName = lastSlashIndex === -1 ? normalizedSourcePath : normalizedSourcePath.substring(lastSlashIndex + 1);

    if (!sourceName) {
      throw new Error('Invalid source entry name');
    }

    if (await entryExists(targetDirHandle, sourceName)) {
      throw new Error(`An item named "${sourceName}" already exists`);
    }

    try {
      const sourceFileHandle = await sourceParentHandle.getFileHandle(sourceName);
      await copyFileHandle(sourceFileHandle, targetDirHandle, sourceName);
      await deleteEntry(sourceParentHandle, sourceName);
      return;
    } catch {
      // Not a file, try as directory
    }

    const sourceDirectoryHandle = await sourceParentHandle.getDirectoryHandle(sourceName);
    const targetDirectoryHandle = await targetDirHandle.getDirectoryHandle(sourceName, { create: true });
    await copyDirectoryContents(sourceDirectoryHandle, targetDirectoryHandle);
    await deleteEntry(sourceParentHandle, sourceName);
  } catch (error) {
    console.error(`Failed to move entry from ${sourcePath} to ${targetDirPath}:`, error);
    throw error;
  }
}

/**
 * Save an image file to the assets/ directory
 * Creates the directory if it doesn't exist
 * Returns the relative path to the image
 */
export async function saveImage(
  rootHandle: FileSystemDirectoryHandle,
  file: File
): Promise<string> {
  try {
    // Ensure assets directory exists
    const assetsDir = await rootHandle.getDirectoryHandle('assets', { create: true });

    // Generate unique filename: {name}-{timestamp}.{ext}
    const timestamp = Date.now();
    const originalName = file.name;
    const lastDotIndex = originalName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 
      ? originalName.substring(0, lastDotIndex)
      : originalName;
    const ext = lastDotIndex > 0 
      ? originalName.substring(lastDotIndex)
      : '';

    // Sanitize the filename
    const sanitizedBase = sanitizeFilename(nameWithoutExt);
    const filename = `${sanitizedBase}-${timestamp}${ext}`;

    // Create the file in assets/
    const fileHandle = await assetsDir.getFileHandle(filename, { create: true });

    // Write the file bytes
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Return relative path
    return `./assets/${filename}`;
  } catch (error) {
    console.error('Failed to save image:', error);
    throw error;
  }
}

/**
 * Resolve a markdown image source path (e.g. ./assets/image.png) to a browser-loadable blob URL
 */
export async function resolveImagePreviewSrc(
  rootHandle: FileSystemDirectoryHandle,
  imageSource: string
): Promise<string> {
  try {
    const segments = imageSource
      .split('/')
      .filter(Boolean)
      .filter(segment => segment !== '.');

    if (segments.length === 0 || segments.includes('..')) {
      throw new Error(`Invalid relative image path: ${imageSource}`);
    }

    const normalizedPath = segments.join('/');
    const fileHandle = await getFileByPath(rootHandle, normalizedPath);
    const file = await fileHandle.getFile();
    return createImageObjectUrl(file, normalizedPath);
  } catch (error) {
    console.error(`Failed to resolve image preview source: ${imageSource}`, error);
    throw error;
  }
}

/**
 * Get a file handle by navigating through a path
 * Path should be relative to the root handle, e.g., "folder/subfolder/file.md"
 */
export async function getFileByPath(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemFileHandle> {
  try {
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      throw new Error('Invalid path');
    }

    // Navigate through directories
    let currentHandle: FileSystemDirectoryHandle = rootHandle;
    
    for (let i = 0; i < segments.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(segments[i]);
    }

    // Get the file handle
    const fileName = segments[segments.length - 1];
    return await currentHandle.getFileHandle(fileName);
  } catch (error) {
    console.error(`Failed to get file by path: ${path}`, error);
    throw error;
  }
}

/**
 * Get a directory handle by navigating through a path
 * Path should be relative to the root handle, e.g., "folder/subfolder"
 */
export async function getDirectoryByPath(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> {
  try {
    if (!path || path === '/' || path === '.') {
      return rootHandle;
    }

    const segments = path.split('/').filter(Boolean);
    let currentHandle: FileSystemDirectoryHandle = rootHandle;
    
    for (const segment of segments) {
      currentHandle = await currentHandle.getDirectoryHandle(segment);
    }

    return currentHandle;
  } catch (error) {
    console.error(`Failed to get directory by path: ${path}`, error);
    throw error;
  }
}

/**
 * Get the parent directory handle for a given path
 * Returns the root handle if the path is at the root level
 */
export async function getParentDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> {
  const lastSlashIndex = path.lastIndexOf('/');
  
  if (lastSlashIndex === -1) {
    // Root level item
    return rootHandle;
  }

  const parentPath = path.substring(0, lastSlashIndex);
  return getDirectoryByPath(rootHandle, parentPath);
}


/**
 * Extract the icon emoji from YAML front-matter
 * Simple regex-based extraction without a full YAML parser
 */
export function readFileIcon(content: string): string | undefined {
  try {
    // Match YAML front-matter block
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      return undefined;
    }

    const frontmatter = frontmatterMatch[1];
    
    // Extract icon field (supports both "icon: emoji" and "icon: 'emoji'" formats)
    const iconMatch = frontmatter.match(/^icon:\s*['"]?([^\s'"]+)['"]?\s*$/m);
    
    if (!iconMatch) {
      return undefined;
    }

    return iconMatch[1];
  } catch (error) {
    console.error('Failed to extract icon from front-matter:', error);
    return undefined;
  }
}

/**
 * Read the custom icon for a folder from its hidden `.foldericon` file.
 * Returns the emoji string, or undefined if no icon is set.
 */
export async function readFolderIcon(
  dirHandle: FileSystemDirectoryHandle
): Promise<string | undefined> {
  try {
    const fileHandle = await dirHandle.getFileHandle('.foldericon')
    const file = await fileHandle.getFile()
    const text = (await file.text()).trim()
    return text || undefined
  } catch {
    // File doesn't exist or can't be read — no custom icon
    return undefined
  }
}

/**
 * Write or remove the custom icon for a folder via a hidden `.foldericon` file.
 * Pass an empty string or undefined to remove the icon.
 */
export async function updateFolderIcon(
  dirHandle: FileSystemDirectoryHandle,
  icon: string | undefined
): Promise<void> {
  try {
    if (!icon) {
      // Remove the icon file if it exists
      try {
        await dirHandle.removeEntry('.foldericon')
      } catch {
        // File didn't exist — nothing to do
      }
      return
    }

    const fileHandle = await dirHandle.getFileHandle('.foldericon', { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(icon)
    await writable.close()
  } catch (error) {
    console.error('Failed to update folder icon:', error)
    throw error
  }
}

/**
 * Update or add an icon to a file's YAML front-matter
 */
export function updateFileIcon(content: string, icon: string): string {
  // Check if front-matter exists
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    // No front-matter, create one
    return `---\nicon: ${icon}\n---\n\n${content}`;
  }

  const frontmatter = frontmatterMatch[1];
  const iconMatch = frontmatter.match(/^icon:\s*['"]?([^\s'"]+)['"]?\s*$/m);
  
  if (iconMatch) {
    // Update existing icon
    const updatedFrontmatter = frontmatter.replace(
      /^icon:\s*['"]?[^\s'"]+['"]?\s*$/m,
      `icon: ${icon}`
    );
    return content.replace(
      /^---\n[\s\S]*?\n---/,
      `---\n${updatedFrontmatter}\n---`
    );
  } else {
    // Add icon to existing front-matter
    const updatedFrontmatter = `${frontmatter}\nicon: ${icon}`;
    return content.replace(
      /^---\n[\s\S]*?\n---/,
      `---\n${updatedFrontmatter}\n---`
    );
  }
}
