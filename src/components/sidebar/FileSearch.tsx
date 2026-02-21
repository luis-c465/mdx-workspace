/**
 * File Search Component
 * Search input with debouncing for filtering file tree
 */

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '~/components/ui/input';

interface FileSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function FileSearch({ value, onChange }: FileSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce the search input (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search files..."
        className="h-8 pl-7"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    </div>
  );
}
