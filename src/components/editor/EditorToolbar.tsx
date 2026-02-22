/**
 * MDX Editor Toolbar Configuration
 * Provides comprehensive toolbar with all formatting and content insertion tools
 */

import {
  DiffSourceToggleWrapper,
  UndoRedo,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  HighlightToggle,
  CodeToggle,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  InsertAdmonition,
  InsertCodeBlock,
  InsertFrontmatter,
  Separator,
  ConditionalContents,
  ChangeCodeMirrorLanguage,
} from '@mdxeditor/editor'
import { MdxSearchToolbar } from './search/MdxEditorSearchToolbar'

export function EditorToolbar() {
  return (
    <DiffSourceToggleWrapper>
      <ConditionalContents
        options={[
          {
            when: (editor) => editor?.editorType === 'codeblock',
            contents: () => <ChangeCodeMirrorLanguage />,
          },
          {
            fallback: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <StrikeThroughSupSubToggles options={['Strikethrough']} />
                <HighlightToggle />
                <CodeToggle />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
                <InsertImage />
                <InsertTable />
                <InsertThematicBreak />
                <Separator />
                <InsertAdmonition />
                <InsertCodeBlock />
                <InsertFrontmatter />
                <Separator />
                {/* Search & Replace Toolbar (Step 10) */}
                <MdxSearchToolbar />
              </>
            ),
          },
        ]}
      />
    </DiffSourceToggleWrapper>
  )
}
