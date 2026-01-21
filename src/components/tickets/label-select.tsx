'use client'

import { Check, ChevronsUpDown, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { LabelSummary } from '@/types'

interface LabelSelectProps {
  value: string[]
  onChange: (value: string[]) => void
  labels: LabelSummary[]
  disabled?: boolean
  projectId?: string
  onCreateLabel?: (name: string) => Promise<LabelSummary | null>
  onDeleteLabel?: (labelId: string) => Promise<void>
}

export function LabelSelect({
  value,
  onChange,
  labels,
  disabled,
  onCreateLabel,
  onDeleteLabel,
}: LabelSelectProps) {
  const [open, setOpen] = useState(false)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined)
  const [searchValue, setSearchValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [labelToDelete, setLabelToDelete] = useState<LabelSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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
    </div>
  )
}
