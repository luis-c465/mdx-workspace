import { EditorSearchBar } from "~/components/editor/search/EditorSearchBar";
import { useEditorSearch } from "~/components/editor/search/searchPlugin";
import { editorRootElementRef$, useCellValue, useRealm, viewMode$ } from "@mdxeditor/editor";
import { useEffect } from "react";
import { createPortal } from "react-dom";
export function canShowSearchTool() {
  return typeof Highlight !== "undefined" && typeof CSS.highlights !== "undefined";
}

export const MdxSearchToolbar = () => {
  const realm = useRealm();
  const editorRootEl = realm.getValue(editorRootElementRef$);

  const {
    prev,
    openSearch,
    next,
    cursor,
    currentRange,
    setSearch,
    ranges,
    replace,
    replaceAll,
    closeSearch,
    isSearchOpen,
  } = useEditorSearch();

  const viewMode = useCellValue(viewMode$);
  useEffect(() => {
    if (!canShowSearchTool() || viewMode !== "rich-text") return;
    const handleSearchKeyboardShortcut = (e: KeyboardEvent) => {
      //cmd+f
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        openSearch();
      }
    };

    //TODO, need a gobal store  so these dont interfere with each other
    document.addEventListener("keydown", handleSearchKeyboardShortcut);
    return () => document.removeEventListener("keydown", handleSearchKeyboardShortcut);
  }, [viewMode]);

  const handleSearchClose = () => {
    const caretRange = currentRange?.cloneRange();

    closeSearch();

    if (caretRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      caretRange.collapse(true);
      selection?.addRange(caretRange);
    } else {
      editorRootEl?.current.focus();
    }
  };

  const handleSearchChange = (searchTerm: string | null) => {
    setSearch(searchTerm);
  };

  return createPortal(
    <EditorSearchBar
      prev={prev}
      next={next}
      cursor={cursor}
      isOpen={isSearchOpen}
      replace={replace}
      replaceAll={replaceAll}
      onClose={handleSearchClose}
      onChange={(searchTerm) => {
        handleSearchChange(searchTerm);
      }}
      matchTotal={ranges.length}
    />,
    document.body
  );
};
