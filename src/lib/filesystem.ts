/**
 * File System Access Layer
 * Core filesystem operations using the File System Access API
 */

import type { FileNode } from '../types/filesystem';
import { getDirectoryHandle, saveDirectoryHandle } from './storage';

// Supported file extensions
const MARKDOWN_EXTENSIONS = ['.md'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
const ALLOWED_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...IMAGE_EXTENSIONS];

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
        const children = await buildFileTree(entry as FileSystemDirectoryHandle, path);
        
        // Only include directories that have children or are empty but valid
        nodes.push({
          name: entry.name,
          path,
          kind: 'directory',
          handle: entry as FileSystemDirectoryHandle,
          children,
        });
      } else if (entry.kind === 'file') {
        // Only include markdown and image files
        if (shouldIncludeFile(entry.name)) {
          nodes.push({
            name: entry.name,
            path,
            kind: 'file',
            handle: entry as FileSystemFileHandle,
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
