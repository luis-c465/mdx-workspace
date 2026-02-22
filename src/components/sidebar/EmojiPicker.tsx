/**
 * Emoji Picker Component
 * Full emoji picker for customizing file icons
 */

import { EmojiPicker as FrimousseEmojiPicker } from 'frimousse';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { updateFileIcon } from '~/lib/filesystem';
import { cn } from '~/lib/utils';
import type { FileNode } from '~/types/filesystem';

interface EmojiPickerProps {
  node: FileNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function getSingleEmoji(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const graphemes = Array.from(graphemeSegmenter.segment(trimmedValue), ({ segment }) => segment);
  if (graphemes.length !== 1) {
    return null;
  }

  const [candidate] = graphemes;
  return /\p{Extended_Pictographic}/u.test(candidate) ? candidate : null;
}

export function EmojiPicker({ node, open, onOpenChange }: EmojiPickerProps) {
  const { state, refreshTree } = useWorkspace();
  const [isUpdating, setIsUpdating] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState('');

  const customEmoji = useMemo(() => getSingleEmoji(customEmojiInput), [customEmojiInput]);

  const handleSelectEmoji = async (emoji: string) => {
    if (node.kind !== 'file') return;

    setIsUpdating(true);

    try {
      const openFile = state.openFiles.find(f => f.path === node.path);
      let content: string;

      if (openFile) {
        content = openFile.content;
      } else {
        const fileHandle = node.handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        content = await file.text();
      }

      const updatedContent = updateFileIcon(content, emoji);
      const fileHandle = node.handle as FileSystemFileHandle;
      const writable = await fileHandle.createWritable();
      await writable.write(updatedContent);
      await writable.close();

      await refreshTree();
      setCustomEmojiInput('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update icon:', error);
      toast.error('Failed to update file icon', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveIcon = async () => {
    await handleSelectEmoji('');
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCustomEmojiInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-[520px] p-4 sm:max-w-[560px]">
        <DialogHeader className="pb-2 pr-10 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle>Choose Icon</DialogTitle>
              <DialogDescription>Select an emoji icon for {node.name}</DialogDescription>
            </div>

            {node.icon && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleRemoveIcon()}
                disabled={isUpdating}
              >
                Remove Icon
              </Button>
            )}
          </div>
        </DialogHeader>

        <FrimousseEmojiPicker.Root
          className="flex h-[420px] flex-col"
          onEmojiSelect={({ emoji }) => void handleSelectEmoji(emoji)}
          columns={14}
        >
          <FrimousseEmojiPicker.Search
            placeholder="Search emoji"
            className="mb-2 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-hidden transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />

          <FrimousseEmojiPicker.Viewport className="relative flex-1 overflow-y-auto pr-1">
            <FrimousseEmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading emoji...
            </FrimousseEmojiPicker.Loading>

            <FrimousseEmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {({ search }) => (search ? `No emoji found for "${search}"` : 'No emoji found.')}
            </FrimousseEmojiPicker.Empty>

            <FrimousseEmojiPicker.List
              className="pb-2"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    {...props}
                    className="sticky top-0 z-10 bg-popover px-1 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ ...props }) => (
                  <div
                    {...props}
                    className={cn(props.className, 'flex w-full justify-start gap-1 px-1')}
                  />
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    {...props}
                    className={cn(
                      props.className,
                      'flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground'
                    )}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </FrimousseEmojiPicker.Viewport>

          <div className="mt-2 space-y-2 border-t pt-2">
            <p className="text-xs text-muted-foreground">Skin tone for supported emoji</p>
            <FrimousseEmojiPicker.SkinTone emoji="👍">
              {({ skinTone, setSkinTone, skinToneVariations }) => (
                <div className="flex flex-wrap items-center gap-2">
                  {skinToneVariations.map((variation) => (
                    <Button
                      key={variation.skinTone}
                      type="button"
                      variant={variation.skinTone === skinTone ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSkinTone(variation.skinTone)}
                      className="h-8 min-w-8 px-2"
                      disabled={isUpdating}
                    >
                      {variation.emoji}
                    </Button>
                  ))}
                </div>
              )}
            </FrimousseEmojiPicker.SkinTone>
          </div>
        </FrimousseEmojiPicker.Root>

        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs text-muted-foreground">Type or paste your own emoji</p>
          <div className="flex items-center gap-2">
            <Input
              value={customEmojiInput}
              onChange={(event) => setCustomEmojiInput(event.target.value)}
              placeholder="Type an emoji"
              disabled={isUpdating}
              maxLength={12}
            />

            <div className="flex h-9 w-9 items-center justify-center rounded-md border text-lg">
              {customEmoji ?? '•'}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => customEmoji && void handleSelectEmoji(customEmoji)}
              disabled={!customEmoji || isUpdating}
            >
              Use
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
