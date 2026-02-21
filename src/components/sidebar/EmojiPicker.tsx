/**
 * Emoji Picker Component
 * Simple emoji picker for customizing file icons
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { updateFileIcon } from '~/lib/filesystem';
import type { FileNode } from '~/types/filesystem';

interface EmojiPickerProps {
  node: FileNode;
  onClose: () => void;
}

// Common emojis for file icons
const EMOJIS = [
  '📝', '📄', '📋', '📌', '📎', '🔖', 
  '💡', '⭐', '🎯', '🚀', '📊', '🔧', 
  '🎨', '📚', '🗂️', '📁', '✨', '🔥',
  '💻', '📱', '🌟', '🎉', '🔔', '📢',
  '🏆', '🎪', '🌈', '🎭', '🎬', '🎮',
];

export function EmojiPicker({ node, onClose }: EmojiPickerProps) {
  const { state, refreshTree } = useWorkspace();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSelectEmoji = async (emoji: string) => {
    if (node.kind !== 'file') return;

    setIsUpdating(true);
    
    try {
      // Get the current file content
      const openFile = state.openFiles.find(f => f.path === node.path);
      let content: string;

      if (openFile) {
        // File is open, use current content
        content = openFile.content;
      } else {
        // File is not open, read from disk
        const fileHandle = node.handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        content = await file.text();
      }

      // Update the front-matter with the new icon
      const updatedContent = updateFileIcon(content, emoji);

      if (openFile) {
        // File is open - we need to write directly to disk and then reload
        const fileHandle = node.handle as FileSystemFileHandle;
        const writable = await fileHandle.createWritable();
        await writable.write(updatedContent);
        await writable.close();
        
        // Refresh to update the open file
        await refreshTree();
      } else {
        // Write directly to disk
        const fileHandle = node.handle as FileSystemFileHandle;
        const writable = await fileHandle.createWritable();
        await writable.write(updatedContent);
        await writable.close();
      }

      // Refresh the tree to show the new icon
      await refreshTree();
      
      onClose();
    } catch (error) {
      console.error('Failed to update icon:', error);
      alert('Failed to update file icon. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveIcon = async () => {
    await handleSelectEmoji(''); // Empty string removes the icon
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Icon</DialogTitle>
          <DialogDescription>
            Select an emoji icon for {node.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-8 gap-2 py-4">
          {EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              variant="outline"
              className="h-10 w-10 p-0 text-xl hover:scale-110 transition-transform"
              onClick={() => handleSelectEmoji(emoji)}
              disabled={isUpdating}
            >
              {emoji}
            </Button>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveIcon}
            disabled={isUpdating}
          >
            Remove Icon
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
