/**
 * New Item Input Component
 * Inline input for creating new files or folders
 */

import { useState, useRef, useEffect } from 'react';
import { File, Folder } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { useWorkspace } from '~/contexts/WorkspaceContext';
import { cn } from '~/lib/utils';

interface NewItemInputProps {
  type: 'file' | 'folder';
  parentHandle: FileSystemDirectoryHandle | null;
  onComplete: () => void;
  depth: number;
}

export function NewItemInput({ type, parentHandle, onComplete, depth }: NewItemInputProps) {
  const { createFile, createDirectory } = useWorkspace();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Validate filename
  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Name cannot be empty';
    }

    // Check for invalid characters (OS-specific, but these are common)
    const invalidChars = /[<>:"|?*\\/]/g;
    if (invalidChars.test(value)) {
      return 'Name contains invalid characters';
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(value.toUpperCase())) {
      return 'Reserved name not allowed';
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!parentHandle) {
      onComplete();
      return;
    }

    const trimmedName = name.trim();
    const validationError = validateName(trimmedName);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (type === 'file') {
        // Auto-append .md if no extension
        const fileName = trimmedName.includes('.') ? trimmedName : `${trimmedName}.md`;
        await createFile(parentHandle, fileName);
      } else {
        await createDirectory(parentHandle, trimmedName);
      }
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create item';
      setError(message);
      console.error('Failed to create item:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onComplete();
    }
  };

  return (
    <div style={{ paddingLeft: `${depth * 12 + 8}px` }}>
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span className="shrink-0">
          {type === 'file' ? (
            <File className="h-4 w-4" />
          ) : (
            <Folder className="h-4 w-4" />
          )}
        </span>
        <div className="flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleSubmit}
            placeholder={type === 'file' ? 'filename.md' : 'folder name'}
            className={cn(
              'h-6 text-sm px-1',
              error && 'border-destructive'
            )}
          />
          {error && (
            <p className="text-xs text-destructive mt-0.5">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
