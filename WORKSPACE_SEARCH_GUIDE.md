# Workspace Search - Quick Reference

## Overview
Full-text search across all markdown files in your workspace, powered by MiniSearch with fuzzy matching and intelligent ranking.

## How to Use

### Opening Search
**Keyboard**: `Ctrl+Shift+F` (Windows/Linux) or `Cmd+Shift+F` (Mac)
**Mouse**: Click the Search icon (🔍) in the header

### Searching
1. Type your query in the search box
2. Results appear after 200ms (debounced for performance)
3. Results are ranked by relevance (title matches ranked higher)

### Opening Files
- **Click** any result to open the file in the editor
- The search panel closes automatically after opening

### Closing Search
- Press `Escape`
- Press `Ctrl/Cmd+Shift+F` again
- Click outside the panel

## Search Features

### Fuzzy Matching
The search tolerates typos up to ~20% character difference:
- "workspce" → finds "workspace"
- "mdxeditor" → finds "mdx-editor"
- "docment" → finds "document"

### Prefix Matching
Search matches word prefixes automatically:
- "mark" → finds "markdown", "markup", "marker"
- "comp" → finds "component", "complete", "complex"

### Title Boosting
Matches in file titles are ranked 2x higher than content matches, helping you find files by name quickly.

### Context Snippets
Each result shows ~50 characters before and after the match, so you can see the context without opening the file.

## Search Results Display

Each result shows:
- **Icon**: Emoji (if set) or default file icon
- **Title**: First heading or filename
- **Filename**: Actual file name
- **Path**: Directory location
- **Snippet**: Context around the match
- **Terms**: Matched search terms

## Status Bar

The status bar shows:
- **Indexing**: "Indexing files..." with spinner
- **Ready**: "X files indexed"
- **Results**: "Y results" (when searching)

## How Indexing Works

### Automatic Indexing
The search index is automatically built when you:
1. Open a workspace
2. Refresh the file tree

### What Gets Indexed
- **Files**: All `.md` (markdown) files
- **Fields**: File title, full content, and path
- **Metadata**: Emoji icons from YAML front-matter

### Title Extraction
The search tries to find a meaningful title:
1. **First choice**: First `# Heading` in the file
2. **Fallback**: Filename (without .md extension)

### Icon Extraction
If a file has YAML front-matter with an `icon` field, it's displayed:
```yaml
---
icon: 📝
title: My Document
---
```

## Performance

- **Index Build**: Fast, typically < 500ms for 100 files
- **Search Speed**: Near-instant (< 50ms)
- **Debounce**: 200ms delay prevents excessive queries
- **Memory**: File content cached for fast snippet extraction

## Tips & Tricks

### Finding Files by Name
Since titles are boosted, you can quickly find files by typing part of their name:
- "plan" → finds PLAN.md, planning.md, etc.
- "readme" → finds README.md

### Multiple Terms
Searches with multiple words find files containing all terms:
- "workspace search" → finds files with both "workspace" and "search"

### Short Queries
Even 2-3 characters can produce useful results thanks to prefix matching:
- "md" → finds "markdown", "mdx", "mdxeditor"

### Refining Results
If you get too many results, add more specific terms:
- "search" → 50 results
- "search workspace" → 10 results
- "search workspace index" → 2 results

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+Shift+F` | Open/close search panel |
| `Escape` | Close panel |
| `Enter` (on result) | Open file |
| `Space` (on result) | Open file |

## Empty States

### "Start typing to search..."
No query entered yet. Type something to see results.

### "No results found for 'query'"
Your query didn't match any files. Try:
- Checking for typos (fuzzy matching helps, but isn't perfect)
- Using fewer/different search terms
- Searching for content you know exists

### "0 files indexed"
No markdown files found in workspace, or indexing failed. Try:
- Checking if workspace has .md files
- Refreshing the file tree
- Opening a different workspace

## Integration with Workspace

### Real-time Updates
Currently, the index updates when you:
- Open a workspace
- Refresh the file tree
- Switch workspaces

Future enhancement will update on:
- File save
- File create
- File delete

### File Opening
When you open a file from search:
1. The file is loaded from disk
2. It opens in the editor
3. The search panel closes
4. The file appears in the tab bar

## Troubleshooting

### Search not finding expected results
1. Check if the file is a `.md` file (other formats not indexed)
2. Verify the content is actually in the file
3. Try refreshing the file tree
4. Try a simpler query (fewer/shorter terms)

### "Indexing..." never completes
1. Check console for errors (F12 → Console)
2. Try refreshing the page
3. Try a smaller workspace first
4. Report issue if persists

### Keyboard shortcut not working
1. Make sure focus is not in an input field
2. Try clicking outside any inputs first
3. Check if browser is overriding the shortcut
4. Use the header search icon as alternative

### Results not updating after file changes
This is expected behavior. The index updates on:
- Workspace open
- Tree refresh (manual)

To see latest content:
- Click the refresh button in sidebar
- Or wait for future enhancement (auto-update on save)

## Future Enhancements

Planned improvements:
- Keyboard navigation (↑/↓) through results
- Highlight matching terms in snippets
- Search history
- Filter by file type
- Sort options (relevance, name, date)
- Search and replace across workspace
- Jump to specific line in file

## Technical Details

For developers extending this feature:

### Hook Usage
```typescript
import { useWorkspaceSearch } from '~/hooks/useWorkspaceSearch';

const {
  search,           // (query: string) => void
  searchResults,    // SearchResultWithSnippet[]
  isSearching,      // boolean
  isIndexing,       // boolean
  indexSize,        // number
  rebuildIndex,     // () => void
  clearSearch,      // () => void
} = useWorkspaceSearch();
```

### Manual Indexing
```typescript
// Add/update file
await indexFile(path, fileHandle);

// Remove file
unindexFile(path);

// Full rebuild
await rebuildIndex();
```

### Search Index
Located at `src/lib/searchIndex.ts`:
```typescript
import {
  buildIndex,
  addToIndex,
  removeFromIndex,
  updateInIndex,
  search,
  extractContextSnippet,
} from '~/lib/searchIndex';
```

## Support

For issues or questions:
1. Check this guide
2. Check STEP_12_SUMMARY.md for implementation details
3. Check STEP_12_VERIFICATION.md for testing checklist
4. Report bugs via the issue tracker
