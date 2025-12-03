import { Bug, CheckSquare, Layers, Lightbulb, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IssueType } from '@/types'

interface TypeBadgeProps {
	type: IssueType
	size?: 'sm' | 'md'
	showLabel?: boolean
}

const typeConfig: Record<
	IssueType,
	{
		label: string
		icon: React.ComponentType<{ className?: string }>
		className: string
	}
> = {
	epic: {
		label: 'Epic',
		icon: Zap,
		className: 'text-purple-400',
	},
	story: {
		label: 'Story',
		icon: Lightbulb,
		className: 'text-green-400',
	},
	task: {
		label: 'Task',
		icon: CheckSquare,
		className: 'text-blue-400',
	},
	bug: {
		label: 'Bug',
		icon: Bug,
		className: 'text-red-400',
	},
	subtask: {
		label: 'Subtask',
		icon: Layers,
		className: 'text-cyan-400',
	},
}

export function TypeBadge({ type, size = 'md', showLabel = false }: TypeBadgeProps) {
	const config = typeConfig[type]
	if (!config) return null

	const Icon = config.icon

	return (
		<div className={cn('flex items-center gap-1', config.className)} title={config.label}>
			<Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
			{showLabel && (
				<span className={cn(size === 'sm' ? 'text-xs' : 'text-sm')}>{config.label}</span>
			)}
		</div>
	)
}
