'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Palette, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { labelKeys } from '@/hooks/queries/use-labels'
import { LABEL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { LabelSummary } from '@/types'

interface LabelSelectProps {
  value: string[]
  onChange: (value: string[]) => void
  labels: LabelSummary[]
  disabled?: boolean
  projectId?: string
  onCreateLabel?: (name: string) => Promise<LabelSummary | null>
  onUpdateLabel?: (labelId: string, color: string) => Promise<void>
  onDeleteLabel?: (labelId: string) => Promise<void>
}

export function LabelSelect({
  value,
  onChange,
  labels,
  disabled,
  projectId,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: LabelSelectProps) {
  const [open, setOpen] = useState(false)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined)
  const [searchValue, setSearchValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [labelToDelete, setLabelToDelete] = useState<LabelSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [labelToEdit, setLabelToEdit] = useState<LabelSummary | null>(null)
  const [customColor, setCustomColor] = useState('')
  const [isUpdatingColor, setIsUpdatingColor] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedLabels = labels.filter((l) => value.includes(l.id))

  // Find case-insensitive match for search value
  const findExistingLabel = useCallback(
    (name: string) => {
      const normalizedName = name.toLowerCase().trim()
      return labels.find((l) => l.name.toLowerCase() === normalizedName)
    },
    [labels],
  )

  // Check if the search value matches an existing label (case-insensitive)
  const existingMatch = searchValue.trim() ? findExistingLabel(searchValue) : null
  const canCreateLabel = onCreateLabel && searchValue.trim().length > 0 && !existingMatch

  const toggleLabel = (labelId: string) => {
    if (value.includes(labelId)) {
      onChange(value.filter((id) => id !== labelId))
    } else {
      onChange([...value, labelId])
    }
  }

  const removeLabel = (labelId: string) => {
    onChange(value.filter((id) => id !== labelId))
  }

  const handleCreateLabel = useCallback(
    async (name: string) => {
      if (!onCreateLabel || isCreating) return

      const trimmedName = name.trim()
      if (!trimmedName) return

      // Check if label already exists (case-insensitive)
      const existing = findExistingLabel(trimmedName)
      if (existing) {
        // Select existing label if not already selected
        if (!value.includes(existing.id)) {
          onChange([...value, existing.id])
        }
        setSearchValue('')
        return
      }

      setIsCreating(true)
      try {
        const newLabel = await onCreateLabel(trimmedName)
        if (newLabel) {
          // Select the newly created label
          onChange([...value, newLabel.id])
          setSearchValue('')
        }
      } finally {
        setIsCreating(false)
      }
    },
    [onCreateLabel, isCreating, findExistingLabel, value, onChange],
  )

  const handleDeleteLabel = useCallback(async () => {
    if (!onDeleteLabel || !labelToDelete || isDeleting) return

    setIsDeleting(true)
    try {
      await onDeleteLabel(labelToDelete.id)
      // Remove from selection if it was selected
      if (value.includes(labelToDelete.id)) {
        onChange(value.filter((id) => id !== labelToDelete.id))
      }
    } finally {
      setIsDeleting(false)
      setLabelToDelete(null)
    }
  }, [onDeleteLabel, labelToDelete, isDeleting, value, onChange])

  const handleColorChange = useCallback(
    async (color: string) => {
      if (!onUpdateLabel || !labelToEdit || isUpdatingColor) return

      setIsUpdatingColor(true)
      try {
        await onUpdateLabel(labelToEdit.id, color)
        setLabelToEdit(null)
        setCustomColor('')
      } finally {
        setIsUpdatingColor(false)
      }
    },
    [onUpdateLabel, labelToEdit, isUpdatingColor],
  )

  const openColorPicker = useCallback((label: LabelSummary) => {
    setLabelToEdit(label)
    setCustomColor(label.color)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle comma separator for creating labels
      if (e.key === ',' || e.key === 'Enter') {
        const trimmedSearch = searchValue.trim()
        if (trimmedSearch) {
          e.preventDefault()

          // Check for existing match first
          const existing = findExistingLabel(trimmedSearch)
          if (existing) {
            if (!value.includes(existing.id)) {
              onChange([...value, existing.id])
            }
            setSearchValue('')
          } else if (onCreateLabel) {
            // Create new label
            handleCreateLabel(trimmedSearch)
          }
        }
      }
    },
    [searchValue, findExistingLabel, value, onChange, onCreateLabel, handleCreateLabel],
  )

  useEffect(() => {
    if (triggerRef.current) {
      setPopoverWidth(triggerRef.current.offsetWidth)
    }
  }, [])

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure popover is rendered
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    } else {
      setSearchValue('')
    }
  }, [open])

  // Filter labels based on search (case-insensitive)
  const filteredLabels = searchValue.trim()
    ? labels.filter((l) => l.name.toLowerCase().includes(searchValue.toLowerCase().trim()))
    : labels

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between text-left"
          >
            <span className="text-zinc-500 text-left">
              {selectedLabels.length > 0
                ? `${selectedLabels.length} label(s) selected`
                : 'Select labels...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 bg-zinc-900 border-zinc-700"
          align="start"
          style={popoverWidth ? { width: `${popoverWidth}px` } : undefined}
        >
          <Command className="bg-transparent" shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              placeholder={onCreateLabel ? 'Search or create labels...' : 'Search labels...'}
              className="border-zinc-700"
              value={searchValue}
              onValueChange={setSearchValue}
              onKeyDown={handleKeyDown}
            />
            <CommandList>
              {filteredLabels.length === 0 && !canCreateLabel && (
                <CommandEmpty>No labels found.</CommandEmpty>
              )}
              {canCreateLabel && (
                <CommandGroup>
                  <CommandItem
                    value={`create-${searchValue}`}
                    onSelect={() => handleCreateLabel(searchValue)}
                    className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
                    disabled={isCreating}
                  >
                    <Plus className="mr-2 h-4 w-4 text-green-500" />
                    <span>{isCreating ? 'Creating...' : `Create "${searchValue.trim()}"`}</span>
                  </CommandItem>
                </CommandGroup>
              )}
              {filteredLabels.length > 0 && (
                <CommandGroup heading={canCreateLabel ? 'Existing labels' : undefined}>
                  {filteredLabels.map((label) => (
                    <CommandItem
                      key={label.id}
                      value={label.name}
                      onSelect={() => toggleLabel(label.id)}
                      className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100 group"
                    >
                      <div
                        className="mr-2 h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="flex-1 truncate">{label.name}</span>
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          value.includes(label.id) ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {onUpdateLabel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openColorPicker(label)
                          }}
                          className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-zinc-200 transition-all shrink-0"
                          title="Change color"
                        >
                          <Palette className="h-3 w-3" />
                        </button>
                      )}
                      {onDeleteLabel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLabelToDelete(label)
                          }}
                          className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/30 hover:text-red-400 transition-all shrink-0"
                          title="Delete label"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected labels display */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              className="pr-1"
              style={{
                borderColor: label.color,
                color: label.color,
                backgroundColor: `${label.color}20`,
              }}
            >
              {label.name}
              <button
                type="button"
                onClick={() => removeLabel(label.id)}
                className="ml-1 rounded-full hover:bg-red-500/30 hover:text-red-300 p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!labelToDelete} onOpenChange={(open) => !open && setLabelToDelete(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete label?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete the label{' '}
              <span
                className="font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: labelToDelete?.color,
                  backgroundColor: `${labelToDelete?.color}20`,
                }}
              >
                {labelToDelete?.name}
              </span>
              ? This will remove it from all tickets that use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLabel}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Color picker dialog */}
      <AlertDialog
        open={!!labelToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setLabelToEdit(null)
            setCustomColor('')
          }
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Change label color</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Choose a color for the label{' '}
              <span
                className="font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: labelToEdit?.color,
                  backgroundColor: `${labelToEdit?.color}20`,
                }}
              >
                {labelToEdit?.name}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ColorPickerBody
            activeColor={customColor || labelToEdit?.color || '#000000'}
            onColorChange={setCustomColor}
            onApply={(color) => {
              if (/^#[0-9A-Fa-f]{6}$/i.test(color)) {
                handleColorChange(color)
              }
            }}
            isDisabled={isUpdatingColor}
            projectId={projectId}
          />

          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              disabled={isUpdatingColor}
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Shared color picker body with preset palette, saved custom colors,
 * spectrum picker, and hex input. Used by label color picker and avatar color picker.
 */
