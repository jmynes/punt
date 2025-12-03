'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useUIStore } from '@/stores/ui-store'
import {
	DEFAULT_TICKET_FORM,
	type LabelSummary,
	type SprintSummary,
	type TicketFormData,
} from '@/types'
import { TicketForm } from './ticket-form'

// Demo data - in production these come from API
const DEMO_LABELS: LabelSummary[] = [
	{ id: 'label-1', name: 'bug', color: '#ef4444' },
	{ id: 'label-2', name: 'feature', color: '#10b981' },
	{ id: 'label-3', name: 'enhancement', color: '#3b82f6' },
	{ id: 'label-4', name: 'documentation', color: '#8b5cf6' },
	{ id: 'label-5', name: 'urgent', color: '#f59e0b' },
	{ id: 'label-6', name: 'backend', color: '#06b6d4' },
	{ id: 'label-7', name: 'frontend', color: '#ec4899' },
]

const DEMO_SPRINTS: SprintSummary[] = [
	{
		id: 'sprint-1',
		name: 'Sprint 1 - Foundation',
		isActive: false,
		startDate: new Date('2024-01-01'),
		endDate: new Date('2024-01-14'),
	},
	{
		id: 'sprint-2',
		name: 'Sprint 2 - Core Features',
		isActive: true,
		startDate: new Date('2024-01-15'),
		endDate: new Date('2024-01-28'),
	},
	{ id: 'sprint-3', name: 'Sprint 3 - Polish', isActive: false, startDate: null, endDate: null },
]

export function CreateTicketDialog() {
	const { createTicketOpen, setCreateTicketOpen } = useUIStore()
	const currentUser = useCurrentUser()
	const [formData, setFormData] = useState<TicketFormData>(DEFAULT_TICKET_FORM)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleClose = useCallback(() => {
		setCreateTicketOpen(false)
		// Reset form after close animation
		setTimeout(() => setFormData(DEFAULT_TICKET_FORM), 200)
	}, [setCreateTicketOpen])

	const handleSubmit = useCallback(async () => {
		if (!formData.title.trim()) {
			return // TODO: show validation error
		}

		setIsSubmitting(true)

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 500))

		// In production, this would:
		// 1. Call API to create ticket
		// 2. Invalidate queries to refresh board
		// 3. Show success toast
		console.log('Creating ticket:', {
			...formData,
			creatorId: currentUser.id,
		})

		setIsSubmitting(false)
		handleClose()
	}, [formData, currentUser.id, handleClose])

	const isValid = formData.title.trim().length > 0

	return (
		<Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
			<DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-zinc-950 border-zinc-800">
				<DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800">
					<DialogTitle className="text-xl text-zinc-100">Create New Ticket</DialogTitle>
					<DialogDescription className="text-zinc-500">
						Fill in the details below. Only the title is required.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[calc(90vh-200px)]">
					<div className="px-6 py-4">
						<TicketForm
							data={formData}
							onChange={setFormData}
							labels={DEMO_LABELS}
							sprints={DEMO_SPRINTS}
							disabled={isSubmitting}
						/>
					</div>
				</ScrollArea>

				<DialogFooter className="px-6 py-4 border-t border-zinc-800">
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isSubmitting}
						className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!isValid || isSubmitting}
						className="bg-amber-600 hover:bg-amber-700 text-white"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creating...
							</>
						) : (
							'Create Ticket'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
