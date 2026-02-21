import { useEffect, useMemo, useState } from 'react';

interface FilePreviewProps {
  path: string;
  handle: FileSystemFileHandle;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

function getExtension(path: string): string {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index).toLowerCase();
}

export function FilePreview({ path, handle }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const extension = useMemo(() => getExtension(path), [path]);
  const isImage = IMAGE_EXTENSIONS.includes(extension);

  useEffect(() => {
    let objectUrl: string | null = null;

    async function loadPreview() {
      setError(null);
      setPreviewUrl(null);

      if (!isImage) {
        setError(`No preview available for ${extension || 'this file type'}.`);
        return;
      }

      try {
        const file = await handle.getFile();
        objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      } catch {
        setError('Failed to load file preview.');
      }
    }

    loadPreview();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [handle, isImage, extension]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-lg rounded-md border bg-card p-4 text-center">
          <p className="font-medium">Cannot preview this file</p>
          <p className="mt-1 text-sm text-muted-foreground">{path}</p>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
      <img src={previewUrl} alt={path} className="max-h-full max-w-full rounded-md border object-contain" />
    </div>
  );
}
