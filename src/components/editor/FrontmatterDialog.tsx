/**
 * Custom Frontmatter Dialog Component
 * Replaces the default @mdxeditor/editor frontmatter dialog with shadcn/ui primitives.
 */

import { useMemo } from 'react'
import {
  useCellValues,
  usePublisher,
  frontmatterDialogOpen$,
  removeFrontmatter$,
  readOnly$,
} from '@mdxeditor/editor'
import YamlParser from 'js-yaml'
import { useFieldArray, useForm } from 'react-hook-form'
import { Trash2Icon } from 'lucide-react'

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

interface FrontmatterDialogProps {
  yaml: string
  onChange: (yaml: string) => void
}

interface FrontmatterEntry {
  key: string
  value: string
}

interface FrontmatterFormValues {
  yamlConfig: FrontmatterEntry[]
}

function stringifyEntryValue(value: unknown): string {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  return YamlParser.dump(value).trim()
}

function parseYamlConfig(yaml: string): FrontmatterEntry[] {
  if (!yaml.trim()) {
    return []
  }

  try {
    const parsed = YamlParser.load(yaml)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return []
    }

    return Object.entries(parsed).map(([key, value]) => ({
      key,
      value: stringifyEntryValue(value),
    }))
  } catch (error) {
    console.error('Failed to parse frontmatter YAML:', error)
    return []
  }
}

function parseEntryValue(value: string): unknown {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  try {
    return YamlParser.load(trimmedValue)
  } catch {
    return value
  }
}

/**
 * Custom frontmatter editor for the MDX editor plugin.
 */
export function FrontmatterDialog({ yaml, onChange }: FrontmatterDialogProps) {
  const [isOpen, readOnly] = useCellValues(frontmatterDialogOpen$, readOnly$)
  const setFrontmatterDialogOpen = usePublisher(frontmatterDialogOpen$)
  const removeFrontmatter = usePublisher(removeFrontmatter$)

  const yamlConfig = useMemo(() => parseYamlConfig(yaml), [yaml])

  const { control, register, handleSubmit } = useForm<FrontmatterFormValues>({
    defaultValues: {
      yamlConfig,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'yamlConfig',
  })

  function handleClose() {
    setFrontmatterDialogOpen(false)
  }

  function handleSave(values: FrontmatterFormValues) {
    const normalizedEntries = values.yamlConfig
      .map(({ key, value }) => ({ key: key.trim(), value }))
      .filter(({ key, value }) => key.length > 0 && value.trim().length > 0)

    if (normalizedEntries.length === 0) {
      removeFrontmatter()
      setFrontmatterDialogOpen(false)
      return
    }

    const nextYaml = normalizedEntries.reduce<Record<string, unknown>>((acc, { key, value }) => {
      acc[key] = parseEntryValue(value)
      return acc
    }, {})

    onChange(YamlParser.dump(nextYaml).trim())
    setFrontmatterDialogOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setFrontmatterDialogOpen}>
      <DialogContent className="sm:max-w-xl" data-editor-type="frontmatter">
        <DialogHeader>
          <DialogTitle>Edit document frontmatter</DialogTitle>
          <DialogDescription>
            Add or update YAML key-value pairs used as document metadata.
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <form key={yaml} onSubmit={handleSubmit(handleSave)} className="grid gap-4">
            <div className="grid gap-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2">
                  <Input
                    {...register(`yamlConfig.${index}.key`)}
                    placeholder="Key"
                    autoFocus={index === 0}
                    disabled={readOnly}
                  />
                  <Input
                    {...register(`yamlConfig.${index}.value`)}
                    placeholder="Value"
                    disabled={readOnly}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete entry"
                    onClick={() => remove(index)}
                    disabled={readOnly}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ key: '', value: '' })}
                disabled={readOnly}
              >
                Add entry
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={readOnly}>
                Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
