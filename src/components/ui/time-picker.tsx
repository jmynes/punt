'use client'

import { Clock } from 'lucide-react'
import type * as React from 'react'
import { forwardRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export interface TimePickerProps extends Omit<React.ComponentProps<'select'>, 'onChange'> {
  value?: string // HH:mm format (24-hour internally)
  onChange?: (value: string) => void
}

/**
 * Format a 24-hour HH:mm value for display based on user preference.
 */
function formatTimeLabel(h: number, m: string, use24Hour: boolean): string {
  if (use24Hour) {
    return `${h.toString().padStart(2, '0')}:${m}`
  }
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m} ${period}`
}

/**
 * TimePicker component for selecting time in HH:mm format.
 * Displays in 12-hour or 24-hour format based on user preference.
 * Internally always stores time in 24-hour HH:mm format.
 */
const TimePicker = forwardRef<HTMLSelectElement, TimePickerProps>(
  ({ className, value, onChange, disabled, ...props }, ref) => {
    const use24HourTime = useSettingsStore((s) => s.use24HourTime)

    const timeOptions = useMemo(() => {
      const options: { value: string; label: string }[] = []
      for (let h = 0; h < 24; h++) {
        for (const m of [0, 15, 30, 45]) {
          const mStr = m.toString().padStart(2, '0')
          const val = `${h.toString().padStart(2, '0')}:${mStr}`
          options.push({ value: val, label: formatTimeLabel(h, mStr, use24HourTime) })
        }
      }
      return options
    }, [use24HourTime])

    // Format current value for display if it doesn't match a preset option
    const isPresetValue = timeOptions.some((opt) => opt.value === value)
    const currentDisplay = (() => {
      if (!value) return ''
      const [h, m] = value.split(':').map(Number)
      return formatTimeLabel(h, m.toString().padStart(2, '0'), use24HourTime)
    })()

    return (
      <div className={cn('relative', className)}>
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none z-10" />
        <select
          ref={ref}
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
          {...props}
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
