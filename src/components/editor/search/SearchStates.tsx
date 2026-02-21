import { contentEditableRef$ } from "@mdxeditor/editor";
import { Cell, debounceTime } from "@mdxeditor/gurx";

export type TextNodeIndex = {
  allText: string;
  nodeIndex: Node[];
  offsetIndex: number[];
};

export const EmptyTextNodeIndex: TextNodeIndex = {
  allText: "",
  nodeIndex: [],
  offsetIndex: [],
};
export const editorSearchTerm$ = Cell<string>("");
export const editorSearchRanges$ = Cell<Range[]>([]);
export const editorSearchCursor$ = Cell<number>(0);
export const editorSearchTextNodeIndex$ = Cell<TextNodeIndex>(EmptyTextNodeIndex);

export const searchOpen$ = Cell<boolean>(false);
export const editorSearchTermDebounced$ = Cell<string>("", (realm) => {
  realm.link(editorSearchTermDebounced$, realm.pipe(editorSearchTerm$, realm.transformer(debounceTime(250))));
});
export const editorSearchScollableContent$ = Cell<HTMLElement | null>(null, (r) =>
  r.sub(contentEditableRef$, (cref) => {
    return r.pub(editorSearchScollableContent$, cref?.current?.parentNode ?? null);
  })
);
