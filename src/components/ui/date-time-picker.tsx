'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export interface DateTimePickerProps {
  value: Date | null
  onChange: (value: Date | null) => void
  placeholder?: string
  disabled?: boolean
  disabledDates?: (date: Date) => boolean
  minuteIncrement?: number
  className?: string
  align?: 'start' | 'center' | 'end'
}

function TimeScrollColumn({
  items,
  selectedValue,
  onSelect,
  disabled,
}: {
  items: { value: number; label: string }[]
  selectedValue: number
  onSelect: (value: number) => void
  disabled?: boolean
}) {
  const selectedRefCallback = useCallback((node: HTMLButtonElement | null) => {
    if (node) {
      requestAnimationFrame(() => {
        node.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      })
    }
  }, [])

  return (
    <div
      className="h-[300px] overflow-y-auto overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col p-2">
        {items.map((item) => (
          <Button
            key={item.value}
            ref={item.value === selectedValue ? selectedRefCallback : undefined}
            size="icon"
            variant={item.value === selectedValue ? 'default' : 'ghost'}
            className="sm:w-full shrink-0 aspect-square"
            onClick={() => onSelect(item.value)}
            disabled={disabled}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time',
  disabled,
  disabledDates,
  minuteIncrement = 15,
  className,
  align = 'start',
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const use24HourTime = useSettingsStore((s) => s.use24HourTime)

  const currentHour = value?.getHours() ?? 9
  const currentMinute = value?.getMinutes() ?? 0
  const currentPeriod = currentHour >= 12 ? 'PM' : 'AM'
  const currentHour12 = currentHour % 12 || 12

  // Build hour items
  const hourItems = use24HourTime
    ? Array.from({ length: 24 }, (_, i) => ({
        value: i,
        label: i.toString().padStart(2, '0'),
      }))
    : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => ({
        value: h,
        label: h.toString(),
      }))

  // Build minute items
  const minuteItems: { value: number; label: string }[] = []
  for (let i = 0; i < 60; i += minuteIncrement) {
    minuteItems.push({ value: i, label: i.toString().padStart(2, '0') })
  }

  // AM/PM items
  const periodItems = [
    { value: 0, label: 'AM' },
    { value: 1, label: 'PM' },
  ]

  const formatDisplay = useCallback(
    (date: Date) => {
      if (use24HourTime) {
        return format(date, "MMM d, yyyy 'at' HH:mm")
      }
      return format(date, "MMM d, yyyy 'at' h:mm a")
    },
    [use24HourTime],
  )

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return
      const result = new Date(date)
      result.setHours(currentHour, currentMinute, 0, 0)
      onChange(result)
    },
    [currentHour, currentMinute, onChange],
  )

  const applyTime = useCallback(
    (hour24: number, minute: number) => {
      const base = value ? new Date(value) : new Date()
      base.setHours(hour24, minute, 0, 0)
      onChange(base)
    },
    [value, onChange],
  )

  const handleHourChange = useCallback(
    (hour: number) => {
      let hour24: number
      if (use24HourTime) {
        hour24 = hour
      } else {
        if (currentPeriod === 'AM') {
          hour24 = hour === 12 ? 0 : hour
        } else {
          hour24 = hour === 12 ? 12 : hour + 12
        }
      }
      applyTime(hour24, currentMinute)
    },
    [use24HourTime, currentPeriod, currentMinute, applyTime],
  )

  const handleMinuteChange = useCallback(
    (minute: number) => {
      applyTime(currentHour, minute)
    },
    [currentHour, applyTime],
  )

  const handlePeriodChange = useCallback(
    (periodValue: number) => {
      const isAM = periodValue === 0
      let hour24: number
      if (isAM) {
        hour24 = currentHour12 === 12 ? 0 : currentHour12
      } else {
        hour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
      }
      applyTime(hour24, currentMinute)
    },
    [currentHour12, currentMinute, applyTime],
  )

  const selectedHour = use24HourTime ? currentHour : currentHour12
  const selectedPeriod = currentPeriod === 'AM' ? 0 : 1

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800',
            !value && 'text-zinc-500',
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDisplay(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-zinc-900 border-zinc-700"
        align={align}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleDateSelect}
            disabled={disabledDates}
          />
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x">
            <TimeScrollColumn
              items={hourItems}
              selectedValue={selectedHour}
              onSelect={handleHourChange}
              disabled={disabled}
            />
            <TimeScrollColumn
              items={minuteItems}
              selectedValue={currentMinute}
              onSelect={handleMinuteChange}
              disabled={disabled}
            />
            {!use24HourTime && (
              <TimeScrollColumn
                items={periodItems}
                selectedValue={selectedPeriod}
                onSelect={handlePeriodChange}
                disabled={disabled}
              />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
