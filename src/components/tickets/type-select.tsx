'use client'

import { Bug, CheckSquare, Layers, Lightbulb, Zap } from 'lucide-react'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { ISSUE_TYPES, type IssueType } from '@/types'

interface TypeSelectProps {
	value: IssueType
	onChange: (value: IssueType) => void
	disabled?: boolean
}

const typeConfig: Record<
	IssueType,
	{ label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
	epic: { label: 'Epic', icon: Zap, color: 'text-purple-400' },
	story: { label: 'Story', icon: Lightbulb, color: 'text-green-400' },
	task: { label: 'Task', icon: CheckSquare, color: 'text-blue-400' },
	bug: { label: 'Bug', icon: Bug, color: 'text-red-400' },
	subtask: { label: 'Subtask', icon: Layers, color: 'text-cyan-400' },
}

export function TypeSelect({ value, onChange, disabled }: TypeSelectProps) {
	const config = typeConfig[value]
	const Icon = config.icon

	return (
		<Select value={value} onValueChange={(v) => onChange(v as IssueType)} disabled={disabled}>
			<SelectTrigger className="w-full">
				<SelectValue>
					<div className="flex items-center gap-2">
						<Icon className={`h-4 w-4 ${config.color}`} />
						<span>{config.label}</span>
					</div>
				</SelectValue>
			</SelectTrigger>
			<SelectContent className="bg-zinc-900 border-zinc-700">
				{ISSUE_TYPES.map((type) => {
					const cfg = typeConfig[type]
					const TypeIcon = cfg.icon
					return (
						<SelectItem key={type} value={type} className="focus:bg-zinc-800 focus:text-zinc-100">
							<div className="flex items-center gap-2">
								<TypeIcon className={`h-4 w-4 ${cfg.color}`} />
								<span>{cfg.label}</span>
							</div>
						</SelectItem>
					)
				})}
			</SelectContent>
		</Select>
	)
}
