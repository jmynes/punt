'use client'

import { Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { TicketWithRelations } from '@/types'

export function KeyboardShortcuts() {
	const { columns, addTicket, removeTicket } = useBoardStore()
	const { popDeleted, pushRedo, popRedo, pushDeleted, pushDeletedBatch } = useUndoStore()
	const { clearSelection, selectedTicketIds, getSelectedIds } = useSelectionStore()
	const { activeTicketId, setActiveTicketId, createTicketOpen, setCreateTicketOpen } = useUIStore()
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [ticketsToDelete, setTicketsToDelete] = useState<TicketWithRelations[]>([])
	const deleteButtonRef = useRef<HTMLButtonElement>(null)

	// Focus delete button when dialog opens
	useEffect(() => {
		if (showDeleteConfirm) {
			setTimeout(() => {
				deleteButtonRef.current?.focus()
			}, 0)
		}
	}, [showDeleteConfirm])

	// Handle Ctrl+click to close modals/drawers (workaround for Radix not handling modifier clicks)
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (e.ctrlKey || e.metaKey) {
				// Check if clicking on an overlay (outside modal content)
				const target = e.target as HTMLElement
				const isOverlay = target.matches('[data-slot="sheet-overlay"], [data-slot="dialog-overlay"]')
				
				if (isOverlay) {
					// Close any open drawer/modal
					if (activeTicketId) {
						setActiveTicketId(null)
					}
					if (createTicketOpen) {
						setCreateTicketOpen(false)
					}
				}
			}
		}

		window.addEventListener('click', handleClick)
		return () => window.removeEventListener('click', handleClick)
	}, [activeTicketId, setActiveTicketId, createTicketOpen, setCreateTicketOpen])

	// Get all tickets flat from columns
	const allTickets = columns.flatMap((col) => col.tickets)

	const handleDeleteSelected = () => {
		const selectedIds = getSelectedIds()
		const tickets = allTickets.filter((t) => selectedIds.includes(t.id))
		
		if (tickets.length === 0) return
		
		setTicketsToDelete(tickets)
		setShowDeleteConfirm(true)
	}

	const confirmDelete = () => {
		// Remove all tickets
		for (const ticket of ticketsToDelete) {
			removeTicket(ticket.id)
		}

		// Create batch entry for undo
		const batchTickets = ticketsToDelete.map((ticket) => ({
			ticket,
			columnId: ticket.columnId,
		}))

		// Show toast with undo option
		const toastId = toast.error(
			ticketsToDelete.length === 1
				? 'Ticket deleted'
				: `${ticketsToDelete.length} tickets deleted`,
			{
				description:
					ticketsToDelete.length === 1
						? ticketsToDelete[0].title
						: 'Press Ctrl+Z to undo all',
				duration: 10000,
				action: {
					label: 'Undo',
					onClick: () => {
						// Restore all tickets
						for (const { ticket, columnId } of batchTickets) {
							addTicket(columnId, ticket)
						}
						toast.success(
							ticketsToDelete.length === 1
								? 'Ticket restored'
								: `${ticketsToDelete.length} tickets restored`,
							{ duration: 3000 },
						)
					},
				},
			},
		)

		// Push as a single batch entry
		pushDeletedBatch(batchTickets, toastId)

		clearSelection()
		setShowDeleteConfirm(false)
		setTicketsToDelete([])
	}

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't handle shortcuts when typing in inputs
			const target = e.target as HTMLElement
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
				return
			}

			// Delete key: prompt to delete selected tickets
			if (e.key === 'Delete' && selectedTicketIds.size > 0) {
				e.preventDefault()
				handleDeleteSelected()
				return
			}

			// Escape: clear selection or close delete dialog
			if (e.key === 'Escape') {
				if (showDeleteConfirm) {
					setShowDeleteConfirm(false)
					return
				}
				if (selectedTicketIds.size > 0) {
					clearSelection()
					return
				}
			}

			// Check for Ctrl/Cmd + Z (Undo)
			if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
				e.preventDefault()
				const entry = popDeleted()
				if (entry) {
					// Restore all tickets in the batch
					for (const { ticket, columnId } of entry.tickets) {
						addTicket(columnId, ticket)
					}
					// Dismiss the delete toast
					toast.dismiss(entry.toastId)
					// Push to redo stack
					pushRedo(entry)
					// Show undo confirmation
					toast.success(
						entry.tickets.length === 1
							? 'Ticket restored'
							: `${entry.tickets.length} tickets restored`,
						{
							description:
								entry.tickets.length === 1
									? entry.tickets[0].ticket.title
									: undefined,
							duration: 3000,
						},
					)
				}
			}

			// Check for Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (Redo)
			if (
				((e.ctrlKey || e.metaKey) && e.key === 'y') ||
				((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)
			) {
				e.preventDefault()
				const entry = popRedo()
				if (entry) {
					// Remove all tickets again
					for (const { ticket } of entry.tickets) {
						removeTicket(ticket.id)
					}
					// Show new delete toast with undo option
					const newToastId = toast.error(
						entry.tickets.length === 1
							? 'Ticket deleted'
							: `${entry.tickets.length} tickets deleted`,
						{
							description:
								entry.tickets.length === 1
									? entry.tickets[0].ticket.title
									: 'Press Ctrl+Z to undo all',
							duration: 10000,
							action: {
								label: 'Undo',
								onClick: () => {
									for (const { ticket, columnId } of entry.tickets) {
										addTicket(columnId, ticket)
									}
								},
							},
						},
					)
					// Push back to undo stack
					pushDeletedBatch(entry.tickets, newToastId)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [addTicket, removeTicket, popDeleted, pushRedo, popRedo, pushDeleted, clearSelection, selectedTicketIds, showDeleteConfirm, columns])

	return (
		<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
			<AlertDialogContent className="bg-zinc-950 border-zinc-800">
				<AlertDialogHeader>
					<AlertDialogTitle className="text-zinc-100">
						Delete {ticketsToDelete.length === 1 ? 'ticket' : `${ticketsToDelete.length} tickets`}?
					</AlertDialogTitle>
					<AlertDialogDescription className="text-zinc-400">
						{ticketsToDelete.length === 1 ? (
							<>
								Are you sure you want to delete <span className="font-semibold text-zinc-300">{ticketsToDelete[0]?.title}</span>?
							</>
						) : (
							<>
								Are you sure you want to delete these {ticketsToDelete.length} tickets? This action can be undone with Ctrl+Z.
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
						<X className="h-4 w-4 mr-1" />
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						ref={deleteButtonRef}
						onClick={confirmDelete}
						className="bg-red-600 hover:bg-red-700 text-white"
					>
						<Trash2 className="h-4 w-4 mr-1" />
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

