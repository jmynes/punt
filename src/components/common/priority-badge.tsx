import { ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Priority } from '@/types'

interface PriorityBadgeProps {
	priority: Priority
	showLabel?: boolean
	size?: 'sm' | 'md'
}

const priorityConfig: Record<
	Priority,
	{
		label: string
		icon: React.ComponentType<{ className?: string }>
		className: string
	}
> = {
	low: {
		label: 'Low',
		icon: ArrowDown,
		className: 'bg-zinc-700/50 text-zinc-300 border-zinc-600',
	},
	medium: {
		label: 'Medium',
		icon: Minus,
		className: 'bg-blue-900/50 text-blue-300 border-blue-700',
	},
	high: {
		label: 'High',
		icon: ArrowUp,
		className: 'bg-amber-900/50 text-amber-300 border-amber-700',
	},
	critical: {
		label: 'Critical',
		icon: Flame,
		className: 'bg-red-900/50 text-red-300 border-red-700',
	},
}

export function PriorityBadge({ priority, showLabel = true, size = 'md' }: PriorityBadgeProps) {
	const config = priorityConfig[priority]
	const Icon = config.icon

	return (
		<Badge
			variant="outline"
			className={cn(
				config.className,
				size === 'sm' && 'text-xs px-1.5 py-0',
				size === 'md' && 'text-xs px-2 py-0.5',
			)}
		>
			<Icon className={cn('mr-1', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
			{showLabel && config.label}
		</Badge>
	)
}
