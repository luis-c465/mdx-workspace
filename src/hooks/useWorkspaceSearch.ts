import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import {
  buildIndex,
  addToIndex,
  removeFromIndex,
  updateInIndex,
  search as searchIndex,
  getIndexSize,
  extractContextSnippet,
  type SearchDocument,
  type SearchResult,
} from '~/lib/searchIndex';
import { readFile } from '~/lib/filesystem';

export interface SearchResultWithSnippet extends SearchResult {
  snippet: string;
}

/**
 * Extract title from markdown content
 * Returns the first # heading or the filename as fallback
 */
function extractTitle(content: string, filename: string): string {
  // Try to find first heading (# Title)
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // Fallback to filename without extension
  return filename.replace(/\.md$/, '');
}

/**
 * Parse YAML front-matter to extract icon
 */
function extractIcon(content: string): string | undefined {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return undefined;
  
  const frontmatter = frontmatterMatch[1];
  const iconMatch = frontmatter.match(/icon:\s*['"]?([^'"}\n]+)['"]?/);
  
  return iconMatch ? iconMatch[1].trim() : undefined;
}

/**
 * Hook for managing the workspace search index
 */
export function useWorkspaceSearch() {
  const { state } = useWorkspace();
  const { fileTree, rootHandle } = state;
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexSize, setIndexSize] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultWithSnippet[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const indexedPathsRef = useRef<Set<string>>(new Set());
  const contentCacheRef = useRef<Map<string, string>>(new Map());

  /**
   * Build the complete index from all markdown files in the workspace
   */
  const rebuildIndex = useCallback(async () => {
    if (!rootHandle || !fileTree || fileTree.length === 0) {
      setIndexSize(0);
      indexedPathsRef.current.clear();
      return;
    }

    setIsIndexing(true);
    
    try {
      const documents: SearchDocument[] = [];
      const indexedPaths = new Set<string>();

      // Recursively collect all .md files
      const collectFiles = async (nodes: typeof fileTree, parentPath = ''): Promise<void> => {
        for (const node of nodes) {
          const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
          
          if (node.kind === 'file' && node.name.endsWith('.md')) {
            try {
              const content = await readFile(node.handle as FileSystemFileHandle);
              const title = extractTitle(content, node.name);
              const icon = node.icon || extractIcon(content);
              
              documents.push({
                id: fullPath,
                title,
                content,
                path: fullPath,
                icon,
              });
              
              // Cache content for snippet extraction
              contentCacheRef.current.set(fullPath, content);
              indexedPaths.add(fullPath);
            } catch (error) {
              console.error(`Failed to read file ${fullPath}:`, error);
            }
          } else if (node.kind === 'directory' && node.children) {
            await collectFiles(node.children, fullPath);
          }
        }
      };

      await collectFiles(fileTree);
      
      // Build the index with all documents
      buildIndex(documents);
      
      indexedPathsRef.current = indexedPaths;
      setIndexSize(getIndexSize());
    } catch (error) {
      console.error('Failed to build search index:', error);
    } finally {
      setIsIndexing(false);
    }
  }, [rootHandle, fileTree]);

  /**
   * Add or update a file in the index
   */
  const indexFile = useCallback(async (path: string, handle: FileSystemFileHandle) => {
    try {
      const content = await readFile(handle);
      const filename = path.split('/').pop() || path;
      const title = extractTitle(content, filename);
      const icon = extractIcon(content);
      
      const document: SearchDocument = {
        id: path,
        title,
        content,
        path,
        icon,
      };
      
      // Cache content for snippet extraction
      contentCacheRef.current.set(path, content);
      
      if (indexedPathsRef.current.has(path)) {
        updateInIndex(document);
      } else {
        addToIndex(document);
        indexedPathsRef.current.add(path);
      }
      
      setIndexSize(getIndexSize());
    } catch (error) {
      console.error(`Failed to index file ${path}:`, error);
    }
  }, []);

  /**
   * Remove a file from the index
   */
  const unindexFile = useCallback((path: string) => {
    removeFromIndex(path);
    indexedPathsRef.current.delete(path);
    contentCacheRef.current.delete(path);
    setIndexSize(getIndexSize());
  }, []);

  /**
   * Perform a search query
   */
  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const results = searchIndex(query);
      
      // Add context snippets to results
      const resultsWithSnippets: SearchResultWithSnippet[] = results.map(result => {
        // Get cached content for this file
        const cachedContent = contentCacheRef.current.get(result.path);
        
        // Extract snippet from content or title
        const snippet = cachedContent
          ? extractContextSnippet(cachedContent, result.terms, 100)
          : extractContextSnippet(result.title, result.terms, 100);
        
        return {
          ...result,
          snippet,
        };
      });
      
      setSearchResults(resultsWithSnippets);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  // Rebuild index when workspace changes
  useEffect(() => {
    if (rootHandle && fileTree && fileTree.length > 0) {
      rebuildIndex();
    }
  }, [rootHandle, fileTree, rebuildIndex]);

  return {
    isIndexing,
    indexSize,
    searchResults,
    isSearching,
    search,
    clearSearch,
    rebuildIndex,
    indexFile,
    unindexFile,
  };
}
