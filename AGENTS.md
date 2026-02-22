# AGENTS.md — MDX Workspace

## Project Overview

Single-package PWA markdown/WYSIWYG editor built with React 19, Vite 7, TypeScript (strict),
Tailwind CSS v4, and shadcn/ui. The editor core is `@mdxeditor/editor` (Lexical-based).
State is managed via React Context + `useReducer` (no external state library).
Storage uses the File System Access API (Chromium-only) and IndexedDB (`idb-keyval`).
Full-text search is powered by MiniSearch. The React Compiler is enabled via Babel plugin.

The `site/` subdirectory is a **separate, unrelated** Next.js documentation project with its
own git repo. Ignore it unless explicitly working on it.

## Build / Lint / Test Commands

```bash
# Development server
npm run dev           # vite dev server

# Production build (type-check then bundle)
npm run build         # tsc -b && vite build

# Lint
npm run lint          # eslint .

# Preview production build
npm run preview       # vite preview
```

### Testing

There is **no CLI test runner** (no Jest, Vitest, etc.). Tests are browser-based utilities
that run in the dev console:

- `src/lib/filesystem-tests.ts` — exports to `window.fsTests`; run `window.fsTests.runAllTests()` in browser console.
- `src/lib/workspace-tests.ts` — runs automatically in dev mode via `import.meta.env.DEV`.

If adding a new feature, validate by running `npm run build` (catches type errors) and
`npm run lint`. Manual testing is done in the browser.

## Code Style Guidelines

### Imports

- **Order**: external libraries, then `~/` alias imports, then relative imports, then CSS/side-effects.
- **Path alias**: use `~/` (maps to `src/`) for cross-directory imports. Use relative paths
  only for siblings/parent within the same feature directory.
- **Type-only imports**: always use `import type` when importing only types.
  Enforced by `verbatimModuleSyntax: true` in tsconfig.
- **Named imports only**: avoid default imports/exports (the sole exception is `App.tsx`).

```typescript
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useWorkspace } from '~/contexts/WorkspaceContext'
import type { FileNode } from '~/types/filesystem'
import { EditorToolbar } from './EditorToolbar'
```

### Formatting

- No Prettier configured — ESLint only (flat config, ESLint 9).
- Single quotes for strings (follow existing files).
- No semicolons at end of statements (follow existing convention in most files;
  some files do use them — match the file you're editing).
- 2-space indentation.

### TypeScript

- **Strict mode** is on: `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`.
- **Target**: ES2022 for app code, ES2023 for node config.
- **`interface`** for object shapes; **`type`** for unions, intersections, and computed types.
- **Explicit return types** on exported async functions (`Promise<T>`).
  Return types on React components and internal helpers are inferred.
- **Avoid `any`**: use generics or `unknown` instead. The only acceptable `any` is in
  generic storage utilities.
- **`erasableSyntaxOnly: true`**: do not use `enum` or `namespace`; use `as const`
  objects or union types instead.

### Naming Conventions

| Element               | Convention     | Examples                                  |
|-----------------------|----------------|-------------------------------------------|
| Functions / variables | camelCase      | `openWorkspace`, `fileTree`, `isLoading`  |
| Boolean variables     | `is`/`has` prefix | `isActive`, `isDirty`, `hasPermission` |
| Types / Interfaces    | PascalCase     | `FileNode`, `WorkspaceState`, `Theme`     |
| React components      | PascalCase     | `MarkdownEditor`, `FileTreeNode`          |
| Primitive constants   | UPPER_CASE     | `MARKDOWN_EXTENSIONS`, `STORAGE_KEY`      |
| Non-primitive constants | camelCase    | `initialState`, `buttonVariants`          |
| Component files       | PascalCase     | `MarkdownEditor.tsx`, `ErrorBoundary.tsx` |
| Hook files            | camelCase + `use` | `useAutoSave.ts`, `useTheme.ts`        |
| Utility/lib files     | camelCase      | `filesystem.ts`, `searchIndex.ts`         |
| Type definition files | camelCase      | `workspace.ts`, `filesystem.ts`           |
| shadcn/ui files       | kebab-case     | `button.tsx`, `context-menu.tsx`          |

### Functions

- Use **`function` declarations** for: components, hooks, exported utility functions.
- Use **arrow functions** for: callbacks, event handlers inside components, inline `.map`/`.filter`.
- Use **`async/await`** everywhere — no `.then()` chains.
- In `useEffect`, use an async IIFE or named async function:
  ```typescript
  useEffect(() => {
    async function loadData() { /* ... */ }
    loadData()
  }, [])
  ```

### Exports

- **Named exports** are the standard. Avoid default exports.
- Barrel files (`index.ts`) are used sparingly — only for `components/search/`.
- Export components, hooks, and utilities directly from their defining file.

### Error Handling

- **try/catch + `console.error` + re-throw** in library/utility functions.
- **`toast.error()`** (sonner) for user-facing errors in context/component layer.
- **`error instanceof Error`** for type narrowing — avoid `as Error` casts.
- **`ErrorBoundary`** wraps the app root (class component in `src/components/ErrorBoundary.tsx`).
- **`window.confirm()`** before destructive operations (delete, close dirty file).
- **`finally`** blocks for cleaning up loading states.

```typescript
try {
  await riskyOperation()
} catch (error) {
  console.error('Failed to do X:', error)
  throw error
}
```

### Comments

- **JSDoc (`/** */`)** on all exported functions, module-level descriptions, and interface fields.
- **Inline `//`** for explaining non-obvious logic and section markers in long functions.
- **`@example`** blocks in hooks and complex utilities.
- Mark incomplete work with `//TODO:` (no space before colon).

### React Patterns

- **React Compiler** is enabled — do not manually wrap with `useMemo`/`useCallback`
  unless there is a specific reason the compiler cannot optimize it.
- **Context + Hook pattern**: contexts export both a Provider component and a `useX()` hook
  from the same file. Example: `WorkspaceContext.tsx` exports `WorkspaceProvider` and `useWorkspace()`.
- **`useReducer`** with discriminated union action types for complex state.
- **`key={filePath}`** pattern to force re-mount components when switching entities.

### Project Structure

```
src/
  components/
    editor/          # Editor feature (MarkdownEditor, EditorToolbar, FilePreview)
      search/        # In-editor search (CSS Highlight API-based)
    layout/          # Layout shells (AppLayout, Header, TabBar, Sidebar)
    sidebar/         # File explorer tree (FileExplorer, FileTreeNode, NewItemInput)
    search/          # Workspace-wide search (MiniSearch-based)
    settings/        # Settings dialog
    ui/              # shadcn/ui primitives — do not manually edit, use `npx shadcn` CLI
  contexts/          # React Context providers + hooks
  hooks/             # Standalone custom hooks
  lib/               # Pure utility modules (no React dependencies)
  types/             # Shared TypeScript type definitions
```

### shadcn/ui

- Style: `new-york`. Icon library: `lucide-react`.
- Add components via: `npx shadcn@latest add <component>`
- Do not manually edit files in `src/components/ui/` — they are generated.
- Config is in `components.json`.

### Key Architectural Notes

- No router — single-page app with conditional rendering based on workspace state.
- File System Access API is Chromium-only (Chrome, Edge).
- Auto-save is debounced at 300ms (`useAutoSave` hook).
- MiniSearch indexes all `.md` files for workspace-wide full-text search.
- PWA with Workbox auto-update strategy (`vite-plugin-pwa`).
