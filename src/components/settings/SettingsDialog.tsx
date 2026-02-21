import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { useWorkspace } from '~/contexts/WorkspaceContext';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { state, updateSettings } = useWorkspace();
  const [maxTabsInput, setMaxTabsInput] = useState(String(state.settings.maxOpenTabs));

  useEffect(() => {
    if (open) {
      setMaxTabsInput(String(state.settings.maxOpenTabs));
    }
  }, [open, state.settings.maxOpenTabs]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
      </DialogContent>
    </Dialog>
  );
}
