'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { useCreateTicket } from '@/hooks/queries/use-tickets'
import { formatTicketId } from '@/lib/ticket-format'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import {
  DEFAULT_TICKET_FORM,
  type LabelSummary,
  type SprintSummary,
  type TicketFormData,
  type TicketWithRelations,
} from '@/types'
import { TicketForm } from './ticket-form'

// Demo project IDs that use local state instead of API
const DEMO_PROJECT_IDS = ['1', '2', '3']

// Demo labels - these should be CATEGORIES, not types or priorities
// Good labels: area/component, team, customer-facing, technical debt, etc.
const DEMO_LABELS: LabelSummary[] = [
  // Area/Component labels
  { id: 'label-1', name: 'frontend', color: '#ec4899' },
  { id: 'label-2', name: 'backend', color: '#06b6d4' },
  { id: 'label-3', name: 'database', color: '#8b5cf6' },
  { id: 'label-4', name: 'api', color: '#f59e0b' },
  { id: 'label-5', name: 'auth', color: '#ef4444' },
  { id: 'label-6', name: 'ui/ux', color: '#14b8a6' },
  // Category labels
  { id: 'label-7', name: 'documentation', color: '#64748b' },
  { id: 'label-8', name: 'testing', color: '#22c55e' },
  { id: 'label-9', name: 'performance', color: '#eab308' },
  { id: 'label-10', name: 'security', color: '#dc2626' },
  { id: 'label-11', name: 'refactor', color: '#a855f7' },
  { id: 'label-12', name: 'tech-debt', color: '#78716c' },
  // Status-ish labels
  { id: 'label-13', name: 'needs-review', color: '#3b82f6' },
  { id: 'label-14', name: 'blocked', color: '#991b1b' },
  { id: 'label-15', name: 'help-wanted', color: '#16a34a' },
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

// Demo parent tickets (epics and stories that can contain subtasks)
export interface ParentTicketOption {
  id: string
  number: number
  title: string
  type: 'epic' | 'story'
  projectKey: string
}

const DEMO_PARENT_TICKETS: ParentTicketOption[] = [
  {
    id: 'epic-1',
    number: 100,
    title: 'User Authentication System',
    type: 'epic',
    projectKey: 'PUNT',
  },
  {
    id: 'epic-2',
    number: 101,
    title: 'Kanban Board Implementation',
    type: 'epic',
    projectKey: 'PUNT',
  },
  { id: 'epic-3', number: 102, title: 'Ticket Management', type: 'epic', projectKey: 'PUNT' },
  {
    id: 'story-1',
    number: 103,
    title: 'Login and Registration Flow',
    type: 'story',
    projectKey: 'PUNT',
  },
  { id: 'story-2', number: 104, title: 'Drag and Drop Cards', type: 'story', projectKey: 'PUNT' },
  { id: 'story-3', number: 105, title: 'Create Ticket Form', type: 'story', projectKey: 'PUNT' },
]

// Simple counter for generating ticket numbers (in production, this comes from the database)
const ticketCounter = 200

export function CreateTicketDialog() {
  const {
    createTicketOpen,
    setCreateTicketOpen,
    prefillTicketData,
    clearPrefillData,
    activeProjectId,
  } = useUIStore()
  const { getColumns, getNextTicketNumber, addTicket } = useBoardStore()
  const currentUser = useCurrentUser()
  const [formData, setFormData] = useState<TicketFormData>(DEFAULT_TICKET_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Use API mutation for real projects
  const createTicketMutation = useCreateTicket()

  // Get columns for the active project
  const projectId = activeProjectId || '1' // Fallback to '1' if no project is active
  const members = useProjectMembers(projectId)
  const columns = getColumns(projectId)

  // Apply prefill data when dialog opens with clone data
  useEffect(() => {
    if (createTicketOpen && prefillTicketData) {
      setFormData({ ...DEFAULT_TICKET_FORM, ...prefillTicketData })
    }
  }, [createTicketOpen, prefillTicketData])

  const handleClose = useCallback(() => {
    setCreateTicketOpen(false)
    clearPrefillData()
    // Reset form after close animation
    setTimeout(() => setFormData(DEFAULT_TICKET_FORM), 200)
  }, [setCreateTicketOpen, clearPrefillData])

  const handleSubmit = useCallback(async () => {
    if (!formData.title.trim()) {
      return // TODO: show validation error
    }

    if (!currentUser) {
      return // Not authenticated
    }

    setIsSubmitting(true)

    // Determine target column: user-selected in form, else "To Do", else first column
    const targetColumn =
      (formData.columnId && columns.find((c) => c.id === formData.columnId)) ||
      columns.find((c) => c.name === 'To Do') ||
      columns[0]
    if (!targetColumn) {
      console.error('No columns available')
      setIsSubmitting(false)
      return
    }

    // Build the labels array from selected label IDs
    const selectedLabels = formData.labelIds
      .map((id) => DEMO_LABELS.find((l) => l.id === id))
      .filter((l): l is LabelSummary => l !== undefined)

    // Build the sprint object if selected
    const selectedSprint = formData.sprintId
      ? DEMO_SPRINTS.find((s) => s.id === formData.sprintId) || null
      : null

    // Check if this is a demo project
    const isDemoProject = DEMO_PROJECT_IDS.includes(projectId)

    if (isDemoProject) {
      // Demo project: use local state only (no API)
      // Generate unique ID and ticket number
      const ticketId = `ticket-${Date.now()}`
      const ticketNumber = getNextTicketNumber(projectId)

      // Create the full ticket object
      const newTicket: TicketWithRelations = {
        id: ticketId,
        number: ticketNumber,
        title: formData.title.trim(),
        description: formData.description || null,
        type: formData.type,
        priority: formData.priority,
        order: targetColumn.tickets.length, // Add to end of column
        storyPoints: formData.storyPoints,
        estimate: formData.estimate || null,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        environment: formData.environment || null,
        affectedVersion: formData.affectedVersion || null,
        fixVersion: formData.fixVersion || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: targetColumn.id,
        assigneeId: formData.assigneeId,
        creatorId: currentUser.id,
        sprintId: formData.sprintId,
        parentId: formData.parentId,
        assignee: formData.assigneeId
          ? members.find((m) => m.id === formData.assigneeId) || null
          : null,
        creator: currentUser,
        sprint: selectedSprint,
        labels: selectedLabels,
        watchers: [],
        _count: {
          comments: 0,
          subtasks: 0,
          attachments: formData.attachments.length,
        },
      }

      // Add ticket to the board store
      addTicket(projectId, targetColumn.id, newTicket)

      // Show success toast with undo option
      const showUndo = useUIStore.getState().showUndoButtons
      const { removeTicket } = useBoardStore.getState()
      const ticketKey = formatTicketId(newTicket)

      let currentId: string | number | undefined

      const toastId = showUndoRedoToast('success', {
        title: 'Ticket created',
        description: ticketKey,
        duration: 5000,
        showUndoButtons: showUndo,
        onUndo: (id) => {
          useUndoStore.getState().undoByToastId(id)
          removeTicket(projectId, newTicket.id)
        },
        onUndoneToast: (newId) => {
          if (currentId) {
            useUndoStore.getState().updateRedoToastId(currentId, newId)
            currentId = newId
          }
        },
        onRedo: (id) => {
          useUndoStore.getState().redoByToastId(id)
          useBoardStore.getState().addTicket(projectId, targetColumn.id, newTicket)
        },
        onRedoneToast: (newId) => {
          if (currentId) {
            useUndoStore.getState().updateUndoToastId(currentId, newId)
            currentId = newId
          }
        },
        undoneTitle: 'Ticket creation undone',
        redoneTitle: 'Ticket created',
      })

      currentId = toastId

      // Push to undo stack
      useUndoStore.getState().pushTicketCreate(projectId, newTicket, targetColumn.id, toastId)
    } else {
      // Real project: use API mutation
      // Create temp ticket for optimistic update (will be replaced by server response)
      const tempId = `temp-${Date.now()}`
      const tempNumber = getNextTicketNumber(projectId)

      const tempTicket: TicketWithRelations = {
        id: tempId,
        number: tempNumber,
        title: formData.title.trim(),
        description: formData.description || null,
        type: formData.type,
        priority: formData.priority,
        order: targetColumn.tickets.length,
        storyPoints: formData.storyPoints,
        estimate: formData.estimate || null,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        environment: formData.environment || null,
        affectedVersion: formData.affectedVersion || null,
        fixVersion: formData.fixVersion || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: targetColumn.id,
        assigneeId: formData.assigneeId,
        creatorId: currentUser.id,
        sprintId: formData.sprintId,
        parentId: formData.parentId,
        assignee: formData.assigneeId
          ? members.find((m) => m.id === formData.assigneeId) || null
          : null,
        creator: currentUser,
        sprint: selectedSprint,
        labels: selectedLabels,
        watchers: [],
        _count: {
          comments: 0,
          subtasks: 0,
          attachments: formData.attachments.length,
        },
      }

      try {
        await createTicketMutation.mutateAsync({
          projectId,
          columnId: targetColumn.id,
          data: {
            title: formData.title.trim(),
            description: formData.description || undefined,
            type: formData.type,
            priority: formData.priority,
            assigneeId: formData.assigneeId,
            sprintId: formData.sprintId,
            parentId: formData.parentId,
            storyPoints: formData.storyPoints,
            estimate: formData.estimate || undefined,
            startDate: formData.startDate,
            dueDate: formData.dueDate,
            environment: formData.environment || undefined,
            affectedVersion: formData.affectedVersion || undefined,
            fixVersion: formData.fixVersion || undefined,
            labelIds: formData.labelIds,
            watcherIds: formData.watcherIds,
          },
          tempTicket,
        })
      } catch {
        // Error is already handled by mutation's onError
        setIsSubmitting(false)
        return
      }
    }

    setIsSubmitting(false)
    handleClose()
  }, [
    formData,
    currentUser,
    members,
    columns,
    addTicket,
    handleClose,
    projectId,
    getNextTicketNumber,
    createTicketMutation,
  ])

  const isValid = formData.title.trim().length > 0

  return (
    <Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:!max-w-4xl max-h-[90vh] p-0 bg-zinc-950 border-zinc-800 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800">
          <DialogTitle className="text-xl text-zinc-100">Create New Ticket</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Fill in the details below. Only the title is required.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-280px)] sm:max-h-[calc(90vh-240px)]">
          <div className="px-6 py-4 w-full min-w-0">
            <TicketForm
              data={formData}
              onChange={setFormData}
              labels={DEMO_LABELS}
              sprints={DEMO_SPRINTS}
              parentTickets={DEMO_PARENT_TICKETS}
              disabled={isSubmitting}
            />
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-zinc-700 text-zinc-300 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800"
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
