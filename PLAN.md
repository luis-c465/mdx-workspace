# MDX Workspace — Architecture & Execution Plan

---

## Section 1: High-Level Overview

### 1.1 — Goal Statement

Build **MDX Workspace**, a Progressive Web App that provides a VS Code-like environment for editing Markdown documents stored on the user's local filesystem. The app uses `@mdxeditor/editor` as its WYSIWYG core with all major plugins enabled, a file explorer sidebar, auto-save, dark mode, full-text search across the workspace, and complete offline capability via PWA caching.

### 1.2 — Approach Summary

**Architecture:** Single-page React application with a three-panel layout: a collapsible file explorer sidebar (left), the MDX editor (center), and contextual panels (search, settings) as overlays/drawers. State management uses React Context + `useReducer` for workspace state (open files, active file, settings) — no external state library needed given the scope.

**Filesystem Access:** The [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) (`window.showDirectoryPicker()`) provides direct read/write access to the user's local directory. This is a Chromium-only API but aligns perfectly with a PWA that needs true filesystem access. The app will store the `FileSystemDirectoryHandle` in IndexedDB (via `idb-keyval`) so users can re-open their workspace without re-picking.

**Editor:** `@mdxeditor/editor` with the following plugins: `headingsPlugin`, `listsPlugin`, `quotePlugin`, `thematicBreakPlugin`, `linkPlugin`, `linkDialogPlugin`, `imagePlugin` (with custom upload handler writing to `assets/`), `tablePlugin`, `codeBlockPlugin`, `codeMirrorPlugin`, `directivesPlugin` (with `AdmonitionDirectiveDescriptor`), `diffSourcePlugin`, `markdownShortcutPlugin`, `frontmatterPlugin`, `toolbarPlugin`. The custom search & replace plugin is ported from `/home/luis/dev/search-plugin-example`.

**Full-Text Search:** `MiniSearch` — a tiny (~7KB gzipped), zero-dependency, in-memory full-text search engine. It indexes all markdown file contents and filenames, supports fuzzy matching, prefix search, and ranking. The index is rebuilt on workspace open and incrementally updated on file save/create/delete.

**PWA:** `vite-plugin-pwa` with `generateSW` strategy, caching all static assets. The app is fully offline-capable after first load since all data lives on the local filesystem.

**Dark Mode:** CSS class-based toggling (`dark` class on `<html>`), leveraging the existing shadcn dark mode CSS variables already defined in `index.css`. The mdx-editor supports dark theming via the `dark-theme` CSS class.

**UI Components:** shadcn/ui components (already configured) for all UI chrome — sidebar, dialogs, buttons, inputs, dropdowns, toasts, etc.

### 1.3 — Decisions Log

- **Decision:** Use File System Access API for filesystem operations
  - **Alternatives considered:** (a) In-memory only with download/upload, (b) Origin Private File System (OPFS), (c) File System Access API
  - **Rationale:** OPFS doesn't give access to real user files. In-memory-only defeats the "workspace" concept. File System Access API provides true read/write to user-chosen directories, persists handles across sessions, and is supported in Chrome/Edge (the primary PWA targets).

- **Decision:** Use `MiniSearch` for full-text search
  - **Alternatives considered:** (a) Lunr.js, (b) Fuse.js, (c) MiniSearch
  - **Rationale:** MiniSearch is the smallest (~7KB), supports fuzzy/prefix search, has zero dependencies, and is actively maintained. Fuse.js is fuzzy-only (no true full-text indexing). Lunr.js is larger and less actively maintained.

- **Decision:** Use `vite-plugin-pwa` with `generateSW` strategy
  - **Alternatives considered:** (a) Manual service worker, (b) `injectManifest` strategy, (c) `generateSW` strategy
  - **Rationale:** `generateSW` requires zero custom service worker code and handles precaching of all build assets automatically. Since the app has no API calls (everything is local filesystem), there's no need for custom runtime caching strategies.

- **Decision:** Use React Context + `useReducer` for state management
  - **Alternatives considered:** (a) Zustand, (b) Jotai, (c) React Context
  - **Rationale:** The state shape is simple (open files, active file, settings). No need for an external library. Context avoids adding dependencies and is sufficient for this app's complexity.

- **Decision:** Port the custom search plugin from the example project rather than using mdx-editor's built-in
  - **Alternatives considered:** Using mdx-editor's built-in `searchPlugin` if available
  - **Rationale:** The user explicitly pointed to the custom search plugin example at `/home/luis/dev/search-plugin-example`. This implementation uses the CSS Custom Highlight API for performant highlighting and includes replace/replace-all functionality. It's a more complete solution.

- **Decision:** Store file icon/emoji metadata in YAML front-matter of each markdown file
  - **Alternatives considered:** (a) Separate JSON metadata file, (b) Front-matter in each file, (c) IndexedDB metadata store
  - **Rationale:** Front-matter keeps metadata co-located with the file, is portable (moves with the file), and the editor already supports `frontmatterPlugin`. A separate metadata file would need syncing logic. IndexedDB would lose data if the user clears browser storage.

- **Decision:** Use `idb-keyval` for persisting the directory handle and app settings
  - **Alternatives considered:** (a) localStorage, (b) Raw IndexedDB, (c) `idb-keyval`
  - **Rationale:** `FileSystemDirectoryHandle` is a structured-cloneable object that cannot be stored in localStorage. `idb-keyval` is a tiny (~600B) wrapper around IndexedDB that makes key-value storage trivial.

### 1.4 — Assumptions & Open Questions

**Assumptions:**
- The app targets Chromium-based browsers (Chrome, Edge) since the File System Access API is not supported in Firefox/Safari. This is acceptable for a PWA that will be "installed."
- The `site/` directory in the repo is the mdx-editor documentation site and is NOT part of the application build. It should be excluded or ignored.
- The user wants `.md` files only (not `.mdx`) based on the requirement description saying "markdown documents." The editor will still use mdx-editor but will read/write `.md` files.
- Images pasted into the editor should be saved to an `assets/` folder at the root of the opened workspace directory, not the project's `src/assets/`.
- The emoji icon feature stores the chosen emoji in the file's YAML front-matter (e.g., `icon: 📝`), which the file tree reads and displays.
- "Diff mode showing the difference between what is on the file system vs what is being edited currently" means the `diffSourcePlugin`'s `diffMarkdown` should be set to the last-saved version of the file from disk.

**Open Questions (non-blocking):**
- Should the app support opening multiple workspaces simultaneously, or just one at a time? (Plan assumes one at a time.)
- Should deleted files go to a "trash" or be permanently deleted? (Plan assumes permanent delete with a confirmation dialog.)

### 1.5 — Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| File System Access API permission revoked between sessions | Medium | Medium | Detect permission loss on app load, prompt user to re-grant or re-pick directory. Store handle in IndexedDB and use `queryPermission()`/`requestPermission()` on startup. |
| Large workspace with thousands of files causes slow tree rendering | Low | Medium | Virtualize the file tree with lazy loading. Only expand directories on demand. Debounce search filtering. |
| MiniSearch index becomes stale after external file changes | Medium | Low | Provide a manual "refresh" button that re-reads the filesystem and rebuilds the index. Auto-refresh on window focus. |
| mdx-editor version incompatibility with custom search plugin | Low | High | Pin `@mdxeditor/editor` version. The search plugin uses stable internal APIs (`realmPlugin`, `Cell`, `rootEditor$`). Test thoroughly after any editor upgrade. |
| Browser doesn't support CSS Custom Highlight API (needed by search plugin) | Low | Medium | The search plugin already has a feature check (`typeof CSS.highlights !== "undefined"`). Gracefully degrade — search will simply not highlight matches in unsupported browsers. |
| Auto-save writes corrupt/partial data on crash | Low | Medium | Write the full content atomically via `FileSystemWritableFileStream`. The API handles this safely. |
| PWA service worker caches stale app version | Low | Low | Use `registerType: 'autoUpdate'` in vite-plugin-pwa to auto-update the service worker. Show a toast when a new version is available. |

### 1.6 — Step Sequence Overview

1. **Project cleanup & dependency installation** — Remove boilerplate, install all required packages
2. **App shell & layout** — Create the main three-panel layout with sidebar, editor area, and header
3. **Dark mode system** — Implement theme toggling with persistence
4. **File System Access layer** — Build the filesystem abstraction (open directory, read/write files, CRUD operations)
5. **Workspace state management** — Create React context for workspace state (file tree, open tabs, active file, settings)
6. **File explorer sidebar** — Build the tree view with create/delete/rename/search/refresh/emoji-icon features
7. **MDX Editor integration** — Configure the editor with all plugins, toolbar, and wire to filesystem
8. **Image upload handler** — Implement paste/drop image handling that saves to workspace `assets/` folder
9. **Diff/Source mode with filesystem diffing** — Wire diffSourcePlugin to show disk vs. editor differences
10. **Search & Replace plugin** — Port the custom search plugin from the example project
11. **Auto-save system** — Implement debounced auto-save with toggle
12. **Full-text workspace search** — Build MiniSearch-powered cross-file search with results panel
13. **PWA configuration** — Set up vite-plugin-pwa, manifest, icons, service worker, offline caching
14. **Polish & integration testing** — Final styling, edge case handling, keyboard shortcuts, responsive behavior

