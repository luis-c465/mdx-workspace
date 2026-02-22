import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { useWorkspace } from '~/contexts/WorkspaceContext';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { state, updateSettings } = useWorkspace();
  const [maxTabsInput, setMaxTabsInput] = useState(String(state.settings.maxOpenTabs));
  const [autoSaveDelayInput, setAutoSaveDelayInput] = useState(String(state.settings.autoSaveDelay));

  const handleMaxTabsChange = async (value: string) => {
    setMaxTabsInput(value);
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      await updateSettings({ maxOpenTabs: parsed });
    }
    if (value.trim() === '') {
      await updateSettings({ maxOpenTabs: 0 });
    }
  };

  const handleAutoSaveDelayChange = async (value: string) => {
    setAutoSaveDelayInput(value);
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 100) {
      await updateSettings({ autoSaveDelay: parsed });
    }
    if (value.trim() === '') {
      await updateSettings({ autoSaveDelay: 300 });
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setMaxTabsInput(String(state.settings.maxOpenTabs));
      setAutoSaveDelayInput(String(state.settings.autoSaveDelay));
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure workspace behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="max-open-tabs" className="text-sm font-medium">
            Maximum open tabs
          </label>
          <Input
            id="max-open-tabs"
            type="number"
            min={0}
            value={maxTabsInput}
            onChange={(event) => {
              void handleMaxTabsChange(event.target.value);
            }}
          />
          <p className="text-sm text-muted-foreground">
            Set to 0 for unlimited tabs. When the limit is reached, the least recently used tab is auto-saved and closed.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="auto-save-delay" className="text-sm font-medium">
            Auto-save delay (ms)
          </label>
          <Input
            id="auto-save-delay"
            type="number"
            min={100}
            step={100}
            value={autoSaveDelayInput}
            onChange={(event) => {
              void handleAutoSaveDelayChange(event.target.value);
            }}
          />
          <p className="text-sm text-muted-foreground">
            Time of inactivity before auto-saving. Minimum 100ms.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div>
            <label htmlFor="auto-save-notify" className="text-sm font-medium">
              Save notifications
            </label>
            <p className="text-sm text-muted-foreground">
              Show a notification after saving a file.
            </p>
          </div>
          <Switch
            id="auto-save-notify"
            checked={state.settings.autoSaveNotify}
            onCheckedChange={(checked) => {
              void updateSettings({ autoSaveNotify: checked });
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
