import { Fragment } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Kbd } from '~/components/ui/kbd'
import { ScrollArea } from '~/components/ui/scroll-area'
import { IS_APPLE } from '~/components/editor/search/detectMac'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutRow {
  action: string
  keys: string[]
}

interface ShortcutCategory {
  title: string
  rows: ShortcutRow[]
}

const modifierKey = IS_APPLE ? '⌘' : 'Ctrl'

const shortcutCategories: ShortcutCategory[] = [
  {
    title: 'Navigation',
    rows: [
      { action: 'Open command palette', keys: [modifierKey, 'P'] },
      { action: 'Toggle workspace search', keys: [modifierKey, 'Shift', 'F'] },
      { action: 'Toggle sidebar', keys: [modifierKey, 'B'] },
      { action: 'Toggle sidebar (alternative)', keys: [modifierKey, '\\'] },
    ],
  },
  {
    title: 'Editor Search',
    rows: [
      { action: 'Open in-editor search', keys: [modifierKey, 'F'] },
      { action: 'Next match', keys: ['Enter'] },
      { action: 'Previous match', keys: ['Shift', 'Enter'] },
      { action: 'Replace current match', keys: ['Enter'] },
      { action: 'Replace all matches', keys: [modifierKey, 'Enter'] },
      { action: 'Close search', keys: ['Escape'] },
    ],
  },
]

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>About MDX Workspace</DialogTitle>
          <DialogDescription>
            A local-first markdown and rich-text workspace for writing, organizing, and searching notes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">What this app does</h3>
              <p className="text-sm text-muted-foreground">
                MDX Workspace is a progressive web app for editing markdown files with both markdown and WYSIWYG tools.
                It works directly with local folders using the File System Access API, auto-saves changes, and supports
                fast full-text search across your workspace.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
              {shortcutCategories.map((category) => (
                <div key={category.title} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.title}</h4>
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Action</th>
                          <th className="px-3 py-2 text-left font-medium">Shortcut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.rows.map((shortcut) => (
                          <tr key={`${category.title}-${shortcut.action}`} className="border-t">
                            <td className="px-3 py-2">{shortcut.action}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-1">
                                {shortcut.keys.map((key, index) => (
                                  <Fragment key={`${shortcut.action}-${key}-${index}`}>
                                    {index > 0 && <span className="text-muted-foreground">+</span>}
                                    <Kbd>{key}</Kbd>
                                  </Fragment>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
