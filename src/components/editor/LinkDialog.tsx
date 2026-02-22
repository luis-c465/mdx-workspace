/**
 * Custom Link Dialog Component
 * Replaces the default @mdxeditor/editor link dialog with shadcn/ui primitives.
 */

import { useState, type FormEvent } from 'react'
import {
  useCellValues,
  usePublisher,
  linkDialogState$,
  updateLink$,
  cancelLinkEdit$,
  removeLink$,
  switchFromPreviewToLinkEdit$,
} from '@mdxeditor/editor'
import { PencilIcon, CopyIcon, CheckIcon, UnlinkIcon, LinkIcon } from 'lucide-react'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '~/components/ui/popover'

interface LinkEditFormProps {
  initialUrl: string
  initialText: string
  withAnchorText: boolean
  onSave: (data: { text: string | undefined; url: string | undefined; title: string | undefined }) => void
  onCancel: () => void
}

interface LinkPreviewProps {
  title: string
  url: string
  rectangle: { top: number; left: number; width: number; height: number }
  onEdit: () => void
  onRemove: () => void
}

function LinkEditForm({
  initialUrl,
  initialText,
  withAnchorText,
  onSave,
  onCancel,
}: LinkEditFormProps) {
  const [url, setUrl] = useState(initialUrl)
  const [text, setText] = useState(initialText)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    onSave({
      url: url.trim() || undefined,
      text: withAnchorText ? text.trim() || undefined : undefined,
      title: undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="link-url" className="text-sm font-medium leading-none">
          URL
        </label>
        <Input
          id="link-url"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          autoFocus
        />
      </div>

      {withAnchorText && (
        <div className="grid gap-2">
          <label htmlFor="link-text" className="text-sm font-medium leading-none">
            Text
          </label>
          <Input
            id="link-text"
            type="text"
            placeholder="Link text"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

function LinkPreview({
  title,
  url,
  rectangle,
  onEdit,
  onRemove,
}: LinkPreviewProps) {
  const [isCopied, setIsCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setIsCopied(true)
      window.setTimeout(() => {
        setIsCopied(false)
      }, 1200)
    } catch (error) {
      console.error('Failed to copy link URL:', error)
    }
  }

  return (
    <Popover open>
      <PopoverAnchor asChild>
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: `${rectangle.top}px`,
            left: `${rectangle.left}px`,
            width: `${rectangle.width}px`,
            height: `${rectangle.height}px`,
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-80 p-2"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Edit link"
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copy link URL"
            onClick={handleCopy}
          >
            {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove link"
            onClick={onRemove}
          >
            <UnlinkIcon className="size-4" />
          </Button>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="ml-1 flex min-w-0 items-center gap-2 text-sm"
            title={title || undefined}
          >
            <LinkIcon className="size-4 shrink-0" />
            <span className="truncate">{url}</span>
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Custom link preview/edit UI for the MDX editor.
 * Wired entirely through @mdxeditor/editor signals — zero props.
 */
export function LinkDialog() {
  const [state] = useCellValues(linkDialogState$)

  const updateLink = usePublisher(updateLink$)
  const cancelLinkEdit = usePublisher(cancelLinkEdit$)
  const removeLink = usePublisher(removeLink$)
  const switchFromPreviewToLinkEdit = usePublisher(switchFromPreviewToLinkEdit$)

  if (state.type === 'inactive') {
    return <></>
  }

  if (state.type === 'preview') {
    return (
      <LinkPreview
        title={state.title}
        url={state.url}
        rectangle={state.rectangle}
        onEdit={() => switchFromPreviewToLinkEdit()}
        onRemove={() => removeLink()}
      />
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          cancelLinkEdit()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Link</DialogTitle>
          <DialogDescription>
            Update the URL and optional anchor text.
          </DialogDescription>
        </DialogHeader>

        <LinkEditForm
          key={state.linkNodeKey}
          initialUrl={state.url}
          initialText={state.text}
          withAnchorText={state.withAnchorText}
          onSave={(data) => updateLink(data)}
          onCancel={() => cancelLinkEdit()}
        />
      </DialogContent>
    </Dialog>
  )
}
