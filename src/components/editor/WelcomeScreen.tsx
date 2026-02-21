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
      </div>
    </div>
  )
}
