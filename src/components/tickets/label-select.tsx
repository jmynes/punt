'use client'

import { Check, ChevronsUpDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
}

export function LabelSelect({ value, onChange, labels, disabled }: LabelSelectProps) {
  const [open, setOpen] = useState(false)
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedLabels = labels.filter((l) => value.includes(l.id))

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

  useEffect(() => {
    if (triggerRef.current) {
      setPopoverWidth(triggerRef.current.offsetWidth)
    }
  }, [])

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
          <Command className="bg-transparent">
            <CommandInput placeholder="Search labels..." className="border-zinc-700" />
            <CommandList>
              <CommandEmpty>No labels found.</CommandEmpty>
              <CommandGroup>
                {labels.map((label) => (
                  <CommandItem
                    key={label.id}
                    value={label.name}
                    onSelect={() => toggleLabel(label.id)}
                    className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
                  >
                    <div
                      className="mr-2 h-3 w-3 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span>{label.name}</span>
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        value.includes(label.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
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
    </div>
  )
}