interface ColorPickerBodyProps {
  activeColor: string
  onColorChange: (color: string) => void
  /** @deprecated No longer used - colors apply immediately via onColorChange */
  onApply?: (color: string) => void
  isDisabled?: boolean
  /** Additional preset colors to show (e.g. column auto-detected colors) */
  extraPresets?: string[]
  /** Project ID for checking color usage when removing saved colors */
  projectId?: string
}

export function ColorPickerBody({
  activeColor,
  onColorChange,
  isDisabled,
  extraPresets,
  projectId,
}: ColorPickerBodyProps) {
  const { customColors, addCustomColor, removeCustomColor } = useSettingsStore()
  const { getColumns } = useBoardStore()
  const queryClient = useQueryClient()
  const [localHex, setLocalHex] = useState(activeColor)

  // Sync local hex when activeColor changes from outside (e.g. spectrum drag)
  useEffect(() => {
    setLocalHex(activeColor)
  }, [activeColor])

  const currentColor = activeColor

  const handleSaveColor = () => {
    if (/^#[0-9A-Fa-f]{6}$/i.test(currentColor)) {
      addCustomColor(currentColor)
    }
  }

  // Handle removing a saved color with usage check
  const handleRemoveColor = useCallback(
    (color: string) => {
      // First remove the color from saved swatches
      removeCustomColor(color)

      // Check if the color is in use by columns or labels in the current project
      if (!projectId) return

      const normalizedColor = color.toLowerCase()
      let columnCount = 0
      let labelCount = 0

      // Check columns from board store
      const columns = getColumns(projectId)
      for (const col of columns) {
        if (col.color?.toLowerCase() === normalizedColor) {
          columnCount++
        }
      }

      // Check labels from React Query cache
      const cachedLabels = queryClient.getQueryData<LabelSummary[]>(labelKeys.byProject(projectId))
      if (cachedLabels) {
        for (const label of cachedLabels) {
          if (label.color.toLowerCase() === normalizedColor) {
            labelCount++
          }
        }
      }

      // Show info toast if color is in use
      if (columnCount > 0 || labelCount > 0) {
        const parts: string[] = []
        if (columnCount > 0) {
          parts.push(`${columnCount} column${columnCount > 1 ? 's' : ''}`)
        }
        if (labelCount > 0) {
          parts.push(`${labelCount} label${labelCount > 1 ? 's' : ''}`)
        }
        toast.info(
          `This color is used by ${parts.join(' and ')}. They'll keep their color — this only removes it from your saved swatches.`,
        )
      }
    },
    [projectId, getColumns, queryClient, removeCustomColor],
  )

  // Merge extra presets (deduplicated) with standard label colors
  const labelColorsLower = new Set(LABEL_COLORS.map((c) => c.toLowerCase()))
  const dedupedExtras = (extraPresets ?? []).filter(
    (c) => c && !labelColorsLower.has(c.toLowerCase()),
  )
  const allPresets = [...dedupedExtras, ...LABEL_COLORS]

  const isCurrentColorSaved =
    customColors.includes(currentColor.toLowerCase()) ||
    allPresets.some((c) => c.toLowerCase() === currentColor.toLowerCase())

  return (
    <div className="space-y-4 py-2">
      {/* Predefined color palette */}
      <div>
        <div className="text-xs text-zinc-500 mb-1.5">Presets</div>
        <div className="flex flex-wrap gap-2">
          {allPresets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              disabled={isDisabled}
              className={cn(
                'h-8 w-8 rounded-md transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed',
                currentColor.toLowerCase() === color.toLowerCase() &&
                  'ring-2 ring-white ring-offset-2 ring-offset-zinc-950',
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Custom saved colors */}
      {customColors.length > 0 && (
        <div>
          <div className="text-xs text-zinc-500 mb-1.5">Saved</div>
          <div className="flex flex-wrap gap-2">
            {customColors.map((color) => (
              <div key={color} className="relative group/swatch">
                <button
                  type="button"
                  onClick={() => onColorChange(color)}
                  disabled={isDisabled}
                  className={cn(
                    'h-8 w-8 rounded-md transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed border border-dashed border-zinc-600',
                    currentColor.toLowerCase() === color.toLowerCase() &&
                      'ring-2 ring-white ring-offset-2 ring-offset-zinc-950',
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveColor(color)
                  }}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-400 hover:bg-red-900 hover:text-red-300 hover:border-red-700 opacity-0 group-hover/swatch:opacity-100 transition-opacity flex items-center justify-center"
                  title="Remove saved color"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full color picker */}
      <HexColorPicker
        color={currentColor}
        onChange={onColorChange}
        className="!w-full"
        style={{ height: '160px' }}
      />

      {/* Hex input with preview and save to swatches */}
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-md border border-zinc-700 shrink-0"
          style={{ backgroundColor: currentColor }}
        />
        <Input
          type="text"
          placeholder="#000000"
          value={localHex}
          onChange={(e) => {
            const val = e.target.value
            if (val === '' || /^#?[0-9A-Fa-f]{0,6}$/.test(val)) {
              const hex = val.startsWith('#') ? val : `#${val}`
              setLocalHex(hex)
              if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                onColorChange(hex)
              }
            }
          }}
          className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 font-mono"
          disabled={isDisabled}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-zinc-700 hover:bg-zinc-800 shrink-0 gap-1.5"
          onClick={handleSaveColor}
          disabled={isDisabled || isCurrentColorSaved || !/^#[0-9A-Fa-f]{6}$/i.test(currentColor)}
          title={isCurrentColorSaved ? 'Already in swatches' : 'Save to swatches'}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">Save</span>
        </Button>
      </div>
    </div>
  )
}
