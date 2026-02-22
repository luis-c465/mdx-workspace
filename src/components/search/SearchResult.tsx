import { FileText } from 'lucide-react';
import type { SearchResultWithSnippet } from '~/hooks/useWorkspaceSearch';

interface SearchResultProps {
  result: SearchResultWithSnippet;
  onClick: (path: string) => void;
}

export function SearchResult({ result, onClick }: SearchResultProps) {
  const filename = result.path.split('/').pop() || result.path;
  const directory = result.path.substring(0, result.path.lastIndexOf('/')) || '/';

  const handleClick = () => {
    onClick(result.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(result.path);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-3 py-2 hover:border-border hover:bg-accent/70 transition-colors"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {result.icon ? (
          <span className="text-xl leading-none">{result.icon}</span>
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{result.title}</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground truncate">{filename}</span>
        </div>

        {/* Path */}
        <div className="text-xs text-muted-foreground truncate">{directory}</div>

        {/* Snippet */}
        {result.snippet && (
          <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {result.snippet}
          </div>
        )}

        {/* Match count */}
        {result.terms && result.terms.length > 0 && (
          <div className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            Matching: {result.terms.join(', ')}
          </div>
        )}
      </div>

      {/* Score indicator (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="flex-shrink-0 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {result.score.toFixed(2)}
        </div>
      )}
    </div>
  );
}
