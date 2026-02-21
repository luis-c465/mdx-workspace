import { useEffect } from 'react';
import { useWorkspace } from '~/contexts/WorkspaceContext';

/**
 * Hook that refreshes the file tree when the window regains focus.
 * This helps detect external file changes made while the app was in the background.
 */
export function useWindowFocusRefresh() {
  const { refreshTree, state } = useWorkspace();

  useEffect(() => {
    const handleFocus = async () => {
      // Only refresh if a workspace is open
      if (state.rootHandle) {
        try {
          console.log('Window focused - refreshing file tree...');
          await refreshTree();
        } catch (error) {
          console.error('Failed to refresh on window focus:', error);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshTree, state.rootHandle]);
}