---

## Section 2: Step-by-Step Execution Plan

---

### Step 1: Project Cleanup & Dependency Installation

**Objective:** Remove Vite boilerplate code and install all required dependencies for the project.

**Context:**
- The project is a fresh Vite + React + Tailwind + shadcn setup with only a `Button` component
- `App.tsx` and `App.css` contain default Vite boilerplate that must be replaced
- No prior steps

**Scope:**
- Files to modify: `package.json`, `src/App.tsx`, `src/App.css`, `src/main.tsx`, `index.html`, `tsconfig.app.json`
- Files to delete: `src/assets/react.svg`, `public/vite.svg`

**Sub-tasks:**

1. Install production dependencies:
   - `@mdxeditor/editor` (the WYSIWYG editor)
   - `@mdxeditor/gurx` (peer dependency for the search plugin's Cell/realm imports — check if it's re-exported from `@mdxeditor/editor` first; the search example imports from `@mdxeditor/gurx` directly)
   - `minisearch` (full-text search engine)
   - `idb-keyval` (IndexedDB key-value store for persisting directory handles and settings)
   - `@codemirror/lang-javascript`, `@codemirror/lang-css`, `@codemirror/lang-html`, `@codemirror/lang-markdown`, `@codemirror/lang-json`, `@codemirror/lang-python`, `@codemirror/lang-xml` (CodeMirror language support for code blocks — check which are needed by `codeMirrorPlugin`)

2. Install dev dependencies:
   - `vite-plugin-pwa` (PWA support)

3. Install required shadcn components that will be needed throughout the project. Run `npx shadcn@latest add` for each:
   - `input` (search bars, file name inputs)
   - `dialog` (confirmation dialogs, settings)
   - `dropdown-menu` (context menus on files)
   - `tooltip` (toolbar tooltips)
   - `separator` (visual separators)
   - `switch` (auto-save toggle, dark mode toggle)
   - `scroll-area` (scrollable file tree and editor)
   - `sheet` (mobile sidebar)
   - `tabs` (open file tabs)
   - `popover` (emoji picker, settings popover)
   - `collapsible` (file tree folders)
   - `toast` / `sonner` (notifications for save, errors)
   - `command` (command palette for file search — Cmd+P style)
   - `badge` (file status indicators)
   - `context-menu` (right-click on files)
   - `sidebar` (shadcn sidebar component)
   - `resizable` (resizable panels)

4. Delete boilerplate files: `src/assets/react.svg`, `public/vite.svg`

5. Clear `src/App.css` — it will be replaced with app-specific styles (or delete it entirely and use Tailwind only)

6. Replace `src/App.tsx` with a minimal shell that just renders a placeholder `<div>MDX Workspace</div>`

7. Update `index.html`:
   - Change `<title>` to "MDX Workspace"
   - Remove the vite.svg favicon link (will be replaced with proper PWA icons later)
   - Add `<meta name="theme-color" content="#0a0a0a">` for PWA

8. Update `tsconfig.app.json` to add `"vite-plugin-pwa/client"` to the `types` array (needed for `virtual:pwa-register` imports)

**Edge Cases & Gotchas:**
- `@mdxeditor/gurx` may or may not need to be installed separately. The search plugin example imports `Cell` and `debounceTime` from `@mdxeditor/gurx` directly. Check if `@mdxeditor/editor` re-exports these. If it does, adjust imports accordingly. If not, install `@mdxeditor/gurx` as a dependency.
- The `codeMirrorPlugin` requires specific CodeMirror language packages. Check the mdx-editor docs/source to see which are bundled vs. which need explicit installation.
- The `babel-plugin-react-compiler` is already configured in `vite.config.ts`. Ensure it doesn't conflict with mdx-editor's Lexical-based internals. If issues arise, it may need to be configured to exclude mdx-editor components.

**Verification:**
- `npm install` (or `bun install`) completes without errors
- `npm run dev` starts the dev server and shows the placeholder app
- No TypeScript errors in the IDE

**Depends On:** None
**Blocks:** All subsequent steps

---

### Step 2: App Shell & Layout

**Objective:** Create the main application layout with a resizable sidebar, tab bar, editor area, and header/toolbar region.

**Context:**
- Step 1 has installed all dependencies and cleaned up boilerplate
- The layout should resemble VS Code: collapsible left sidebar (file explorer), top tab bar (open files), main editor area, and a top toolbar

**Scope:**
- Files to create:
  - `src/components/layout/AppLayout.tsx` — The root layout component
  - `src/components/layout/Sidebar.tsx` — Left sidebar container
  - `src/components/layout/EditorArea.tsx` — Main editor area with tab bar
  - `src/components/layout/Header.tsx` — Top header with app name, settings, dark mode toggle
  - `src/components/layout/TabBar.tsx` — Open file tabs
- Files to modify: `src/App.tsx`

**Sub-tasks:**

1. Create `src/components/layout/AppLayout.tsx`:
   - Use shadcn's `ResizablePanelGroup` with `ResizablePanel` and `ResizableHandle` for the sidebar + editor split
   - Left panel: sidebar (default 250px width, min 200px, collapsible)
   - Right panel: editor area (fills remaining space)
   - Full viewport height (`h-screen`)

2. Create `src/components/layout/Header.tsx`:
   - Fixed top bar with: app title/logo ("MDX Workspace"), dark mode toggle (Switch component), settings button, auto-save toggle
   - Use `flex` layout with items spaced between

3. Create `src/components/layout/Sidebar.tsx`:
   - Container for the file explorer (built in Step 6)
   - Header section with "Explorer" title, refresh button, new file button, new folder button
   - Search input for filtering files
   - Scrollable tree area using shadcn `ScrollArea`

4. Create `src/components/layout/TabBar.tsx`:
   - Horizontal scrollable tab bar showing open files
   - Each tab shows: emoji icon (if set), filename, close button, dirty indicator (unsaved dot)
   - Clicking a tab switches the active editor
   - Middle-click or close button closes the tab

5. Create `src/components/layout/EditorArea.tsx`:
   - Contains the TabBar at top
   - Below it, the editor component (placeholder for now)
   - When no file is open, show a welcome/empty state

6. Update `src/App.tsx` to render `<AppLayout />`

