'use client'

import { ArrowUp, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Flame } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIORITIES, type Priority } from '@/types'

interface PrioritySelectProps {
  value: Priority
  onChange: (value: Priority) => void
  disabled?: boolean
}

const priorityConfig: Record<
  Priority,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  lowest: { label: 'Lowest', icon: ChevronsDown, color: 'text-zinc-400' },
  low: { label: 'Low', icon: ChevronDown, color: 'text-zinc-400' },
  medium: { label: 'Medium', icon: ArrowUp, color: 'text-blue-400' },
  high: { label: 'High', icon: ChevronUp, color: 'text-amber-400' },
  highest: { label: 'Highest', icon: ChevronsUp, color: 'text-orange-400' },
  critical: { label: 'Critical', icon: Flame, color: 'text-red-400' },
}

export function PrioritySelect({ value, onChange, disabled }: PrioritySelectProps) {
  const config = priorityConfig[value]
  const Icon = config.icon

  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${config.color}`} />
            <span>{config.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-700">
        {PRIORITIES.map((priority) => {
          const cfg = priorityConfig[priority]
          const PriorityIcon = cfg.icon
          return (
            <SelectItem
              key={priority}
              value={priority}
              className="focus:bg-zinc-800 focus:text-zinc-100"
            >
              <div className="flex items-center gap-2">
                <PriorityIcon className={`h-4 w-4 ${cfg.color}`} />
                <span>{cfg.label}</span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
