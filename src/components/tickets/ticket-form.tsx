'use client'

import { Paperclip } from 'lucide-react'
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
	type UploadedFileInfo,
} from '@/types'
import type { ParentTicketOption } from './create-ticket-dialog'
import { DatePicker } from './date-picker'
import { FileUpload } from './file-upload'
import { LabelSelect } from './label-select'
import { ParentSelect } from './parent-select'
import { PrioritySelect } from './priority-select'
import { TypeSelect } from './type-select'
import { UserSelect } from './user-select'

interface TicketFormProps {
	data: TicketFormData
	onChange: (data: TicketFormData) => void
	labels: LabelSummary[]
	sprints: SprintSummary[]
	parentTickets?: ParentTicketOption[]
	disabled?: boolean
}

export function TicketForm({
	data,
	onChange,
	labels,
	sprints,
	parentTickets = [],
	disabled,
}: TicketFormProps) {
	const currentUser = useCurrentUser()
	const members = useProjectMembers()

	const updateField = <K extends keyof TicketFormData>(field: K, value: TicketFormData[K]) => {
		onChange({ ...data, [field]: value })
	}

	// Auto-set type to subtask when parent is selected
	const handleParentChange = (parentId: string | null) => {
		updateField('parentId', parentId)
		// If selecting a parent and current type isn't subtask, suggest subtask
		if (parentId && data.type !== 'subtask') {
			// Optionally auto-switch to subtask type
			// updateField('type', 'subtask')
		}
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

			{/* Parent Epic/Story */}
			{parentTickets.length > 0 && (
				<div className="space-y-2">
					<Label className="text-zinc-300">Parent Epic / Story</Label>
					<ParentSelect
						value={data.parentId}
						onChange={handleParentChange}
						parentTickets={parentTickets}
						disabled={disabled}
					/>
					<p className="text-xs text-zinc-500">
						Link this ticket to an Epic or Story for better organization
					</p>
				</div>
			)}

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
					className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 transition-colors hover:bg-amber-500/15 hover:border-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
						step={1}
						value={data.storyPoints ?? ''}
						onChange={(e) => {
							const val = e.target.value ? Number.parseInt(e.target.value, 10) : null
							updateField('storyPoints', val !== null && val < 0 ? 0 : val)
						}}
						onKeyDown={(e) => {
							// Handle arrow keys for increment/decrement
							if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
								e.preventDefault()
								const current = data.storyPoints ?? 1
								const newVal = e.key === 'ArrowUp' ? current + 1 : Math.max(0, current - 1)
								updateField('storyPoints', newVal)
							}
						}}
						placeholder="1"
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

			<Separator className="bg-zinc-800" />

			{/* Attachments */}
			<div className="space-y-2">
				<Label className="text-zinc-300 flex items-center gap-2">
					<Paperclip className="h-4 w-4" />
					Attachments
				</Label>
				<FileUpload
					value={data.attachments}
					onChange={(files) => updateField('attachments', files as UploadedFileInfo[])}
					maxFiles={10}
					disabled={disabled}
				/>
				<p className="text-xs text-zinc-500">
					Upload images, videos, PDFs, or documents. Max 10 files.
				</p>
			</div>
		</div>
	)
}

export { DEFAULT_TICKET_FORM }