7. Create `src/App.css` (or a new `src/styles/editor.css`) with:
   - mdx-editor structural overrides (from the search example's `_mdxeditor.scss`):
     ```css
     .mdxeditor-root-contenteditable { overflow: auto; }
     .mdxeditor-toolbar { flex-shrink: 0; }
     .mdxeditor { height: 100%; display: flex; flex-direction: column; }
     ```
   - CSS Highlight API styles for search (from `_highlight.scss`):
     ```css
     ::highlight(MdxSearch) { background: yellow; }
     ::highlight(MdxFocusSearch) { background: fuchsia; }
     ```

**Edge Cases & Gotchas:**
- The sidebar must be collapsible (toggle button) but also resizable via drag handle
- Tab bar must handle overflow gracefully — horizontal scroll with no wrapping
- Ensure the layout fills exactly `100vh` with no scrollbar on the body

**Verification:**
- The app renders a two-panel layout with a visible sidebar and editor area
- The sidebar is resizable by dragging the handle
- The tab bar area is visible (even if empty)
- Dark mode toggle visually switches themes (even if not persisted yet)

**Depends On:** Step 1
**Blocks:** Steps 6, 7

---

### Step 3: Dark Mode System

**Objective:** Implement a toggleable dark mode that persists across sessions and applies to both the app UI and the mdx-editor.

**Context:**
- The shadcn setup already has dark mode CSS variables defined in `src/index.css` (`:root` for light, `.dark` for dark)
- The `@custom-variant dark (&:is(.dark *))` is already configured for Tailwind v4
- mdx-editor supports dark mode via the `dark-theme` CSS class on the editor root

**Scope:**
- Files to create:
  - `src/hooks/useTheme.ts` — Custom hook for theme management
  - `src/contexts/ThemeContext.tsx` — Theme context provider
- Files to modify: `src/main.tsx`, `src/components/layout/Header.tsx`, `src/index.css`

**Sub-tasks:**

1. Create `src/hooks/useTheme.ts`:
   - Reads initial theme from `localStorage` key `"mdx-workspace-theme"` (values: `"light"` | `"dark"` | `"system"`)
   - Defaults to `"system"` if no stored preference
   - Provides `theme`, `setTheme`, `resolvedTheme` (the actual light/dark after resolving system preference)
   - On change, toggles the `dark` class on `document.documentElement`
   - Listens to `prefers-color-scheme` media query changes when in system mode

2. Create `src/contexts/ThemeContext.tsx`:
   - Wraps the `useTheme` hook in a React context
   - Provides `ThemeProvider` component and `useThemeContext` hook

3. Update `src/main.tsx` to wrap `<App />` in `<ThemeProvider>`

4. Update `src/components/layout/Header.tsx`:
   - Add a dark mode toggle using shadcn `Switch` or a button with sun/moon icons from `lucide-react`
   - Wire it to `useThemeContext().setTheme()`

5. Add mdx-editor dark mode CSS variables to `src/index.css` or a new `src/styles/mdx-dark.css`:
   - When `.dark` is active, override mdx-editor's CSS variables (`--accentBase`, `--baseBase`, etc.) using Radix dark color tokens
   - The mdx-editor uses `dark-theme` class — ensure the editor component conditionally applies this class based on the resolved theme

**Edge Cases & Gotchas:**
- The mdx-editor has its own theming system separate from shadcn. Both must be synchronized.
- The `dark-theme` class on the mdx-editor root triggers Radix dark color imports. Ensure the necessary `@radix-ui/colors` dark CSS is imported or that custom CSS variables are set.
- System theme changes (e.g., OS switches to dark mode) should be reflected immediately if the user is in "system" mode.

**Verification:**
- Clicking the dark mode toggle switches the entire UI between light and dark
- Refreshing the page preserves the theme choice
- The mdx-editor (once integrated in Step 7) also switches themes correctly

**Depends On:** Step 2
**Blocks:** Step 7 (editor needs to know the theme)

---

### Step 4: File System Access Layer

**Objective:** Build an abstraction layer over the File System Access API that handles opening a workspace directory, reading/writing files, creating/deleting files and folders, and persisting the directory handle.

**Context:**
- The File System Access API provides `showDirectoryPicker()`, `FileSystemDirectoryHandle`, `FileSystemFileHandle`, and `FileSystemWritableFileStream`
- Directory handles can be stored in IndexedDB (they are structured-cloneable)
- Permission must be re-requested on page reload

**Scope:**
- Files to create:
  - `src/lib/filesystem.ts` — Core filesystem operations
  - `src/lib/storage.ts` — IndexedDB persistence via `idb-keyval`
  - `src/types/filesystem.ts` — TypeScript types for file tree nodes

**Sub-tasks:**

1. Create `src/types/filesystem.ts`:
   - Define `FileNode` type: `{ name: string; path: string; kind: 'file' | 'directory'; handle: FileSystemFileHandle | FileSystemDirectoryHandle; children?: FileNode[]; icon?: string; }`
   - Define `WorkspaceState` type: `{ rootHandle: FileSystemDirectoryHandle; tree: FileNode[]; }`

2. Create `src/lib/storage.ts`:
   - Use `idb-keyval` to create a custom store named `"mdx-workspace-store"`
   - Export functions:
     - `saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void>`
     - `getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined>`
     - `saveSetting(key: string, value: any): Promise<void>`
     - `getSetting(key: string): Promise<any>`

3. Create `src/lib/filesystem.ts` with the following exported functions:

   a. `openWorkspace(): Promise<FileSystemDirectoryHandle>` — Calls `showDirectoryPicker({ mode: 'readwrite' })`, saves handle to IndexedDB, returns handle

   b. `restoreWorkspace(): Promise<FileSystemDirectoryHandle | null>` — Retrieves handle from IndexedDB, calls `handle.requestPermission({ mode: 'readwrite' })`, returns handle if permission granted, null otherwise

   c. `buildFileTree(dirHandle: FileSystemDirectoryHandle, basePath?: string): Promise<FileNode[]>` — Recursively reads directory entries, filters to `.md` files and image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`) and subdirectories, sorts (directories first, then alphabetical), returns tree structure

   d. `readFile(fileHandle: FileSystemFileHandle): Promise<string>` — Gets file, reads as text, returns content

   e. `writeFile(fileHandle: FileSystemFileHandle, content: string): Promise<void>` — Creates writable stream, writes content, closes stream

   f. `createFile(dirHandle: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle>` — Calls `dirHandle.getFileHandle(name, { create: true })`, writes empty string to initialize

   g. `createDirectory(dirHandle: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle>` — Calls `dirHandle.getDirectoryHandle(name, { create: true })`

   h. `deleteEntry(dirHandle: FileSystemDirectoryHandle, name: string): Promise<void>` — Calls `dirHandle.removeEntry(name, { recursive: true })`

   i. `saveImage(rootHandle: FileSystemDirectoryHandle, file: File): Promise<string>` — Ensures `assets/` directory exists in root, generates unique filename (timestamp + original name), writes file bytes, returns relative path `assets/filename.ext`

   j. `getFileByPath(rootHandle: FileSystemDirectoryHandle, path: string): Promise<FileSystemFileHandle>` — Navigates the path segments to get the file handle

   k. `readFileIcon(content: string): string | undefined` — Parses YAML front-matter from markdown content to extract the `icon` field (simple regex-based extraction, no heavy YAML parser needed)

**Edge Cases & Gotchas:**
- `showDirectoryPicker()` throws `AbortError` if the user cancels — catch and handle gracefully
- Permission can be `"prompt"` or `"denied"` on restore — must handle both states
- `removeEntry` with `{ recursive: true }` is needed for non-empty directories
- File names may contain special characters — validate/sanitize on create
- The `assets/` directory may not exist yet when the first image is pasted — create it on demand
- `buildFileTree` should skip hidden files/directories (names starting with `.`) and `node_modules`
- Large directories should not block the UI — consider yielding to the event loop during tree building

**Verification:**
- Can call `openWorkspace()` and see a directory picker
- After selecting a directory, `buildFileTree()` returns the correct tree structure
- Can read and write a markdown file
- Can create and delete files/directories
- Closing and reopening the app restores the workspace without re-picking

**Depends On:** Step 1
**Blocks:** Steps 5, 6, 7, 8, 11, 12

---

### Step 5: Workspace State Management

**Objective:** Create a React context that manages the entire workspace state: file tree, open files/tabs, active file, editor content, dirty state, and user settings.

**Context:**
- Step 4 provides the filesystem primitives
- The state needs to be accessible from the sidebar, tab bar, editor, and search panel

**Scope:**
- Files to create:
  - `src/contexts/WorkspaceContext.tsx` — The main workspace context and provider
  - `src/types/workspace.ts` — TypeScript types for workspace state
- Files to modify: `src/main.tsx` (wrap app in provider)

**Sub-tasks:**

1. Create `src/types/workspace.ts`:
   - `OpenFile`: `{ path: string; handle: FileSystemFileHandle; content: string; savedContent: string; icon?: string; }`
     - `content` = current editor content (may be unsaved)
     - `savedContent` = last content read from / written to disk (for diff mode)
   - `WorkspaceSettings`: `{ autoSave: boolean; theme: 'light' | 'dark' | 'system'; }`
   - `WorkspaceState`: `{ rootHandle: FileSystemDirectoryHandle | null; fileTree: FileNode[]; openFiles: OpenFile[]; activeFilePath: string | null; settings: WorkspaceSettings; isLoading: boolean; }`

2. Create `src/contexts/WorkspaceContext.tsx`:
   - Use `useReducer` with actions:
     - `SET_ROOT_HANDLE` — Set the workspace root directory handle
     - `SET_FILE_TREE` — Replace the entire file tree
     - `OPEN_FILE` — Add a file to open files and set it as active
     - `CLOSE_FILE` — Remove a file from open files, switch active to adjacent tab
     - `SET_ACTIVE_FILE` — Switch the active file tab
     - `UPDATE_CONTENT` — Update the current editor content for a file (marks it dirty)
     - `MARK_SAVED` — Update `savedContent` to match `content` (after save)
     - `UPDATE_SETTINGS` — Update workspace settings
     - `SET_LOADING` — Toggle loading state
   - Provide helper functions via context:
     - `openWorkspace()` — Calls filesystem `openWorkspace()`, builds tree, dispatches
     - `restoreWorkspace()` — Attempts to restore from IndexedDB
     - `openFile(path: string, handle: FileSystemFileHandle)` — Reads content, dispatches `OPEN_FILE`
     - `closeFile(path: string)` — Checks for unsaved changes, prompts if dirty, dispatches `CLOSE_FILE`
     - `saveFile(path: string)` — Writes content to disk via filesystem layer, dispatches `MARK_SAVED`
     - `saveActiveFile()` — Convenience wrapper
     - `refreshTree()` — Re-reads filesystem, rebuilds tree
     - `createFile(dirHandle, name)` — Creates file, refreshes tree
     - `createDirectory(dirHandle, name)` — Creates directory, refreshes tree
     - `deleteEntry(dirHandle, name)` — Deletes entry, closes if open, refreshes tree
     - `isDirty(path: string): boolean` — Returns `content !== savedContent`

3. Update `src/main.tsx` to wrap `<App />` in `<WorkspaceProvider>`

4. On app mount, attempt `restoreWorkspace()`. If successful, build tree and set state. If not, show a "Open Workspace" landing screen.

**Edge Cases & Gotchas:**
- Closing a dirty file should prompt the user ("You have unsaved changes. Discard?")
- If the active file is closed, switch to the next tab (or previous if it was the last)
- If all files are closed, show the empty state
- Opening a file that's already open should just switch to its tab, not re-read from disk
- The `savedContent` field is critical for diff mode — it must always reflect what's on disk
- Settings should be persisted to IndexedDB via `saveSetting()` on every change

**Verification:**
- Opening a workspace populates the file tree in state
- Opening a file adds it to tabs and shows it as active
- Editing content marks the file as dirty (content !== savedContent)
- Saving updates savedContent to match content
- Closing and reopening the app restores the workspace

**Depends On:** Steps 3, 4
**Blocks:** Steps 6, 7, 11, 12

---

### Step 6: File Explorer Sidebar

**Objective:** Build the file explorer sidebar with a tree view of the workspace, supporting create/delete/rename, search filtering, refresh, and emoji icon customization.

**Context:**
- Step 5 provides workspace state and CRUD operations
- Step 4 provides filesystem primitives
- The sidebar container was created in Step 2

**Scope:**
- Files to create:
  - `src/components/sidebar/FileExplorer.tsx` — Main file explorer component
  - `src/components/sidebar/FileTreeNode.tsx` — Recursive tree node component
  - `src/components/sidebar/FileTreeActions.tsx` — Action buttons (new file, new folder, refresh)
  - `src/components/sidebar/FileSearch.tsx` — Search/filter input
  - `src/components/sidebar/EmojiPicker.tsx` — Simple emoji picker for file icons
  - `src/components/sidebar/NewItemInput.tsx` — Inline input for creating new files/folders
- Files to modify: `src/components/layout/Sidebar.tsx`

**Sub-tasks:**

1. Create `src/components/sidebar/FileExplorer.tsx`:
   - Renders the file tree from workspace context
   - Header with "Explorer" title and action buttons
   - Search input at top
   - Scrollable tree area
   - "Open Workspace" button if no workspace is open

2. Create `src/components/sidebar/FileTreeNode.tsx`:
   - Recursive component rendering a single file/directory node
   - Directories: collapsible with chevron icon, click to expand/collapse
   - Files: click to open in editor, show emoji icon if set (from front-matter), otherwise show a default file icon (from lucide-react)
   - Active file highlighted with accent background
   - Dirty files show a dot indicator
   - Right-click context menu (shadcn `ContextMenu`) with options:
     - "New File" (only on directories)
     - "New Folder" (only on directories)
     - "Change Icon" (opens emoji picker)
     - "Delete" (with confirmation dialog)
   - Indentation based on depth level

3. Create `src/components/sidebar/FileTreeActions.tsx`:
   - Row of icon buttons: New File (FilePlus), New Folder (FolderPlus), Refresh (RefreshCw), Collapse All (ChevronsDownUp)
   - New File/Folder creates at the workspace root (or currently selected directory)
   - Refresh calls `refreshTree()` from workspace context

4. Create `src/components/sidebar/FileSearch.tsx`:
   - Input field with search icon
   - Filters the file tree in real-time as the user types
   - Matches against file/folder names (case-insensitive substring match)
   - When filtering, auto-expand parent directories of matching files

5. Create `src/components/sidebar/EmojiPicker.tsx`:
   - A simple popover with a grid of common emojis (📝 📄 📋 📌 📎 🔖 💡 ⭐ 🎯 🚀 📊 🔧 🎨 📚 🗂️ etc.)
   - On select, writes the emoji to the file's YAML front-matter `icon` field
   - If the file has no front-matter, creates one: `---\nicon: 📝\n---\n`
   - If the file has front-matter but no `icon`, adds the `icon` field
   - If the file has an `icon` field, updates it
   - After updating, saves the file and refreshes the tree node

6. Create `src/components/sidebar/NewItemInput.tsx`:
   - Inline text input that appears in the tree when creating a new file/folder
   - Enter to confirm, Escape to cancel
   - Validates: no empty names, no duplicate names, no invalid characters
   - For files, auto-appends `.md` if not present

7. Update `src/components/layout/Sidebar.tsx` to render `<FileExplorer />`

**Edge Cases & Gotchas:**
- Deleting a file that is currently open should close its tab (with dirty check)
- Creating a file with a name that already exists should show an error
- The emoji picker modifying front-matter must not corrupt the rest of the file content
- Front-matter parsing for the icon should be simple and robust — use a regex like `/^---\n([\s\S]*?)\n---/` to extract, then find/replace the `icon:` line
- Search filtering should be debounced (150ms) to avoid excessive re-renders
- Very deep directory nesting should be handled gracefully (max indentation)

**Verification:**
- File tree renders correctly with directories and files
- Clicking a file opens it in the editor
- Right-click shows context menu with working options
- Creating a new file adds it to the tree and opens it
- Deleting a file removes it from the tree and closes its tab
- Search filtering works and auto-expands matching paths
- Emoji picker updates the file icon in the tree

**Depends On:** Steps 2, 5
**Blocks:** Step 8 (image upload needs tree refresh)

---

### Step 7: MDX Editor Integration

**Objective:** Configure and render the MDX editor with all required plugins and a comprehensive toolbar, wired to the workspace state for reading/displaying file content.

**Context:**
- Steps 2-5 provide the layout, theme, filesystem, and state management
- The editor must support: headings, lists, quotes, thematic breaks, bold/italic/underline, links, images, tables, code blocks (CodeMirror only, no Sandpack), admonitions, front-matter, diff/source mode, markdown shortcuts

**Scope:**
- Files to create:
  - `src/components/editor/MarkdownEditor.tsx` — The main editor wrapper component
  - `src/components/editor/EditorToolbar.tsx` — Custom toolbar configuration
  - `src/components/editor/WelcomeScreen.tsx` — Empty state when no file is open
- Files to modify: `src/components/layout/EditorArea.tsx`

**Sub-tasks:**

1. Create `src/components/editor/MarkdownEditor.tsx`:
   - Accepts `filePath`, `content`, `savedContent`, `onChange` props
   - Renders `<MDXEditor>` with a `ref` (for `setMarkdown`, `getMarkdown`)
   - Uses `key={filePath}` to force re-mount when switching files (mdx-editor doesn't support dynamic `markdown` prop changes well — `setMarkdown` via ref is the alternative, but re-mounting is simpler and more reliable)
   - Applies `className="dark-theme dark-editor"` conditionally based on resolved theme
   - Configures all plugins (see sub-task 2)
   - Wires `onChange` to update workspace state content

2. Configure plugins array:
   - `headingsPlugin()` — H1-H6 support
   - `listsPlugin()` — Ordered, unordered, check lists
   - `quotePlugin()` — Block quotes
   - `thematicBreakPlugin()` — Horizontal rules
   - `linkPlugin()` — Markdown links
   - `linkDialogPlugin()` — Link edit popover
   - `imagePlugin({ imageUploadHandler })` — Images with custom upload handler (placeholder for now, implemented in Step 8)
   - `tablePlugin()` — Table support
   - `codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' })` — Fenced code blocks
   - `codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript (React)', jsx: 'JavaScript (React)', css: 'CSS', html: 'HTML', json: 'JSON', python: 'Python', markdown: 'Markdown', bash: 'Bash', txt: 'Plain Text' } })` — CodeMirror editor for code blocks
   - `directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor] })` — Admonitions
   - `frontmatterPlugin()` — YAML front-matter editing
   - `markdownShortcutPlugin()` — Markdown shortcuts (e.g., `#` for heading, `>` for quote)
   - `diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown: savedContent })` — Diff/source mode with disk content as diff baseline
   - `toolbarPlugin({ toolbarContents: () => <EditorToolbar /> })` — Custom toolbar
   - The custom `searchPlugin()` (added in Step 10)

3. Create `src/components/editor/EditorToolbar.tsx`:
   - Wrap everything in `<DiffSourceToggleWrapper>` so rich-text toolbar hides in source/diff mode
   - Toolbar contents (left to right):
     - `<UndoRedo />`
     - `<Separator />`
     - `<BoldItalicUnderlineToggles />`
     - `<CodeToggle />`
     - `<Separator />`
     - `<BlockTypeSelect />` (paragraph, headings, quote)
     - `<Separator />`
     - `<ListsToggle />`
     - `<Separator />`
     - `<CreateLink />`
     - `<InsertImage />`
     - `<InsertTable />`
     - `<InsertThematicBreak />`
     - `<Separator />`
     - `<InsertAdmonition />`
     - `<InsertCodeBlock />`
     - `<InsertFrontmatter />`
     - `<Separator />`
     - `<MdxSearchToolbar />` (from the custom search plugin, added in Step 10 — leave a placeholder comment for now)
   - Use `<ConditionalContents>` to show `<ChangeCodeMirrorLanguage />` when a code block is focused, and the regular toolbar otherwise

4. Create `src/components/editor/WelcomeScreen.tsx`:
   - Shown when no file is open
   - Displays app logo/name, keyboard shortcuts reference, and "Open a file from the sidebar" message

5. Update `src/components/layout/EditorArea.tsx`:
   - If `activeFilePath` is null, render `<WelcomeScreen />`
   - Otherwise, render `<TabBar />` + `<MarkdownEditor />` with the active file's data

6. Import `@mdxeditor/editor/style.css` in the editor component or in `main.tsx`

**Edge Cases & Gotchas:**
- The `key={filePath}` approach means the editor re-mounts on tab switch. This is intentional — mdx-editor's `markdown` prop is like `defaultValue` and doesn't update reactively. The alternative is using `ref.current.setMarkdown()` but this can cause cursor position issues.
- The `onChange` callback fires on every keystroke — it should update state but NOT trigger a save (that's the auto-save system's job in Step 11)
- `diffSourcePlugin`'s `diffMarkdown` should be the `savedContent` (what's on disk). When the file is saved, `savedContent` updates, and the diff should reflect the new baseline. This may require re-mounting the editor or finding a way to update `diffMarkdown` dynamically.
- CodeMirror language packages must be installed. The `codeMirrorPlugin` may need explicit language imports depending on the version.
- The `babel-plugin-react-compiler` in the Vite config may cause issues with mdx-editor's internal state management. If the editor behaves unexpectedly, exclude `@mdxeditor` from the compiler.

**Verification:**
- Opening a markdown file renders it in the WYSIWYG editor
- All toolbar buttons are visible and functional
- Can toggle between rich-text, source, and diff modes
- Code blocks render with syntax highlighting
- Admonitions render with proper styling
- Front-matter shows as an editable form
- Tables are editable
- Links show the edit popover on click

**Depends On:** Steps 2, 3, 5
**Blocks:** Steps 8, 9, 10

---

### Step 8: Image Upload Handler

**Objective:** Implement the image upload handler so that pasted/dropped images are saved to the workspace's `assets/` folder and referenced with relative paths.

**Context:**
- Step 7 configured `imagePlugin` with a placeholder upload handler
- Step 4's `saveImage()` function handles the filesystem write
- Images should be saved to `{workspace_root}/assets/` with unique filenames

**Scope:**
- Files to modify:
  - `src/components/editor/MarkdownEditor.tsx` — Wire the real upload handler
  - `src/lib/filesystem.ts` — Ensure `saveImage` is robust

**Sub-tasks:**

1. Implement the `imageUploadHandler` function in `MarkdownEditor.tsx` (or in a separate `src/lib/imageUpload.ts`):
   - Receives a `File` object from mdx-editor
   - Calls `saveImage(rootHandle, file)` from the filesystem layer
   - Returns the relative path string (e.g., `./assets/my-image-1234567890.png`)
   - The relative path should work when the markdown is viewed from the workspace root

2. Update the `imagePlugin` configuration to use this handler:
   ```
   imagePlugin({ imageUploadHandler: handleImageUpload })
   ```

3. Ensure `saveImage` in `src/lib/filesystem.ts`:
   - Creates `assets/` directory if it doesn't exist (using `getDirectoryHandle('assets', { create: true })`)
   - Generates a unique filename: `{original-name-without-ext}-{timestamp}.{ext}`
   - Writes the file bytes using `FileSystemWritableFileStream`
   - Returns the relative path `./assets/{filename}`

4. After saving an image, trigger a tree refresh so the new image file appears in the sidebar

**Edge Cases & Gotchas:**
- Multiple images pasted at once — the handler is called once per image, so it should handle concurrent writes safely
- Very large images — no size limit is enforced, but the write should be streamed
- Filename sanitization — remove special characters from the original filename
- If the workspace root handle has lost permission, the upload will fail — catch and show an error toast
- The returned path must be relative (not absolute) so the markdown is portable

**Verification:**
- Paste an image into the editor — it appears inline
- The image file is saved in `{workspace}/assets/`
- The markdown source shows `![](./assets/image-name.png)`
- The image appears in the sidebar file tree under `assets/`

**Depends On:** Steps 4, 7
**Blocks:** None

---

### Step 9: Diff/Source Mode with Filesystem Diffing

**Objective:** Wire the diff source plugin so that "diff mode" shows the difference between the current editor content and what is saved on disk.

**Context:**
- Step 7 configured `diffSourcePlugin` with `diffMarkdown: savedContent`
- The `savedContent` in workspace state represents the last-read/last-saved version from disk
- When the user edits, `content` diverges from `savedContent`, and diff mode should show this

**Scope:**
- Files to modify:
  - `src/components/editor/MarkdownEditor.tsx` — Ensure diffMarkdown updates correctly

**Sub-tasks:**

1. The `diffSourcePlugin({ diffMarkdown: savedContent, viewMode: 'rich-text' })` is already configured in Step 7. Verify that `savedContent` is correctly passed and represents the on-disk version.

2. Since `diffMarkdown` is set at plugin initialization and mdx-editor plugins are configured once (on mount), and we use `key={filePath}` to re-mount on file switch, the `savedContent` at mount time will be correct for each file.

3. However, after a save operation, `savedContent` updates but the editor doesn't re-mount. The diff baseline becomes stale. To handle this:
   - Option A: Re-mount the editor after save (loses cursor position, disruptive)
   - Option B: Use mdx-editor's realm API to dynamically update `diffMarkdown$` after save
   - **Choose Option B**: After saving, use the editor ref or realm to publish the new `savedContent` to the `diffMarkdown$` cell. Research if `diffSourcePlugin` exposes a way to update `diffMarkdown` dynamically. If not, accept that the diff baseline only updates on file switch (re-mount).

4. Ensure the toolbar's `<DiffSourceToggleWrapper>` correctly shows three toggle buttons: Rich Text, Source, Diff.

**Edge Cases & Gotchas:**
- If the file is freshly opened and unmodified, diff mode should show no differences
- If the file was modified externally (outside the app) and the user hasn't refreshed, the diff baseline may be stale — this is acceptable; the refresh button handles this
- Source mode should show the raw markdown and allow direct editing
- Changes made in source mode should be reflected when switching back to rich-text mode

**Verification:**
- Open a file, make edits, switch to diff mode — differences are highlighted
- Save the file, switch to diff mode — no differences shown (or stale baseline, documented)
- Source mode shows raw markdown and edits are preserved when switching back

**Depends On:** Step 7
**Blocks:** None

---

### Step 10: Search & Replace Plugin

**Objective:** Port the custom search & replace plugin from `/home/luis/dev/search-plugin-example` into the MDX Workspace project.

**Context:**
- The search plugin example at `/home/luis/dev/search-plugin-example/src/search/` contains a complete implementation
- It uses the CSS Custom Highlight API for performant highlighting
- It provides search, next/prev navigation, replace, and replace-all functionality
- It uses `@mdxeditor/gurx` for reactive state cells

**Scope:**
- Files to create:
  - `src/components/editor/search/searchPlugin.tsx` — Core search plugin (ported from example)
  - `src/components/editor/search/SearchStates.tsx` — Reactive state cells (ported from example)
  - `src/components/editor/search/EditorSearchBar.tsx` — Search bar UI (ported from example)
  - `src/components/editor/search/MdxEditorSearchToolbar.tsx` — Toolbar integration (ported from example)
  - `src/components/editor/search/detectMac.ts` — Platform detection utility (ported from example)
- Files to modify:
  - `src/components/editor/MarkdownEditor.tsx` — Add `searchPlugin()` to plugins array
  - `src/components/editor/EditorToolbar.tsx` — Add `<MdxSearchToolbar />` to toolbar

**Sub-tasks:**

1. Copy the search plugin files from the example project, adapting import paths:
   - `searchPlugin.tsx` → `src/components/editor/search/searchPlugin.tsx`
     - Update import paths: `@/search/SearchStates` → `~/components/editor/search/SearchStates`
     - Verify `@mdxeditor/editor` exports: `Cell`, `debounceTime`, `lexical`, `realmPlugin`, `rootEditor$`, `useCell`, `useCellValue`, `useRealm`
     - If `Cell` and `debounceTime` are not exported from `@mdxeditor/editor`, import from `@mdxeditor/gurx`
   - `SearchStates.tsx` → `src/components/editor/search/SearchStates.tsx`
     - Update import for `TextNodeIndex` type
     - Verify `contentEditableRef$` is exported from `@mdxeditor/editor`
     - If `Cell` and `debounceTime` need to come from `@mdxeditor/gurx`, update imports
   - `EditorSearchBar.tsx` → `src/components/editor/search/EditorSearchBar.tsx`
     - Update import paths for shadcn components (`@/components/ui/button` → `~/components/ui/button`, etc.)
     - Ensure shadcn `Collapsible`, `Input`, and `Button` components are installed
   - `MdxEditorSearchToolbar.tsx` → `src/components/editor/search/MdxEditorSearchToolbar.tsx`
     - Update import paths
     - Verify `editorRootElementRef$`, `viewMode$` are exported from `@mdxeditor/editor`
   - `detectMac.ts` → `src/components/editor/search/detectMac.ts`
     - No changes needed, just copy

2. Add `searchPlugin()` to the plugins array in `MarkdownEditor.tsx`

3. Add `<MdxSearchToolbar />` to the toolbar in `EditorToolbar.tsx`

4. Ensure the CSS highlight styles are in the global CSS:
   ```css
   ::highlight(MdxSearch) { background: yellow; }
   ::highlight(MdxFocusSearch) { background: fuchsia; }
   ```
   These should have been added in Step 2. Verify they're present.

5. Adjust dark mode highlight colors:
   ```css
   .dark ::highlight(MdxSearch) { background: rgba(255, 204, 0, 0.4); }
   .dark ::highlight(MdxFocusSearch) { background: rgba(255, 0, 255, 0.4); }
   ```

**Edge Cases & Gotchas:**
- The search plugin uses `CSS.highlights` which is only available in Chromium browsers. The `canShowSearchTool()` function already checks for this — ensure it's used.
- The `MdxEditorSearchToolbar` uses `createPortal` to render the search bar to `document.body`. This may need adjustment to portal into the editor container instead, to respect the layout boundaries.
- The search plugin's `MutationObserver` re-indexes on every DOM change. In large documents, this could be expensive. The debounced indexer helps, but monitor performance.
- The `Collapsible` component from shadcn must be installed (it's from `@radix-ui/react-collapsible`).
- Keyboard shortcut `Ctrl/Cmd+F` opens the search bar. Ensure it doesn't conflict with the browser's native find.

**Verification:**
- Press `Ctrl/Cmd+F` — the search bar appears
- Type a search term — matches are highlighted in yellow
- The focused match is highlighted in fuchsia
- Next/Prev buttons navigate between matches
- Replace and Replace All work correctly
- Closing the search bar clears highlights

**Depends On:** Step 7
**Blocks:** None

---

### Step 11: Auto-Save System

**Objective:** Implement a debounced auto-save system that automatically writes changed files to disk after 300ms of inactivity, with a toggle to enable/disable it.

**Context:**
- Step 5's workspace state tracks `content` (current) and `savedContent` (on disk) for each open file
- Step 7's editor fires `onChange` on every keystroke
- The auto-save setting should persist across sessions

**Scope:**
- Files to create:
  - `src/hooks/useAutoSave.ts` — Custom hook implementing debounced auto-save
- Files to modify:
  - `src/components/editor/MarkdownEditor.tsx` — Wire auto-save hook
  - `src/components/layout/Header.tsx` — Add auto-save toggle UI
  - `src/contexts/WorkspaceContext.tsx` — Persist auto-save setting

**Sub-tasks:**

1. Create `src/hooks/useAutoSave.ts`:
   - Accepts: `content: string`, `savedContent: string`, `saveFn: () => Promise<void>`, `enabled: boolean`, `delay: number` (default 300ms)
   - Uses `useEffect` with a `setTimeout` that triggers `saveFn()` when:
     - `enabled` is true
     - `content !== savedContent` (file is dirty)
     - 300ms have passed since the last `content` change
   - Cleans up the timeout on unmount or when content changes (debounce behavior)
   - Handles save errors gracefully (show toast, don't crash)

2. Wire `useAutoSave` in `MarkdownEditor.tsx`:
   - Pass the active file's content, savedContent, and a save function
   - The save function calls `saveFile(activeFilePath)` from workspace context

3. Add auto-save toggle to `Header.tsx`:
   - A `Switch` component labeled "Auto-save"
   - Reads/writes from workspace settings in context
   - Persist the setting to IndexedDB via `saveSetting('autoSave', value)`

4. Add manual save keyboard shortcut `Ctrl/Cmd+S`:
   - Register a global keydown listener in the editor area
   - Calls `saveActiveFile()` from workspace context
   - Prevents the browser's default save dialog
   - Shows a brief toast "File saved" on success

5. Update the tab bar to show a dirty indicator (dot or modified icon) when `content !== savedContent`

**Edge Cases & Gotchas:**
- Auto-save should NOT fire if the file hasn't actually changed (avoid unnecessary writes)
- If the user switches tabs while a save is pending, the pending save should still complete for the previous file
- If the filesystem permission is lost, auto-save will fail — catch the error and show a toast, disable auto-save temporarily
- Rapid typing should only trigger one save after the user pauses (debounce, not throttle)
- The 300ms delay should be measured from the last keystroke, not from the first

**Verification:**
- Enable auto-save, type in the editor, wait 300ms — file is saved to disk (verify by reading the file externally)
- Disable auto-save — changes are not automatically saved
- Press `Ctrl/Cmd+S` — file is saved immediately regardless of auto-save setting
- The dirty indicator appears when editing and disappears after save
- Auto-save preference persists across page reloads

**Depends On:** Steps 5, 7
**Blocks:** None

---

### Step 12: Full-Text Workspace Search

**Objective:** Build a full-text search system using MiniSearch that indexes all markdown files in the workspace and provides a searchable results panel.

**Context:**
- MiniSearch is installed (Step 1)
- The filesystem layer can read all files
- This is a workspace-wide search (across all files), distinct from the in-editor search & replace (Step 10)

**Scope:**
- Files to create:
  - `src/lib/searchIndex.ts` — MiniSearch index management
  - `src/components/search/WorkspaceSearch.tsx` — Search panel UI
  - `src/components/search/SearchResult.tsx` — Individual search result component
  - `src/hooks/useWorkspaceSearch.ts` — Hook wrapping search functionality
- Files to modify:
  - `src/components/layout/Header.tsx` or `src/components/layout/AppLayout.tsx` — Add search trigger
  - `src/contexts/WorkspaceContext.tsx` — Integrate index updates on file changes

**Sub-tasks:**

1. Create `src/lib/searchIndex.ts`:
   - Initialize a `MiniSearch` instance with fields: `['title', 'content', 'path']`
   - `storeFields`: `['title', 'path', 'icon']` (for displaying results without re-reading files)
   - Configure search options: `{ prefix: true, fuzzy: 0.2, boost: { title: 2 } }`
   - Export functions:
     - `buildIndex(files: Array<{ id: string; title: string; content: string; path: string; icon?: string }>): void` — Clears and rebuilds the entire index
     - `addToIndex(doc)` / `removeFromIndex(id)` / `updateInIndex(doc)` — Incremental updates
     - `search(query: string): SearchResult[]` — Returns ranked results with `{ path, title, icon, score, match }` and context snippets

2. Create `src/hooks/useWorkspaceSearch.ts`:
   - Manages the search index lifecycle
   - On workspace open: reads all `.md` files, extracts title (first `# heading` or filename), builds index
   - On file save: updates the index entry for that file
   - On file create: adds to index
   - On file delete: removes from index
   - Exposes `search(query)`, `rebuildIndex()`, `isIndexing` state

3. Create `src/components/search/WorkspaceSearch.tsx`:
   - Triggered by a search icon in the header or `Ctrl/Cmd+Shift+F` keyboard shortcut
   - Renders as a panel/drawer (could be a sheet from the right, or a command palette overlay)
   - Search input at top with real-time results below
   - Results grouped by file, showing:
     - File icon (emoji) + filename + path
     - Context snippet with the matching text highlighted
     - Click to open the file and scroll to the match location
   - Debounced search (200ms) to avoid excessive re-indexing

4. Create `src/components/search/SearchResult.tsx`:
   - Renders a single search result
   - Shows file icon, name, path, and a snippet of matching content
   - Clicking opens the file in the editor

5. Integrate index updates into workspace context:
   - After `saveFile()`: call `updateInIndex()`
   - After `createFile()`: call `addToIndex()` (with empty content initially)
   - After `deleteEntry()`: call `removeFromIndex()`
   - After `refreshTree()`: call `rebuildIndex()`

6. Add the search trigger to the header:
   - A search icon button (lucide `Search`)
   - Keyboard shortcut `Ctrl/Cmd+Shift+F`
   - Opens the `WorkspaceSearch` panel

**Edge Cases & Gotchas:**
- Building the index for a large workspace (hundreds of files) could be slow — show a loading indicator and consider using `requestIdleCallback` or chunking
- The search index lives in memory and is lost on page reload — it must be rebuilt on workspace restore
- MiniSearch's `fuzzy` option with a value of `0.2` means it tolerates ~20% character differences — this is a good default for typo tolerance
- Context snippets should show ~50 characters before and after the match, with the match highlighted
- If the user searches while the index is still building, queue the search and execute after indexing completes

**Verification:**
- Open a workspace with multiple markdown files
- Open the search panel, type a query — results appear from across all files
- Click a result — the file opens in the editor
- Create a new file with content, search for that content — it appears in results
- Delete a file, search for its content — it no longer appears

**Depends On:** Steps 4, 5
**Blocks:** None

**This step is independent of Steps 8, 9, 10, 11 and can be executed in parallel with them.**

---

### Step 13: PWA Configuration

**Objective:** Configure the app as a Progressive Web App with offline support, installability, and proper caching of all assets.

**Context:**
- `vite-plugin-pwa` is installed (Step 1)
- The app has no server-side API calls — everything is local filesystem
- All static assets (JS, CSS, HTML, icons) must be cached for offline use

**Scope:**
- Files to create:
  - `public/icons/` — PWA icon set (192x192, 512x512, maskable variants)
  - `public/favicon.ico` — App favicon
- Files to modify:
  - `vite.config.ts` — Add VitePWA plugin configuration
  - `src/main.tsx` — Register service worker
  - `index.html` — Add PWA meta tags
  - `tsconfig.app.json` — Already updated in Step 1

**Sub-tasks:**

1. Create PWA icons in `public/icons/`:
   - `icon-192x192.png` — Standard icon
   - `icon-512x512.png` — Large icon
   - `icon-maskable-192x192.png` — Maskable icon for Android
   - `icon-maskable-512x512.png` — Maskable large icon
   - These can be simple placeholder icons initially (a notepad/document emoji rendered as PNG), to be replaced with proper branding later
   - Also create `public/favicon.ico`

2. Update `vite.config.ts` to add the `VitePWA` plugin:
   ```
   VitePWA({
     registerType: 'autoUpdate',
     includeAssets: ['favicon.ico', 'icons/*.png'],
     manifest: {
       name: 'MDX Workspace',
       short_name: 'MDX Workspace',
       description: 'A PWA markdown editor with workspace management',
       theme_color: '#0a0a0a',
       background_color: '#0a0a0a',
       display: 'standalone',
       scope: '/',
       start_url: '/',
       icons: [
         { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
         { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
         { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
         { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
       ]
     },
     workbox: {
       globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
       runtimeCaching: []
     }
   })
   ```

3. Update `src/main.tsx` to register the service worker:
   - Import `registerSW` from `'virtual:pwa-register'`
   - Call `registerSW({ onNeedRefresh() { /* optionally show toast */ }, onOfflineReady() { /* optionally show toast */ } })`

4. Update `index.html` with PWA meta tags:
   - `<meta name="theme-color" content="#0a0a0a">`
   - `<meta name="description" content="A PWA markdown editor with workspace management">`
   - `<link rel="apple-touch-icon" href="/icons/icon-192x192.png">`
   - `<link rel="icon" type="image/png" href="/icons/icon-192x192.png">`

5. Add an "app update available" toast notification:
   - When `onNeedRefresh` fires, show a toast with "New version available. Click to update."
   - On click, call `updateSW(true)` to activate the new service worker

**Edge Cases & Gotchas:**
- The service worker only works in production builds (`npm run build && npm run preview`), not in dev mode
- `registerType: 'autoUpdate'` means the service worker updates automatically without user intervention, but the `onNeedRefresh` callback still fires for notification purposes
- The `globPatterns` must include all file types used by the app (including fonts if any are bundled)
- The `display: 'standalone'` makes the PWA look like a native app when installed
- Dark theme color should match the app's dark background for a seamless experience

**Verification:**
- Run `npm run build && npm run preview`
- Open in Chrome, check DevTools > Application > Manifest — manifest is valid
- Check DevTools > Application > Service Workers — service worker is registered
- Install the PWA (Chrome address bar install button) — it opens as a standalone app
- Disconnect network (DevTools > Network > Offline) — the app still loads and functions
- All static assets are cached (check DevTools > Application > Cache Storage)

**Depends On:** Step 1
**Blocks:** None

**This step is independent of Steps 2-12 and can be executed at any point after Step 1.**

---

### Step 14: Polish & Integration Testing

**Objective:** Final polish pass — ensure all features work together, handle edge cases, add keyboard shortcuts, improve UX, and fix styling issues.

**Context:**
- All features are implemented in Steps 1-13
- This step is about integration, polish, and catching issues that only appear when everything is wired together

**Scope:**
- Files to modify: Various files across the project
- No new major files to create

**Sub-tasks:**

1. **Keyboard shortcuts consolidation:**
   - `Ctrl/Cmd+S` — Save active file
   - `Ctrl/Cmd+F` — In-editor search & replace (handled by search plugin)
   - `Ctrl/Cmd+Shift+F` — Workspace-wide full-text search
   - `Ctrl/Cmd+P` — Quick file open (command palette style — use shadcn `Command` component)
   - `Ctrl/Cmd+B` — Toggle sidebar
   - `Ctrl/Cmd+\` — Toggle sidebar (alternative)
   - Register all shortcuts in a central place, ensure no conflicts with browser defaults or mdx-editor shortcuts

2. **Quick file open (Ctrl+P):**
   - Implement a command palette using shadcn `Command` component
   - Shows all files in the workspace, filterable by typing
   - Selecting a file opens it in the editor
   - This is a natural extension of the file search feature

3. **Error handling:**
   - Wrap filesystem operations in try/catch with user-friendly error toasts
   - Handle permission denied errors with a "Re-grant access" prompt
   - Handle file-not-found errors (file deleted externally) gracefully
   - Add an error boundary around the editor to catch mdx-editor crashes

4. **Loading states:**
   - Show a spinner/skeleton when opening a workspace
   - Show a spinner when building the search index
   - Show a spinner when reading a large file

5. **Responsive behavior:**
   - On narrow viewports, auto-collapse the sidebar
   - The editor should fill available space
   - The search bar and toolbar should wrap gracefully

6. **Styling polish:**
   - Ensure consistent spacing and typography throughout
   - Verify dark mode looks correct in all components (sidebar, tabs, editor, search, dialogs)
   - Ensure mdx-editor's internal styles don't conflict with Tailwind
   - Add smooth transitions for sidebar collapse/expand, tab switching, theme toggling

7. **Window focus refresh:**
   - When the app window regains focus, optionally check if files have changed on disk
   - If auto-refresh is desired, re-read the active file and compare with the editor content
   - If the file changed externally and the editor has unsaved changes, prompt the user

8. **Clean up `App.css`:**
   - Remove any remaining boilerplate styles
   - Consolidate all custom CSS into organized files

9. **Verify the `site/` directory is excluded:**
   - Ensure the `site/` directory (mdx-editor docs) is not included in the build
   - Add to `.gitignore` if needed, or ensure Vite's build doesn't process it

**Edge Cases & Gotchas:**
- Multiple keyboard shortcuts may conflict — test each one individually
- The command palette (`Ctrl+P`) may conflict with the browser's print dialog — use `e.preventDefault()`
- Error boundaries should show a "Something went wrong" message with a "Reload" button, not crash the entire app
- External file changes are a tricky UX problem — the simplest approach is to only check on manual refresh, not automatically

**Verification:**
- All keyboard shortcuts work as expected
- The app handles errors gracefully (no white screens, no unhandled promise rejections)
- Dark mode is consistent across all components
- The app is usable on a 1024px wide screen
- Opening, editing, saving, searching, and navigating all work together without issues
- The PWA installs and works offline
- No console errors or warnings in normal usage

**Depends On:** Steps 1-13
**Blocks:** None

---

## Parallelization Strategy

The 14 steps have a dependency graph that allows significant parallelization. Below is the optimal strategy for executing this plan with multiple agents working concurrently.

### Dependency Graph

```
Step 1 (Setup)
├── Step 2 (Layout)
│   ├── Step 3 (Dark Mode)
│   │   └── Step 5 (State) ← also depends on Step 4
│   │       ├── Step 6 (Sidebar)
│   │       ├── Step 7 (Editor) ← also depends on Steps 2, 3
│   │       │   ├── Step 8 (Image Upload)
│   │       │   ├── Step 9 (Diff Mode)
│   │       │   └── Step 10 (Search Plugin)
│   │       ├── Step 11 (Auto-Save) ← also depends on Step 7
│   │       └── Step 12 (Full-Text Search)
│   └── Step 6 (Sidebar) ← also depends on Step 5
├── Step 4 (Filesystem) ← independent of Steps 2, 3
│   └── Step 5 (State) ← also depends on Step 3
└── Step 13 (PWA) ← independent of everything except Step 1

Step 14 (Polish) ← depends on ALL of Steps 1-13
```

### Optimal Execution Phases

The plan can be executed in **6 phases**, where all steps within a phase run in parallel:

#### Phase A — Foundation (1 agent)
| Agent | Step |
|-------|------|
| Agent 1 | **Step 1**: Project cleanup & dependency installation |

*Must complete before anything else starts. Single agent, ~15 min.*

---

#### Phase B — Core Infrastructure (3 agents in parallel)
| Agent | Step |
|-------|------|
| Agent 1 | **Step 2**: App shell & layout |
| Agent 2 | **Step 4**: File System Access layer |
| Agent 3 | **Step 13**: PWA configuration |

*Steps 2, 4, and 13 all depend only on Step 1 and have zero overlap in files touched. Fully parallelizable.*

---

#### Phase C — Theme + State (2 agents, partially parallel)
| Agent | Step | Notes |
|-------|------|-------|
| Agent 1 | **Step 3**: Dark mode system | Depends on Step 2 |
| Agent 2 | **Step 5**: Workspace state management | Depends on Steps 3 and 4 — **must wait for Step 3 to finish** |

*Step 3 can start as soon as Step 2 finishes. Step 5 must wait for both Steps 3 and 4. If Step 4 finishes before Step 3, Agent 2 is idle briefly. In practice, run Step 3 first, then Step 5 immediately after.*

**Alternative:** If you want to maximize parallelism, Step 5 can be started with a stub ThemeContext (just the type interface) and the real theme integration wired in later. This lets Step 5 start as soon as Step 4 finishes.

---

#### Phase D — UI Features (3 agents in parallel)
| Agent | Step |
|-------|------|
| Agent 1 | **Step 6**: File explorer sidebar |
| Agent 2 | **Step 7**: MDX Editor integration |
| Agent 3 | **Step 12**: Full-text workspace search |

*All three depend on Step 5 (and earlier steps) but touch completely different files:*
- *Step 6 creates `src/components/sidebar/*` files*
- *Step 7 creates `src/components/editor/*` files*
- *Step 12 creates `src/lib/searchIndex.ts`, `src/components/search/*`, `src/hooks/useWorkspaceSearch.ts`*

*No file conflicts. Fully parallelizable.*

---

#### Phase E — Editor Enhancements (4 agents in parallel)
| Agent | Step |
|-------|------|
| Agent 1 | **Step 8**: Image upload handler |
| Agent 2 | **Step 9**: Diff/Source mode |
| Agent 3 | **Step 10**: Search & Replace plugin |
| Agent 4 | **Step 11**: Auto-save system |

*All four depend on Step 7 but touch different files:*
- *Step 8 modifies `MarkdownEditor.tsx` (imageUploadHandler) and `filesystem.ts`*
- *Step 9 modifies `MarkdownEditor.tsx` (diffMarkdown wiring)*
- *Step 10 creates new files in `src/components/editor/search/*` and adds plugin to `MarkdownEditor.tsx`*
- *Step 11 creates `src/hooks/useAutoSave.ts` and modifies `MarkdownEditor.tsx` and `Header.tsx`*

**⚠️ Conflict Warning:** Steps 8, 9, 10, and 11 all modify `src/components/editor/MarkdownEditor.tsx`. To parallelize safely:
- **Option 1 (Recommended):** Run Steps 8, 9, 10, 11 sequentially with a single agent. They are each small (~15 min each), so total ~1 hour.
- **Option 2:** Assign each step to a separate agent but have them modify different sections of `MarkdownEditor.tsx`. Step 8 adds the `imageUploadHandler` function and updates the `imagePlugin` config line. Step 9 adjusts the `diffSourcePlugin` config. Step 10 adds `searchPlugin()` to the plugins array and `<MdxSearchToolbar />` to the toolbar. Step 11 adds the `useAutoSave` hook call. These are distinct, non-overlapping edits, but merge conflicts are possible.
- **Option 3 (Safest parallel):** Have one agent do Steps 8+9 (both small, both about editor config) and another do Steps 10+11 (search plugin + auto-save). This gives 2 parallel tracks with minimal conflict risk.

---

#### Phase F — Final Polish (1 agent)
| Agent | Step |
|-------|------|
| Agent 1 | **Step 14**: Polish & integration testing |

*Must run after all other steps. Single agent, ~30 min.*

---

### Summary Timeline

```
Phase A:  [Step 1]                                          ~15 min
Phase B:  [Step 2] [Step 4] [Step 13]  (3 parallel)        ~30 min
Phase C:  [Step 3] → [Step 5]          (sequential)        ~30 min
Phase D:  [Step 6] [Step 7] [Step 12]  (3 parallel)        ~30 min
Phase E:  [Step 8+9] [Step 10+11]      (2 parallel tracks) ~30 min
Phase F:  [Step 14]                                         ~30 min
                                                    Total: ~2.5 hours
```

*vs. fully sequential: ~7+ hours*

### Maximum Agent Utilization

| Phase | Agents Needed | Steps Running |
|-------|--------------|---------------|
| A | 1 | 1 |
| B | 3 | 2, 4, 13 |
| C | 1-2 | 3, then 5 |
| D | 3 | 6, 7, 12 |
| E | 2 | 8+9, 10+11 |
| F | 1 | 14 |

**Peak parallelism: 3 agents** (Phases B and D).

### File Conflict Map

To avoid merge conflicts when running steps in parallel, here are the files that multiple steps touch:

| File | Steps That Modify It | Conflict Risk |
|------|---------------------|---------------|
| `src/main.tsx` | 3, 5 | Low — Step 3 adds ThemeProvider, Step 5 adds WorkspaceProvider. Sequential in Phase C. |
| `src/components/layout/Header.tsx` | 2, 3, 11, 12, 14 | Medium — Created in Step 2, modified by 3 (theme toggle), 11 (auto-save toggle), 12 (search button). Steps 3/11/12 are in different phases. |
| `src/components/layout/EditorArea.tsx` | 2, 7 | Low — Created in Step 2 with placeholder, filled in by Step 7. Different phases. |
| `src/components/layout/Sidebar.tsx` | 2, 6 | Low — Created in Step 2 with placeholder, filled in by Step 6. Different phases. |
| `src/components/editor/MarkdownEditor.tsx` | 7, 8, 9, 10, 11 | **High** — Created in Step 7, modified by 8, 9, 10, 11. See Phase E notes above. |
| `src/contexts/WorkspaceContext.tsx` | 5, 11, 12 | Medium — Created in Step 5, modified by 11 (auto-save setting) and 12 (search index integration). Steps 11/12 are in Phase E/D respectively — **potential conflict if D and E overlap**. Mitigate by ensuring Step 12's context changes are minimal (just adding callback hooks). |
| `vite.config.ts` | 13 | None — Only Step 13 modifies it. |
| `src/index.css` | 3 | None — Only Step 3 modifies it. |

### Recommendations

1. **For a single developer/agent working sequentially:** Follow the steps in order 1→14. The plan is designed to build incrementally with each step producing a testable result.

2. **For 2 agents:** Run the "two-track" approach:
   - **Track A:** Steps 1 → 2 → 3 → 5 → 7 → 8 → 9 → 10 → 11 → 14 (main app flow)
   - **Track B:** Step 4 (after Step 1) → Step 6 (after Step 5) → Step 12 (after Step 5) → Step 13 (after Step 1)
   - Track B handles filesystem, sidebar, full-text search, and PWA while Track A handles layout, theme, state, editor, and editor enhancements.

3. **For 3 agents:** Use the Phase-based approach described above. This is the sweet spot — maximum parallelism with minimal conflict risk.

4. **For 4+ agents:** Diminishing returns. The critical path (Steps 1→2→3→5→7) is inherently sequential. Extra agents only help in Phases B, D, and E.
