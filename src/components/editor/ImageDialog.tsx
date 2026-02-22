/**
 * Custom Image Dialog Component
 * Replaces the default @mdxeditor/editor image dialog with a shadcn/ui-based modal.
 * Connects to the editor's signal system for state management — receives no props.
 */

import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import {
  useCellValues,
  usePublisher,
  imageDialogState$,
  saveImage$,
  closeImageDialog$,
  imageUploadHandler$,
  allowSetImageDimensions$,
  imageAutocompleteSuggestions$,
} from '@mdxeditor/editor'
import type { ImageUploadHandler } from '@mdxeditor/editor'
import { ImageIcon, UploadIcon, CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '~/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '~/components/ui/command'

/** Initial form values derived from the dialog state */
interface ImageFormValues {
  src: string
  altText: string
  title: string
  width: string
  height: string
}

interface ImageFormProps {
  /** Pre-filled values (empty strings for new images) */
  initialValues: ImageFormValues
  /** Whether we are editing an existing image vs inserting a new one */
  isEditing: boolean
  /** Whether a file upload handler is configured */
  imageUploadHandler: ImageUploadHandler
  /** Whether to show width/height fields */
  allowSetImageDimensions: boolean
  /** URL autocomplete suggestions */
  suggestions: string[]
  /** Called with form data on submit */
  onSave: (data: {
    src?: string
    altText?: string
    title?: string
    width?: number
    height?: number
    file?: FileList
  }) => void
  /** Called to close the dialog */
  onClose: () => void
}

function isSvgSource(src: string): boolean {
  const normalized = src.trim().toLowerCase()
  const withoutQuery = normalized.split('#')[0]?.split('?')[0] ?? normalized
  return withoutQuery.endsWith('.svg') || normalized.startsWith('data:image/svg+xml')
}

/**
 * Inner form component — receives initial values as props so state resets
 * naturally when the parent re-keys it (avoids setState-in-effect).
 */
function ImageForm({
  initialValues,
  isEditing,
  imageUploadHandler,
  allowSetImageDimensions,
  suggestions,
  onSave,
  onClose,
}: ImageFormProps) {
  const [src, setSrc] = useState(initialValues.src)
  const [altText, setAltText] = useState(initialValues.altText)
  const [title, setTitle] = useState(initialValues.title)
  const [width, setWidth] = useState(initialValues.width)
  const [height, setHeight] = useState(initialValues.height)
  const [file, setFile] = useState<FileList | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Autocomplete popover state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)

  const hasSuggestions = suggestions.length > 0

  /** Filter autocomplete suggestions based on current src input */
  const filteredSuggestions = hasSuggestions
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(src.toLowerCase()),
      )
    : []

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (src && isSvgSource(src)) {
      toast.error('SVG images are not supported')
      return
    }

    const widthNum = width ? Number(width) : undefined
    const heightNum = height ? Number(height) : undefined

    onSave({
      src: src || undefined,
      altText: altText || undefined,
      title: title || undefined,
      ...(allowSetImageDimensions
        ? { width: widthNum, height: heightNum }
        : {}),
      ...(file ? { file } : {}),
    })
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files)
  }

  function handleSrcChange(value: string) {
    setSrc(value)
    if (hasSuggestions && value.length > 0) {
      const matches = suggestions.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase()),
      )
      setIsAutocompleteOpen(matches.length > 0)
    } else {
      setIsAutocompleteOpen(false)
    }
  }

  function handleSuggestionSelect(value: string) {
    setSrc(value)
    setIsAutocompleteOpen(false)
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {/* File upload — only when imageUploadHandler is configured */}
      {imageUploadHandler !== null && (
        <div className="grid gap-2">
          <label
            htmlFor="image-file"
            className="text-sm font-medium leading-none"
          >
            <span className="flex items-center gap-1.5">
              <UploadIcon className="size-3.5" />
              Upload from device
            </span>
          </label>
          <Input
            ref={fileInputRef}
            id="image-file"
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Image URL with optional autocomplete */}
      <div className="grid gap-2">
        <label
          htmlFor="image-src"
          className="text-sm font-medium leading-none"
        >
          {imageUploadHandler !== null
            ? 'Or add from URL'
            : 'Image URL'}
        </label>
        {hasSuggestions ? (
          <Popover
            open={isAutocompleteOpen}
            onOpenChange={setIsAutocompleteOpen}
          >
            <PopoverAnchor asChild>
              <Input
                id="image-src"
                type="url"
                placeholder="https://example.com/image.png"
                value={src}
                onChange={(e) => handleSrcChange(e.target.value)}
                onFocus={() => {
                  if (filteredSuggestions.length > 0) {
                    setIsAutocompleteOpen(true)
                  }
                }}
                autoComplete="off"
              />
            </PopoverAnchor>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Command>
                <CommandList>
                  <CommandEmpty>No matching URLs</CommandEmpty>
                  <CommandGroup>
                    {filteredSuggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion}
                        value={suggestion}
                        onSelect={handleSuggestionSelect}
                      >
                        <CheckIcon
                          className={`size-4 ${src === suggestion ? 'opacity-100' : 'opacity-0'}`}
                        />
                        <span className="truncate">{suggestion}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            id="image-src"
            type="url"
            placeholder="https://example.com/image.png"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
          />
        )}
      </div>

      {/* Alt text */}
      <div className="grid gap-2">
        <label
          htmlFor="image-alt"
          className="text-sm font-medium leading-none"
        >
          Alt text
        </label>
        <Input
          id="image-alt"
          type="text"
          placeholder="Descriptive text for the image"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
        />
      </div>

      {/* Title */}
      <div className="grid gap-2">
        <label
          htmlFor="image-title"
          className="text-sm font-medium leading-none"
        >
          Title
        </label>
        <Input
          id="image-title"
          type="text"
          placeholder="Image title (shown on hover)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Dimensions — only when allowSetImageDimensions is true */}
      {allowSetImageDimensions && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label
              htmlFor="image-width"
              className="text-sm font-medium leading-none"
            >
              Width
            </label>
            <Input
              id="image-width"
              type="number"
              min={0}
              placeholder="Auto"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor="image-height"
              className="text-sm font-medium leading-none"
            >
              Height
            </label>
            <Input
              id="image-height"
              type="number"
              min={0}
              placeholder="Auto"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          {isEditing ? 'Save' : 'Insert'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Custom image insertion/editing dialog for the MDX editor.
 * Wired entirely through @mdxeditor/editor signals — zero props.
 *
 * Uses a key-based remount strategy to reset form state when the dialog
 * opens in a new mode, avoiding setState-in-effect patterns.
 *
 * @example
 * ```tsx
 * imagePlugin({
 *   ImageDialog: ImageDialog,
 *   allowSetImageDimensions: true,
 * })
 * ```
 */
export function ImageDialog() {
  const [state, imageUploadHandler, allowSetImageDimensions, suggestions] =
    useCellValues(
      imageDialogState$,
      imageUploadHandler$,
      allowSetImageDimensions$,
      imageAutocompleteSuggestions$,
    )

  const saveImage = usePublisher(saveImage$)
  const closeImageDialog = usePublisher(closeImageDialog$)

  const isOpen = state.type !== 'inactive'
  const isEditing = state.type === 'editing'

  // Derive initial form values from state (computed per render, no effect needed)
  const initialValues: ImageFormValues =
    state.type === 'editing'
      ? {
          src: state.initialValues.src ?? '',
          altText: state.initialValues.altText ?? '',
          title: state.initialValues.title ?? '',
          width: state.initialValues.width != null ? String(state.initialValues.width) : '',
          height: state.initialValues.height != null ? String(state.initialValues.height) : '',
        }
      : { src: '', altText: '', title: '', width: '', height: '' }

  // Build a key that changes when the dialog mode/target changes,
  // causing ImageForm to remount and reset its local state
  const formKey =
    state.type === 'editing'
      ? `editing-${state.nodeKey}`
      : state.type

  function handleSave(data: {
    src?: string
    altText?: string
    title?: string
    width?: number
    height?: number
    file?: FileList
  }) {
    saveImage(data)
    closeImageDialog()
  }

  function handleClose() {
    closeImageDialog()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            {isEditing ? 'Edit Image' : 'Insert Image'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the image properties below.'
              : 'Add an image from a URL or upload from your device.'}
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <ImageForm
            key={formKey}
            initialValues={initialValues}
            isEditing={isEditing}
            imageUploadHandler={imageUploadHandler}
            allowSetImageDimensions={allowSetImageDimensions}
            suggestions={suggestions}
            onSave={handleSave}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
