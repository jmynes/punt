'use client'

import { Clock } from 'lucide-react'
import type * as React from 'react'
import { forwardRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface TimePickerProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
  value?: string // HH:mm format
  onChange?: (value: string) => void
}

/**
 * TimePicker component for selecting time in HH:mm format.
 * Uses native HTML time input for best cross-browser/device support.
 */
const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className, value, onChange, disabled, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value)
      },
      [onChange],
    )

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
            // Style the time input appearance
            '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer',
          )}
          {...props}
        />
      </div>
    )
  },
)
TimePicker.displayName = 'TimePicker'

export { TimePicker }
