import { useEffect, useRef } from 'react'
import { addComposerChild$, realmPlugin, rootEditor$, useCellValue } from '@mdxeditor/editor'
import { $isHeadingNode } from '@lexical/rich-text'
import { $getNodeByKey, $getRoot, $isElementNode, type LexicalNode } from 'lexical'
import { useOutline, type OutlineHeading } from '~/contexts/OutlineContext'

function collectHeadings(): OutlineHeading[] {
  const headings: OutlineHeading[] = []

  const visitNode = (node: LexicalNode) => {
    if ($isHeadingNode(node)) {
      const tag = node.getTag()
      const level = Number(tag[1]) as OutlineHeading['level']
      headings.push({
        key: node.getKey(),
        level,
        text: node.getTextContent(),
      })
    }

    if ($isElementNode(node)) {
      node.getChildren().forEach(visitNode)
    }
  }

  $getRoot().getChildren().forEach(visitNode)

  return headings
}

function headingSignature(headings: OutlineHeading[]): string {
  return headings.map((heading) => `${heading.key}|${heading.level}|${heading.text}`).join('\n')
}

function scrollHeadingIntoViewWithToolbarOffset(headingElement: HTMLElement) {
  const scrollContainer = headingElement.closest('.mdxeditor')

  if (!(scrollContainer instanceof HTMLElement)) {
    headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  const editorShell = scrollContainer.closest('.mdxeditor')
  console.log('Editor shell:', editorShell) // Debug log to check if editorShell is found
  const toolbar = editorShell?.querySelector('.mdxeditor-toolbar')
  const toolbarHeight = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().height : 0
  console.log('Toolbar height:', toolbarHeight)
  const topGap = toolbarHeight + 8

  const containerRect = scrollContainer.getBoundingClientRect()
  const headingRect = headingElement.getBoundingClientRect()
  const delta = headingRect.top - containerRect.top - topGap

  scrollContainer.scrollBy({ top: delta, behavior: 'smooth' })
}

function OutlineSyncer() {
  const rootEditor = useCellValue(rootEditor$)
  const { setHeadings, setScrollToHeading } = useOutline()
  const lastSignatureRef = useRef('')

  useEffect(() => {
    if (!rootEditor) {
      setHeadings([])
      setScrollToHeading(null)
      return
    }

    const publishHeadings = () => {
      rootEditor.getEditorState().read(() => {
        const nextHeadings = collectHeadings()
        const nextSignature = headingSignature(nextHeadings)

        if (nextSignature === lastSignatureRef.current) {
          return
        }

        lastSignatureRef.current = nextSignature
        setHeadings(nextHeadings)
      })
    }

    setScrollToHeading((key: string) => {
      rootEditor.update(() => {
        const headingNode = $getNodeByKey(key)
        if (headingNode) {
          // headingNode.selectStart()
        }
      })

      requestAnimationFrame(() => {
        const headingElement = rootEditor.getElementByKey(key)
        if (!(headingElement instanceof HTMLElement)) {
          return
        }

        scrollHeadingIntoViewWithToolbarOffset(headingElement)
      })
    })

    publishHeadings()

    const unsubscribe = rootEditor.registerUpdateListener(() => {
      publishHeadings()
    })

    return () => {
      unsubscribe()
      lastSignatureRef.current = ''
      setHeadings([])
      setScrollToHeading(null)
    }
  }, [rootEditor, setHeadings, setScrollToHeading])

  return null
}

export const outlinePlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, OutlineSyncer)
  },
})
