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
import {
  useCreateLabel,
  useCreateTicket,
  useDeleteLabel,
  useProjectLabels,
  useProjectSprints,
} from '@/hooks/queries/use-tickets'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import {
  DEFAULT_TICKET_FORM,
  type LabelSummary,
  type TicketFormData,
  type TicketWithRelations,
} from '@/types'
import { TicketForm } from './ticket-form'

// Parent tickets interface (epics and stories that can contain subtasks)
export interface ParentTicketOption {
  id: string
  number: number
  title: string
  type: 'epic' | 'story'
  projectKey: string
}

export function CreateTicketDialog() {
  const {
    createTicketOpen,
    setCreateTicketOpen,
    prefillTicketData,
    clearPrefillData,
    activeProjectId,
  } = useUIStore()
  const { getColumns, getNextTicketNumber } = useBoardStore()
  const currentUser = useCurrentUser()
  const [formData, setFormData] = useState<TicketFormData>(DEFAULT_TICKET_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Use API mutations
  const createTicketMutation = useCreateTicket()
  const createLabelMutation = useCreateLabel()
  const deleteLabelMutation = useDeleteLabel()

  // Get columns for the active project
  const projectId = activeProjectId || ''
  const members = useProjectMembers(projectId)
  const columns = getColumns(projectId)

  // Fetch sprints and labels from API
  const { data: projectSprints } = useProjectSprints(projectId, { enabled: !!projectId })
  const { data: projectLabels } = useProjectLabels(projectId, { enabled: !!projectId })

  // Use API data with fallback to empty arrays while loading
  const availableSprints = projectSprints ?? []
  const availableLabels = projectLabels ?? []

  // Callback for creating new labels inline
  const handleCreateLabel = useCallback(
    async (name: string): Promise<LabelSummary | null> => {
      if (!projectId) return null

      try {
        const result = await createLabelMutation.mutateAsync({ projectId, name })
        return result
      } catch {
        return null
      }
    },
    [projectId, createLabelMutation],
  )

  // Callback for deleting labels
  const handleDeleteLabel = useCallback(
    async (labelId: string): Promise<void> => {
      if (!projectId) return

      await deleteLabelMutation.mutateAsync({ projectId, labelId })
    },
    [projectId, deleteLabelMutation],
  )

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

    if (!projectId) {
      return // No project selected
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
      .map((id) => availableLabels.find((l) => l.id === id))
      .filter((l): l is LabelSummary => l !== undefined)

    // Build the sprint object if selected
    const selectedSprint = formData.sprintId
      ? availableSprints.find((s) => s.id === formData.sprintId) || null
      : null

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
      isCarriedOver: false,
      carriedFromSprintId: null,
      carriedOverCount: 0,
      assignee: formData.assigneeId
        ? members.find((m) => m.id === formData.assigneeId) || null
        : null,
      creator: currentUser,
      sprint: selectedSprint,
      carriedFromSprint: null,
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

    setIsSubmitting(false)
    handleClose()
  }, [
    formData,
    currentUser,
    members,
    columns,
    handleClose,
    projectId,
    getNextTicketNumber,
    createTicketMutation,
    availableLabels,
    availableSprints,
  ])

  const isValid = formData.title.trim().length > 0 && !!projectId

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
              labels={availableLabels}
              sprints={availableSprints}
              parentTickets={[]}
              disabled={isSubmitting}
              onCreateLabel={handleCreateLabel}
              onDeleteLabel={handleDeleteLabel}
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
          <Button onClick={handleSubmit} variant="primary" disabled={!isValid || isSubmitting}>
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
