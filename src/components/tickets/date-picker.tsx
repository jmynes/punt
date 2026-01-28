'use client'

import { format } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'

interface DatePickerProps {
  value: Date | null
  onChange: (value: Date | null) => void
  placeholder?: string
  disabled?: boolean
  fromYear?: number
  context?: 'ticket-form' | 'filter'
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  fromYear,
  context = 'filter',
}: DatePickerProps) {
  // Calculate the earliest year from all tickets' due dates
  const calendarStartYear = useMemo(() => {
    if (fromYear !== undefined) {
      return fromYear // Use prop if provided
    }

    const { getColumns } = useBoardStore.getState()
    const { activeProjectId } = useUIStore.getState()
    const projectId = activeProjectId || '1'
    const columns = getColumns(projectId)
    let earliestYear = Infinity // Start with infinity to find minimum
    let hasDueDates = false

    // Check all tickets across all columns (including done tickets)
    columns.forEach((column) => {
      column.tickets.forEach((ticket) => {
        if (ticket.dueDate) {
          hasDueDates = true
          // Convert to Date if it's a string (from JSON/API)
          const dueDate = ticket.dueDate instanceof Date ? ticket.dueDate : new Date(ticket.dueDate)
          const ticketYear = dueDate.getFullYear()
          if (ticketYear < earliestYear) {
            earliestYear = ticketYear
          }
        }
      })
    })

    // If we have due dates, use the earliest year found, otherwise use fallback
    return hasDueDates ? earliestYear : 2020
  }, [fromYear])

  // Get max year based on context
  const calendarMaxYear = useMemo(() => {
    if (context === 'ticket-form') {
      const { ticketDateMaxYearMode, ticketDateMaxYear } = useSettingsStore.getState()
      const defaultMaxYear = new Date().getFullYear() + 5
      return ticketDateMaxYearMode === 'default' ? defaultMaxYear : ticketDateMaxYear
    }
    return new Date().getFullYear() + 1
  }, [context])

  return (
    <Popover>
      <div className="relative w-full">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn('w-full justify-start text-left font-normal', !value && 'text-zinc-500')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              {value ? format(value, 'MMM d, yyyy') : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        {value && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onChange(null)
              }
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={(date) => onChange(date || null)}
          numberOfMonths={1}
          initialFocus
          captionLayout="dropdown"
          fromYear={calendarStartYear}
          toYear={calendarMaxYear}
          className="bg-zinc-900"
          classNames={
            value
              ? {
                  // Hide today indicator when a different date is selected
                  today: 'text-foreground',
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  )
}
