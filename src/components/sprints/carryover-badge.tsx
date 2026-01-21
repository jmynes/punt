'use client'

import { RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface CarryoverBadgeProps {
  count: number
  fromSprintName?: string | null
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Badge indicating a ticket was carried over from a previous sprint.
 * Shows the number of times carried over and source sprint name in tooltip.
 */
export function CarryoverBadge({
  count,
  fromSprintName,
  className,
  size = 'sm',
}: CarryoverBadgeProps) {
  if (count === 0) return null

  const sizeClasses = {
    sm: 'h-4 px-1.5 text-[10px]',
    md: 'h-5 px-2 text-xs',
  }

  const iconSize = size === 'sm' ? 10 : 12

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full font-medium',
            'bg-orange-500/20 text-orange-400 border border-orange-500/30',
            sizeClasses[size],
            className,
          )}
        >
          <RefreshCw size={iconSize} className="shrink-0" />
          {count > 1 && <span>{count}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          Carried over {count} time{count > 1 ? 's' : ''}
          {fromSprintName && <span className="text-zinc-400"> from {fromSprintName}</span>}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
