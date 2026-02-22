import { CircleDot, ExternalLink, Github } from 'lucide-react'

/**
 * Welcome Screen Component
 * Displayed when no file is open in the editor
 */

export function WelcomeScreen() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Welcome to MDX Workspace</h2>
          <p className="text-muted-foreground">
            Open a workspace from the sidebar to start editing your markdown files.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Keyboard Shortcuts</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd+S</kbd>{' '}
              Save file
            </div>
            <div>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd+F</kbd>{' '}
              Search in file
            </div>
            <div>
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd+P</kbd>{' '}
              Quick open file
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Made with ❤️ by Luis Canada</p>
          <p className="inline-flex items-center gap-1">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>
              Powered by{' '}
              <a
                href="https://mdxeditor.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                MDX Editor
              </a>{' '}
              by Petyo Ivanov
            </span>
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://github.com/luis-c465/mdx-workspace"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              Source Code
            </a>
            <a
              href="https://github.com/luis-c465/mdx-workspace/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              <CircleDot className="h-4 w-4" aria-hidden="true" />
              Report an Issue
            </a>
          </div>
          <p className="text-xs">Version {__APP_VERSION__}</p>
        </div>
      </div>
    </div>
  )
}
