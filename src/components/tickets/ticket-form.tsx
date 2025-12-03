'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import {
	DEFAULT_TICKET_FORM,
	type IssueType,
	type LabelSummary,
	type Priority,
	type SprintSummary,
	type TicketFormData,
} from '@/types'
import { DatePicker } from './date-picker'
import { LabelSelect } from './label-select'
import { PrioritySelect } from './priority-select'
import { TypeSelect } from './type-select'
import { UserSelect } from './user-select'

interface TicketFormProps {
	data: TicketFormData
	onChange: (data: TicketFormData) => void
	labels: LabelSummary[]
	sprints: SprintSummary[]
	disabled?: boolean
}

export function TicketForm({ data, onChange, labels, sprints, disabled }: TicketFormProps) {
	const currentUser = useCurrentUser()
	const members = useProjectMembers()

	const updateField = <K extends keyof TicketFormData>(field: K, value: TicketFormData[K]) => {
		onChange({ ...data, [field]: value })
	}

	return (
		<div className="space-y-6">
			{/* Title - Required */}
			<div className="space-y-2">
				<Label htmlFor="title" className="text-zinc-300">
					Title <span className="text-red-400">*</span>
				</Label>
				<Input
					id="title"
					value={data.title}
					onChange={(e) => updateField('title', e.target.value)}
					placeholder="Enter a brief summary..."
					disabled={disabled}
					className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
				/>
			</div>

			{/* Type and Priority - Row */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label className="text-zinc-300">Type</Label>
					<TypeSelect
						value={data.type}
						onChange={(value: IssueType) => updateField('type', value)}
						disabled={disabled}
					/>
				</div>
				<div className="space-y-2">
					<Label className="text-zinc-300">Priority</Label>
					<PrioritySelect
						value={data.priority}
						onChange={(value: Priority) => updateField('priority', value)}
						disabled={disabled}
					/>
				</div>
			</div>

			{/* Description */}
			<div className="space-y-2">
				<Label htmlFor="description" className="text-zinc-300">
					Description
				</Label>
				<Textarea
					id="description"
					value={data.description}
					onChange={(e) => updateField('description', e.target.value)}
					placeholder="Add a more detailed description..."
					rows={4}
					disabled={disabled}
					className="bg-zinc-900 border-zinc-700 focus:border-amber-500 resize-none"
				/>
			</div>

			<Separator className="bg-zinc-800" />

			{/* Assignee with Assign to Me button */}
			<div className="space-y-2">
				<Label className="text-zinc-300">Assignee</Label>
				<UserSelect
					value={data.assigneeId}
					onChange={(value) => updateField('assigneeId', value)}
					users={members}
					currentUserId={currentUser.id}
					placeholder="Unassigned"
					disabled={disabled}
					showAssignToMe
				/>
			</div>

			{/* Labels */}
			<div className="space-y-2">
				<Label className="text-zinc-300">Labels</Label>
				<LabelSelect
					value={data.labelIds}
					onChange={(value) => updateField('labelIds', value)}
					labels={labels}
					disabled={disabled}
				/>
			</div>

			{/* Sprint */}
			<div className="space-y-2">
				<Label className="text-zinc-300">Sprint</Label>
				<select
					value={data.sprintId || ''}
					onChange={(e) => updateField('sprintId', e.target.value || null)}
					disabled={disabled}
					className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
				>
					<option value="">No sprint (Backlog)</option>
					{sprints.map((sprint) => (
						<option key={sprint.id} value={sprint.id}>
							{sprint.name} {sprint.isActive && '(Active)'}
						</option>
					))}
				</select>
			</div>

			<Separator className="bg-zinc-800" />

			{/* Dates - Row */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label className="text-zinc-300">Start Date</Label>
					<DatePicker
						value={data.startDate}
						onChange={(value) => updateField('startDate', value)}
						placeholder="Set start date"
						disabled={disabled}
					/>
				</div>
				<div className="space-y-2">
					<Label className="text-zinc-300">Due Date</Label>
					<DatePicker
						value={data.dueDate}
						onChange={(value) => updateField('dueDate', value)}
						placeholder="Set due date"
						disabled={disabled}
					/>
				</div>
			</div>

			{/* Estimation - Row */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="storyPoints" className="text-zinc-300">
						Story Points
					</Label>
					<Input
						id="storyPoints"
						type="number"
						min={0}
						value={data.storyPoints ?? ''}
						onChange={(e) =>
							updateField(
								'storyPoints',
								e.target.value ? Number.parseInt(e.target.value, 10) : null,
							)
						}
						placeholder="0"
						disabled={disabled}
						className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="estimate" className="text-zinc-300">
						Time Estimate
					</Label>
					<Input
						id="estimate"
						value={data.estimate}
						onChange={(e) => updateField('estimate', e.target.value)}
						placeholder="e.g., 2h, 1d, 1w"
						disabled={disabled}
						className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
					/>
				</div>
			</div>

			{/* Environment */}
			<div className="space-y-2">
				<Label htmlFor="environment" className="text-zinc-300">
					Environment
				</Label>
				<Input
					id="environment"
					value={data.environment}
					onChange={(e) => updateField('environment', e.target.value)}
					placeholder="e.g., Production, Staging, Development"
					disabled={disabled}
					className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
				/>
			</div>
		</div>
	)
}

export { DEFAULT_TICKET_FORM }
