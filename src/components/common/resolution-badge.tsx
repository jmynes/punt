import { Ban, CheckCircle2, Copy, HelpCircle, MinusCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Resolution } from '@/types'

interface ResolutionBadgeProps {
  resolution: Resolution
  size?: 'sm' | 'md'
}

export const resolutionConfig: Record<
  Resolution,
  {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    className: string
    color: string
  }
> = {
  Done: {
    icon: CheckCircle2,
    className: 'border-green-600 bg-green-900/30 text-green-400',
    color: '#4ade80',
  },
  "Won't Fix": {
    icon: Ban,
    className: 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
    color: '#d4d4d8',
  },
  Duplicate: {
    icon: Copy,
    className: 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
    color: '#d4d4d8',
  },
  'Cannot Reproduce': {
    icon: HelpCircle,
    className: 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
    color: '#d4d4d8',
  },
  Incomplete: {
    icon: MinusCircle,
    className: 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
    color: '#d4d4d8',
  },
  "Won't Do": {
    icon: XCircle,
    className: 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
    color: '#d4d4d8',
  },
}

export function ResolutionBadge({ resolution, size = 'md' }: ResolutionBadgeProps) {
  const config = resolutionConfig[resolution]
  if (!config) return null

  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        size === 'md' && 'text-xs px-2 py-0.5',
      )}
    >
      <Icon
        className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')}
        style={{ color: config.color }}
      />
      {resolution}
    </Badge>
  )
}
