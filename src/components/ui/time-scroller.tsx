'use client'

import { Clock } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'

export interface TimeScrollerProps {
  value: string // HH:mm (24h internally)
  onChange: (value: string) => void
  minuteIncrement?: number
  disabled?: boolean
  className?: string
}

function ScrollColumn({
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
      className="h-[200px] overflow-y-auto overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col p-2">
        {items.map((item) => (
          <Button
            key={item.value}
            ref={item.value === selectedValue ? selectedRefCallback : undefined}
            size="icon"
            variant={item.value === selectedValue ? 'default' : 'ghost'}
            className="w-full shrink-0 aspect-square"
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

function buildTimeString(hour24: number, minute: number): string {
  return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function formatTimeDisplay(h24: number, m: number, use24Hour: boolean): string {
  const mStr = m.toString().padStart(2, '0')
  if (use24Hour) {
    return `${h24.toString().padStart(2, '0')}:${mStr}`
  }
  const period = h24 >= 12 ? 'PM' : 'AM'
  const hour12 = h24 % 12 || 12
  return `${hour12}:${mStr} ${period}`
}

export function TimeScroller({
  value,
  onChange,
  minuteIncrement = 15,
  disabled,
  className,
}: TimeScrollerProps) {
  const [open, setOpen] = useState(false)
  const use24HourTime = useSettingsStore((s) => s.use24HourTime)

  const [h24, m] = value.split(':').map(Number)

  const hourItems = use24HourTime
    ? Array.from({ length: 24 }, (_, i) => ({
        value: i,
        label: i.toString().padStart(2, '0'),
      }))
    : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => ({
        value: h,
        label: h.toString(),
      }))

  const minuteItems: { value: number; label: string }[] = []
  for (let i = 0; i < 60; i += minuteIncrement) {
    minuteItems.push({ value: i, label: i.toString().padStart(2, '0') })
  }

  const periodItems = [
    { value: 0, label: 'AM' },
    { value: 1, label: 'PM' },
  ]

  const currentPeriod = h24 >= 12 ? 'PM' : 'AM'
  const currentHour12 = h24 % 12 || 12
  const selectedHour = use24HourTime ? h24 : currentHour12
  const selectedPeriod = currentPeriod === 'AM' ? 0 : 1

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
      onChange(buildTimeString(hour24, m))
    },
    [use24HourTime, currentPeriod, m, onChange],
  )

  const handleMinuteChange = useCallback(
    (minute: number) => {
      onChange(buildTimeString(h24, minute))
    },
    [h24, onChange],
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
      onChange(buildTimeString(hour24, m))
    },
    [currentHour12, m, onChange],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[200px] justify-start text-left font-normal',
            'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800',
            className,
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatTimeDisplay(h24, m, use24HourTime)}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-zinc-900 border-zinc-700"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex divide-x">
          <ScrollColumn
            items={hourItems}
            selectedValue={selectedHour}
            onSelect={handleHourChange}
            disabled={disabled}
          />
          <ScrollColumn
            items={minuteItems}
            selectedValue={m}
            onSelect={handleMinuteChange}
            disabled={disabled}
          />
          {!use24HourTime && (
            <ScrollColumn
              items={periodItems}
              selectedValue={selectedPeriod}
              onSelect={handlePeriodChange}
              disabled={disabled}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
