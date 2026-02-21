import MiniSearch from 'minisearch';

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  path: string;
  icon?: string;
}

export interface SearchResult {
  id: string;
  path: string;
  title: string;
  icon?: string;
  score: number;
  match?: {
    [field: string]: string[];
  };
  terms: string[];
}

// Initialize MiniSearch instance
let miniSearchInstance: MiniSearch<SearchDocument> | null = null;

function getMiniSearchInstance(): MiniSearch<SearchDocument> {
  if (!miniSearchInstance) {
    miniSearchInstance = new MiniSearch<SearchDocument>({
      fields: ['title', 'content', 'path'],
      storeFields: ['title', 'path', 'icon'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 2 },
      },
    });
  }
  return miniSearchInstance;
}

/**
 * Build the complete search index from an array of documents
 * Clears any existing index and rebuilds from scratch
 */
export function buildIndex(files: SearchDocument[]): void {
  const index = getMiniSearchInstance();
  
  // Remove all existing documents by discarding them one by one
  if (index.documentCount > 0) {
    // Get all document IDs and remove them
    const allDocs = index.search('', { boost: {}, fuzzy: 0 });
    allDocs.forEach(doc => {
      if (index.has(doc.id)) {
        index.discard(doc.id);
      }
    });
  }
  
  // Add all documents to the index
  if (files.length > 0) {
    index.addAll(files);
  }
}

/**
 * Add a single document to the index
 */
export function addToIndex(doc: SearchDocument): void {
  const index = getMiniSearchInstance();
  
  // Remove if already exists (to avoid duplicates)
  if (index.has(doc.id)) {
    index.discard(doc.id);
  }
  
  index.add(doc);
}

/**
 * Remove a document from the index by ID
 */
export function removeFromIndex(id: string): void {
  const index = getMiniSearchInstance();
  
  if (index.has(id)) {
    index.discard(id);
  }
}

/**
 * Update a document in the index
 * This is equivalent to removing and re-adding
 */
export function updateInIndex(doc: SearchDocument): void {
  const index = getMiniSearchInstance();
  
  if (index.has(doc.id)) {
    index.discard(doc.id);
  }
  
  index.add(doc);
}

/**
 * Search the index with a query string
 * Returns ranked results with context snippets
 */
export function search(query: string): SearchResult[] {
  if (!query.trim()) {
    return [];
  }
  
  const index = getMiniSearchInstance();
  
  if (index.documentCount === 0) {
    return [];
  }
  
  try {
    const results = index.search(query, {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 2 },
    });
    
    return results.map(result => ({
      id: result.id,
      path: result.path,
      title: result.title,
      icon: result.icon,
      score: result.score,
      match: result.match,
      terms: result.terms,
    }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Get the number of documents in the index
 */
export function getIndexSize(): number {
  const index = getMiniSearchInstance();
  return index.documentCount;
}

/**
 * Clear the entire index
 */
export function clearIndex(): void {
  if (miniSearchInstance && miniSearchInstance.documentCount > 0) {
    // Get all documents and discard them
    const allDocs = miniSearchInstance.search('', { boost: {}, fuzzy: 0 });
    allDocs.forEach(doc => {
      if (miniSearchInstance?.has(doc.id)) {
        miniSearchInstance.discard(doc.id);
      }
    });
  }
}

/**
 * Extract context snippet around a match
 * Shows ~50 chars before and after the match
 */
export function extractContextSnippet(
  content: string,
  searchTerms: string[],
  maxLength: number = 100
): string {
  if (!content || searchTerms.length === 0) {
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }
  
  // Find the first occurrence of any search term (case-insensitive)
  let matchIndex = -1;
  let matchLength = 0;
  
  for (const term of searchTerms) {
    const index = content.toLowerCase().indexOf(term.toLowerCase());
    if (index !== -1 && (matchIndex === -1 || index < matchIndex)) {
      matchIndex = index;
      matchLength = term.length;
    }
  }
  
  if (matchIndex === -1) {
    // No match found, return beginning of content
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }
  
  // Calculate snippet boundaries (50 chars before and after)
  const beforeContext = 50;
  const afterContext = 50;
  
  const start = Math.max(0, matchIndex - beforeContext);
  const end = Math.min(content.length, matchIndex + matchLength + afterContext);
  
  let snippet = content.slice(start, end);
  
  // Add ellipsis if we're not at the start/end
  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < content.length) {
    snippet = snippet + '...';
  }
  
  return snippet;
}
