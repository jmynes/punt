'use client'

import { Clock } from 'lucide-react'
import type * as React from 'react'
import { forwardRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export interface TimePickerProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
  value?: string // HH:mm format (24-hour internally)
  onChange?: (value: string) => void
}

/**
 * Convert 24-hour HH:mm to 12-hour h:mm AM/PM display
 */
function to12Hour(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

/**
 * TimePicker component for selecting time in HH:mm format.
 * Displays in 12-hour or 24-hour format based on user preference.
 * Internally always stores time in 24-hour HH:mm format.
 */
const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className, value, onChange, disabled, ...props }, ref) => {
    const use24HourTime = useSettingsStore((s) => s.use24HourTime)

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value)
      },
      [onChange],
    )

    // Generate time options for the select-based 12-hour picker
    const timeOptions = useMemo(() => {
      const options: { value: string; label: string }[] = []
      for (let h = 0; h < 24; h++) {
        for (const m of [0, 15, 30, 45]) {
          const val = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
          const period = h >= 12 ? 'PM' : 'AM'
          const hour12 = h % 12 || 12
          const label = `${hour12}:${m.toString().padStart(2, '0')} ${period}`
          options.push({ value: val, label })
        }
      }
      return options
    }, [])

    // For 24-hour mode, use native time input
    if (use24HourTime) {
      return (
        <div className={cn('relative', className)}>
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          <input
            type="time"
            ref={ref}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              'h-9 w-full min-w-0 rounded-md border bg-transparent pl-10 pr-3 py-1 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none md:text-sm',
              'border-input dark:bg-input/30',
              'placeholder:text-muted-foreground',
              'hover:bg-amber-500/15 hover:border-zinc-600',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:bg-transparent',
              'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
              '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer',
            )}
            {...props}
          />
        </div>
      )
    }

    // For 12-hour mode, use a select with AM/PM labels
    // Check if current value matches a preset option exactly
    const currentDisplay = value ? to12Hour(value) : ''
    const isPresetValue = timeOptions.some((opt) => opt.value === value)

    return (
      <div className={cn('relative', className)}>
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none z-10" />
        <select
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            'h-9 w-full min-w-0 rounded-md border bg-transparent pl-10 pr-3 py-1 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none appearance-none md:text-sm cursor-pointer',
            'border-input dark:bg-input/30',
            'hover:bg-amber-500/15 hover:border-zinc-600',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:bg-transparent',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {!isPresetValue && value && <option value={value}>{currentDisplay}</option>}
          {timeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  },
)
TimePicker.displayName = 'TimePicker'

export { TimePicker }
