'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useBoardStore } from '@/stores/board-store'
import { useUndoStore } from '@/stores/undo-store'

export function KeyboardShortcuts() {
	const { addTicket, removeTicket } = useBoardStore()
	const { popDeleted, pushRedo, popRedo, pushDeleted } = useUndoStore()

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Check for Ctrl/Cmd + Z (Undo)
			if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
				e.preventDefault()
				const deleted = popDeleted()
				if (deleted) {
					// Restore the ticket
					addTicket(deleted.columnId, deleted.ticket)
					// Dismiss the delete toast
					toast.dismiss(deleted.toastId)
					// Push to redo stack
					pushRedo(deleted)
					// Show undo confirmation
					toast.success('Ticket restored', {
						description: `${deleted.ticket.title} has been restored.`,
						duration: 3000,
					})
				}
			}

			// Check for Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (Redo)
			if (
				((e.ctrlKey || e.metaKey) && e.key === 'y') ||
				((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)
			) {
				e.preventDefault()
				const toRedo = popRedo()
				if (toRedo) {
					// Remove the ticket again
					removeTicket(toRedo.ticket.id)
					// Show new delete toast with undo option
					const newToastId = toast.error('Ticket deleted', {
						description: toRedo.ticket.title,
						duration: 10000,
						action: {
							label: 'Undo',
							onClick: () => {
								// Will be handled by the undo action
							},
						},
					})
					// Push back to deleted stack
					pushDeleted(toRedo.ticket, toRedo.columnId, newToastId)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [addTicket, removeTicket, popDeleted, pushRedo, popRedo, pushDeleted])

	return null
}

