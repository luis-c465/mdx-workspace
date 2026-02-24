/**
 * Custom Image Dialog Component
 * Replaces the default @mdxeditor/editor image dialog with a shadcn/ui-based modal.
 * Connects to the editor's signal system for state management — receives no props.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
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
import { useWorkspace } from '~/contexts/WorkspaceContext'
import { IMAGE_EXTENSIONS, resolveImagePreviewSrc } from '~/lib/filesystem'
import type { FileNode } from '~/types/filesystem'

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
  /** Autocomplete suggestions from workspace image files */
  localSuggestions: string[]
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

interface ImageSuggestionItemProps {
  suggestion: string
  isSelected: boolean
  isActive: boolean
  onSelect: (value: string) => void
}

function isImagePath(path: string): boolean {
  const lowerPath = path.toLowerCase()
  return IMAGE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))
}

function collectImageSuggestions(nodes: FileNode[]): string[] {
  const suggestions = new Set<string>()

  function visit(currentNodes: FileNode[]) {
    for (const node of currentNodes) {
      if (node.kind === 'directory' && node.children) {
        visit(node.children)
        continue
      }

      if (node.kind === 'file' && isImagePath(node.path)) {
        suggestions.add(`./${node.path}`)
      }
    }
  }

  visit(nodes)

  return Array.from(suggestions).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )
}

function ImageSuggestionItem({ suggestion, isSelected, isActive, onSelect }: ImageSuggestionItemProps) {
  const { state } = useWorkspace()
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let objectUrl: string | null = null

    async function loadPreview() {
      if (!state.rootHandle) {
        setPreviewSrc(null)
        return
      }

      try {
        const resolvedSrc = await resolveImagePreviewSrc(state.rootHandle, suggestion)

        if (!isMounted) {
          if (resolvedSrc.startsWith('blob:')) {
            URL.revokeObjectURL(resolvedSrc)
          }
          return
        }

        if (resolvedSrc.startsWith('blob:')) {
          objectUrl = resolvedSrc
        }

        setPreviewSrc(resolvedSrc)
      } catch (error) {
        console.error('Failed to load image suggestion preview:', error)
        if (isMounted) {
          setPreviewSrc(null)
        }
      }
    }

    loadPreview()

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [state.rootHandle, suggestion])

  return (
    <CommandItem
      value={suggestion}
      className={isActive ? 'bg-accent text-accent-foreground' : undefined}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onSelect={() => onSelect(suggestion)}
    >
      <div className="flex w-full items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate">{suggestion}</span>
        <CheckIcon
          className={`size-4 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    </CommandItem>
  )
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
  localSuggestions,
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

  const [isSrcFocused, setIsSrcFocused] = useState(false)
  const [keyboardSuggestionIndex, setKeyboardSuggestionIndex] = useState<number | null>(null)

  const autocompleteSuggestions = localSuggestions.length > 0
    ? localSuggestions
    : suggestions

  const hasSuggestions = autocompleteSuggestions.length > 0

  /** Filter autocomplete suggestions based on current src input */
  const filteredSuggestions = useMemo(() => {
    if (!hasSuggestions) {
      return []
    }

    return autocompleteSuggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(src.toLowerCase()),
    )
  }, [autocompleteSuggestions, hasSuggestions, src])

  const isAutocompleteOpen = isSrcFocused && filteredSuggestions.length > 0

  const selectedSuggestionIndex = filteredSuggestions.findIndex(
    (suggestion) => suggestion === src,
  )

  const fallbackSuggestionIndex = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0

  const activeSuggestionIndex = keyboardSuggestionIndex != null
    ? Math.min(keyboardSuggestionIndex, Math.max(filteredSuggestions.length - 1, 0))
    : fallbackSuggestionIndex

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
    setKeyboardSuggestionIndex(null)
  }

  function handleSuggestionSelect(value: string) {
    setSrc(value)
    setKeyboardSuggestionIndex(null)
  }

  function handleSrcKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isAutocompleteOpen || filteredSuggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setKeyboardSuggestionIndex((currentIndex) => {
        const baseIndex = currentIndex ?? fallbackSuggestionIndex
        return baseIndex < filteredSuggestions.length - 1
          ? baseIndex + 1
          : 0
      })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setKeyboardSuggestionIndex((currentIndex) => {
        const baseIndex = currentIndex ?? fallbackSuggestionIndex
        return baseIndex > 0
          ? baseIndex - 1
          : filteredSuggestions.length - 1
      })
      return
    }

    if (event.key === 'Tab' && activeSuggestionIndex >= 0) {
      event.preventDefault()
      const suggestion = filteredSuggestions[activeSuggestionIndex]
      if (suggestion) {
        handleSuggestionSelect(suggestion)
      }
      return
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      const suggestion = filteredSuggestions[activeSuggestionIndex]

      if (suggestion && suggestion !== src) {
        event.preventDefault()
        handleSuggestionSelect(suggestion)
      }
    }
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
            ? 'Or enter URL or relative path'
            : 'Image URL or relative path'}
        </label>
        {hasSuggestions ? (
          <Popover open={isAutocompleteOpen}>
            <PopoverAnchor asChild>
              <Input
                id="image-src"
                type="text"
                placeholder="https://example.com/image.png or ./assets/image.png"
                value={src}
                onChange={(e) => handleSrcChange(e.target.value)}
                onFocus={() => {
                  setIsSrcFocused(true)
                  setKeyboardSuggestionIndex(null)
                }}
                onBlur={() => setIsSrcFocused(false)}
                onKeyDown={handleSrcKeyDown}
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
                    {filteredSuggestions.map((suggestion, index) => (
                      <ImageSuggestionItem
                        key={suggestion}
                        suggestion={suggestion}
                        isSelected={src === suggestion}
                        isActive={index === activeSuggestionIndex}
                        onSelect={handleSuggestionSelect}
                      />
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            id="image-src"
            type="text"
            placeholder="https://example.com/image.png or ./assets/image.png"
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
  const { state: workspaceState } = useWorkspace()

  const [state, imageUploadHandler, allowSetImageDimensions, suggestions] =
    useCellValues(
      imageDialogState$,
      imageUploadHandler$,
      allowSetImageDimensions$,
      imageAutocompleteSuggestions$,
    )

  const localSuggestions = useMemo(
    () => collectImageSuggestions(workspaceState.fileTree),
    [workspaceState.fileTree],
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
            localSuggestions={localSuggestions}
            onSave={handleSave}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
