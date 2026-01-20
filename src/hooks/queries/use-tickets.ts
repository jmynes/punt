'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { getTabId } from '@/hooks/use-realtime'
import { useBoardStore } from '@/stores/board-store'
import type { Column, ColumnWithTickets, TicketFormData, TicketWithRelations } from '@/types'

export const ticketKeys = {
  all: ['tickets'] as const,
  byProject: (projectId: string) => ['tickets', 'project', projectId] as const,
  detail: (projectId: string, ticketId: string) =>
    ['tickets', 'project', projectId, ticketId] as const,
}

export const columnKeys = {
  all: ['columns'] as const,
  byProject: (projectId: string) => ['columns', 'project', projectId] as const,
}

// API response type for tickets (dates are strings from JSON)
interface TicketAPIResponse {
  id: string
  number: number
  title: string
  description: string | null
  type: string
  priority: string
  order: number
  storyPoints: number | null
  estimate: string | null
  startDate: string | null
  dueDate: string | null
  environment: string | null
  affectedVersion: string | null
  fixVersion: string | null
  createdAt: string
  updatedAt: string
  projectId: string
  columnId: string
  assigneeId: string | null
  creatorId: string
  sprintId: string | null
  parentId: string | null
  assignee: { id: string; name: string; email: string | null; avatar: string | null } | null
  creator: { id: string; name: string; email: string | null; avatar: string | null }
  sprint: {
    id: string
    name: string
    isActive: boolean
    startDate: string | null
    endDate: string | null
  } | null
  labels: { id: string; name: string; color: string }[]
  watchers: { id: string; name: string; email: string | null; avatar: string | null }[]
  _count: {
    comments: number
    subtasks: number
    attachments: number
  }
}

// API response type for columns
interface ColumnAPIResponse {
  id: string
  name: string
  order: number
  projectId: string
}

/**
 * Fetch columns for a project (creates defaults if none exist)
 */
export function useColumnsByProject(projectId: string, options?: { enabled?: boolean }) {
  const { setColumns, getColumns } = useBoardStore()

  const query = useQuery<Column[]>({
    queryKey: columnKeys.byProject(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/columns`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch columns')
      }
      const data: ColumnAPIResponse[] = await res.json()
      return data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - columns change rarely
    enabled: options?.enabled ?? true,
  })

  // Sync columns to board store when data changes
  useEffect(() => {
    if (query.data) {
      // Get existing columns to preserve any tickets
      const existingColumns = getColumns(projectId)
      const existingTicketsByColumn = new Map<string, TicketWithRelations[]>()

      for (const col of existingColumns) {
        existingTicketsByColumn.set(col.id, col.tickets)
      }

      // Create new columns with API data, preserving existing tickets
      const columnsWithTickets: ColumnWithTickets[] = query.data.map((col) => ({
        ...col,
        tickets: existingTicketsByColumn.get(col.id) || [],
      }))

      setColumns(projectId, columnsWithTickets)
    }
  }, [query.data, projectId, setColumns, getColumns])

  return query
}

// Transform API response to TicketWithRelations (convert date strings to Date objects)
function transformTicket(ticket: TicketAPIResponse): TicketWithRelations {
  return {
    ...ticket,
    type: ticket.type as TicketWithRelations['type'],
    priority: ticket.priority as TicketWithRelations['priority'],
    startDate: ticket.startDate ? new Date(ticket.startDate) : null,
    dueDate: ticket.dueDate ? new Date(ticket.dueDate) : null,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt),
    assignee: ticket.assignee ? { ...ticket.assignee, email: ticket.assignee.email ?? '' } : null,
    creator: { ...ticket.creator, email: ticket.creator.email ?? '' },
    sprint: ticket.sprint
      ? {
          ...ticket.sprint,
          startDate: ticket.sprint.startDate ? new Date(ticket.sprint.startDate) : null,
          endDate: ticket.sprint.endDate ? new Date(ticket.sprint.endDate) : null,
        }
      : null,
    watchers: ticket.watchers.map((w) => ({ ...w, email: w.email ?? '' })),
  }
}

/**
 * Fetch all tickets for a project and sync with board store
 */
export function useTicketsByProject(projectId: string, options?: { enabled?: boolean }) {
  const { syncTicketsFromAPI } = useBoardStore()

  const query = useQuery<TicketWithRelations[]>({
    queryKey: ticketKeys.byProject(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tickets`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch tickets')
      }
      const data: TicketAPIResponse[] = await res.json()
      return data.map(transformTicket)
    },
    staleTime: 1000 * 60, // 1 minute
    enabled: options?.enabled ?? true,
  })

  // Sync tickets to board store when data changes
  useEffect(() => {
    if (query.data) {
      syncTicketsFromAPI(projectId, query.data)
    }
  }, [query.data, projectId, syncTicketsFromAPI])

  return query
}

interface CreateTicketInput {
  projectId: string
  columnId: string
  data: Partial<TicketFormData> & { title: string }
  tempTicket: TicketWithRelations
}

/**
 * Create a new ticket
 */
export function useCreateTicket() {
  const queryClient = useQueryClient()
  const { addTicket, removeTicket, updateTicket: updateTicketInStore } = useBoardStore()

  return useMutation({
    mutationFn: async ({ projectId, columnId, data }: CreateTicketInput) => {
      const res = await fetch(`/api/projects/${projectId}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({
          ...data,
          columnId,
          startDate: data.startDate?.toISOString(),
          dueDate: data.dueDate?.toISOString(),
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create ticket')
      }
      const responseData: TicketAPIResponse = await res.json()
      return transformTicket(responseData)
    },
    onMutate: async ({ projectId, columnId, tempTicket }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.byProject(projectId) })

      // Snapshot previous tickets
      const previousTickets = queryClient.getQueryData<TicketWithRelations[]>(
        ticketKeys.byProject(projectId),
      )

      // Optimistic add with temp ticket
      addTicket(projectId, columnId, tempTicket)

      return { previousTickets, tempTicket }
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.tempTicket) {
        removeTicket(projectId, context.tempTicket.id)
      }
      toast.error(err.message)
    },
    onSuccess: (newTicket, { projectId }, context) => {
      // Replace temp ticket with real one from server
      if (context?.tempTicket) {
        removeTicket(projectId, context.tempTicket.id)
        addTicket(projectId, newTicket.columnId, newTicket)
      }
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface UpdateTicketInput {
  projectId: string
  ticketId: string
  updates: Partial<TicketWithRelations>
  previousTicket: TicketWithRelations
}

/**
 * Update a ticket
 */
export function useUpdateTicket() {
  const queryClient = useQueryClient()
  const { updateTicket: updateTicketInStore } = useBoardStore()

  return useMutation({
    mutationFn: async ({ projectId, ticketId, updates }: UpdateTicketInput) => {
      // Convert TicketWithRelations updates to API format
      const apiUpdates: Record<string, unknown> = {}

      // Copy scalar fields
      const scalarFields = [
        'title',
        'description',
        'type',
        'priority',
        'columnId',
        'order',
        'storyPoints',
        'estimate',
        'environment',
        'affectedVersion',
        'fixVersion',
        'assigneeId',
        'creatorId',
        'sprintId',
        'parentId',
      ]

      for (const field of scalarFields) {
        if (field in updates) {
          apiUpdates[field] = updates[field as keyof typeof updates]
        }
      }

      // Convert dates
      if ('startDate' in updates) {
        apiUpdates.startDate = updates.startDate?.toISOString() ?? null
      }
      if ('dueDate' in updates) {
        apiUpdates.dueDate = updates.dueDate?.toISOString() ?? null
      }

      // Convert labels to labelIds
      if ('labels' in updates && updates.labels) {
        apiUpdates.labelIds = updates.labels.map((l) => l.id)
      }

      // Convert watchers to watcherIds
      if ('watchers' in updates && updates.watchers) {
        apiUpdates.watcherIds = updates.watchers.map((w) => w.id)
      }

      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify(apiUpdates),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update ticket')
      }
      const responseData: TicketAPIResponse = await res.json()
      return transformTicket(responseData)
    },
    onMutate: async ({ projectId, ticketId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.byProject(projectId) })

      // Get snapshot before update
      const columns = useBoardStore.getState().getColumns(projectId)
      const previousColumns = columns.map((col) => ({
        ...col,
        tickets: col.tickets.map((t) => ({ ...t })),
      }))

      // Optimistic update
      updateTicketInStore(projectId, ticketId, updates)

      return { previousColumns }
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.previousColumns) {
        useBoardStore.getState().setColumns(projectId, context.previousColumns)
      }
      toast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface DeleteTicketInput {
  projectId: string
  ticketId: string
  columnId: string
  deletedTicket: TicketWithRelations
}

/**
 * Delete a ticket
 */
export function useDeleteTicket() {
  const queryClient = useQueryClient()
  const { removeTicket, addTicket } = useBoardStore()

  return useMutation({
    mutationFn: async ({ projectId, ticketId }: DeleteTicketInput) => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'X-Tab-Id': getTabId(),
        },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete ticket')
      }
      return res.json()
    },
    onMutate: async ({ projectId, ticketId, deletedTicket, columnId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.byProject(projectId) })

      // Optimistic delete
      removeTicket(projectId, ticketId)

      return { deletedTicket, columnId }
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.deletedTicket && context?.columnId) {
        addTicket(projectId, context.columnId, context.deletedTicket)
      }
      toast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface MoveTicketInput {
  projectId: string
  ticketId: string
  fromColumnId: string
  toColumnId: string
  newOrder: number
  previousColumns: ColumnWithTickets[]
}

/**
 * Move a ticket to a different column (for drag-drop persistence)
 */
export function useMoveTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, ticketId, toColumnId, newOrder }: MoveTicketInput) => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({
          columnId: toColumnId,
          order: newOrder,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to move ticket')
      }
      const responseData: TicketAPIResponse = await res.json()
      return transformTicket(responseData)
    },
    onMutate: async ({ projectId }) => {
      // Store update already happened in handleDragEnd
      // Just cancel refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
    onError: (err, { projectId, previousColumns }) => {
      // Rollback using stored snapshot
      if (previousColumns) {
        useBoardStore.getState().setColumns(projectId, previousColumns)
      }
      toast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface MoveTicketsInput {
  projectId: string
  ticketIds: string[]
  toColumnId: string
  newOrder: number
  previousColumns: ColumnWithTickets[]
}

// ============================================================================
// Imperative API helpers (for use outside of React hooks, e.g., paste/undo/redo)
// ============================================================================

/**
 * Create a ticket via API (imperative, for paste operations)
 * Returns the created ticket with server-assigned ID and number
 */
export async function createTicketAPI(
  projectId: string,
  columnId: string,
  ticketData: Partial<TicketWithRelations> & { title: string },
): Promise<TicketWithRelations> {
  const res = await fetch(`/api/projects/${projectId}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tab-Id': getTabId(),
    },
    body: JSON.stringify({
      title: ticketData.title,
      description: ticketData.description ?? null,
      type: ticketData.type ?? 'task',
      priority: ticketData.priority ?? 'medium',
      columnId,
      assigneeId: ticketData.assigneeId ?? null,
      sprintId: ticketData.sprintId ?? null,
      parentId: ticketData.parentId ?? null,
      storyPoints: ticketData.storyPoints ?? null,
      estimate: ticketData.estimate ?? null,
      startDate: ticketData.startDate?.toISOString?.() ?? null,
      dueDate: ticketData.dueDate?.toISOString?.() ?? null,
      environment: ticketData.environment ?? null,
      affectedVersion: ticketData.affectedVersion ?? null,
      fixVersion: ticketData.fixVersion ?? null,
      labelIds: ticketData.labels?.map((l) => l.id) ?? [],
      watcherIds: ticketData.watchers?.map((w) => w.id) ?? [],
    }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create ticket')
  }
  const responseData: TicketAPIResponse = await res.json()
  return transformTicket(responseData)
}

/**
 * Delete a ticket via API (imperative, for undo/redo operations)
 */
export async function deleteTicketAPI(projectId: string, ticketId: string): Promise<void> {
  // Skip API call for temp IDs (pasted tickets not yet synced)
  if (ticketId.startsWith('ticket-')) {
    console.warn('Skipping API delete for temp ticket ID:', ticketId)
    return
  }

  const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
    method: 'DELETE',
    headers: {
      'X-Tab-Id': getTabId(),
    },
  })
  if (!res.ok) {
    const error = await res.json()
    console.error('Delete ticket API error:', { projectId, ticketId, error })
    throw new Error(error.error || 'Failed to delete ticket')
  }
}

/**
 * Update a ticket via API (imperative, for undo/redo operations)
 */
export async function updateTicketAPI(
  projectId: string,
  ticketId: string,
  updates: Partial<TicketWithRelations>,
): Promise<TicketWithRelations> {
  // Convert TicketWithRelations updates to API format
  const apiUpdates: Record<string, unknown> = {}

  const scalarFields = [
    'title',
    'description',
    'type',
    'priority',
    'columnId',
    'order',
    'storyPoints',
    'estimate',
    'environment',
    'affectedVersion',
    'fixVersion',
    'assigneeId',
    'creatorId',
    'sprintId',
    'parentId',
  ]

  for (const field of scalarFields) {
    if (field in updates) {
      apiUpdates[field] = updates[field as keyof typeof updates]
    }
  }

  if ('startDate' in updates) {
    apiUpdates.startDate = updates.startDate?.toISOString?.() ?? null
  }
  if ('dueDate' in updates) {
    apiUpdates.dueDate = updates.dueDate?.toISOString?.() ?? null
  }
  if ('labels' in updates && updates.labels) {
    apiUpdates.labelIds = updates.labels.map((l) => l.id)
  }
  if ('watchers' in updates && updates.watchers) {
    apiUpdates.watcherIds = updates.watchers.map((w) => w.id)
  }

  // Skip API call for temp IDs (pasted tickets not yet synced)
  if (ticketId.startsWith('ticket-')) {
    console.warn('Skipping API update for temp ticket ID:', ticketId)
    // Return the updates as-is for temp tickets
    return { id: ticketId, ...updates } as TicketWithRelations
  }

  const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Tab-Id': getTabId(),
    },
    body: JSON.stringify(apiUpdates),
  })
  if (!res.ok) {
    const error = await res.json()
    console.error('Update ticket API error:', { projectId, ticketId, apiUpdates, error })
    throw new Error(error.error || 'Failed to update ticket')
  }
  const responseData: TicketAPIResponse = await res.json()
  return transformTicket(responseData)
}

/**
 * Batch create tickets via API (for paste operations)
 * Creates tickets in parallel for performance
 * Returns map of temp ID -> server ticket for replacing optimistic tickets
 */
export async function batchCreateTicketsAPI(
  projectId: string,
  tickets: Array<{ tempId: string; columnId: string; ticketData: Partial<TicketWithRelations> & { title: string } }>,
): Promise<Map<string, TicketWithRelations>> {
  const results = new Map<string, TicketWithRelations>()

  // Create in parallel for better performance
  const promises = tickets.map(async ({ tempId, columnId, ticketData }) => {
    const serverTicket = await createTicketAPI(projectId, columnId, ticketData)
    return { tempId, serverTicket }
  })

  const settled = await Promise.allSettled(promises)

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.set(result.value.tempId, result.value.serverTicket)
    } else {
      console.error('Failed to create ticket:', result.reason)
    }
  }

  return results
}

/**
 * Batch delete tickets via API (for redo delete operations)
 */
export async function batchDeleteTicketsAPI(
  projectId: string,
  ticketIds: string[],
): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []

  // Delete in parallel
  const promises = ticketIds.map(async (ticketId) => {
    await deleteTicketAPI(projectId, ticketId)
    return ticketId
  })

  const settled = await Promise.allSettled(promises)

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      succeeded.push(result.value)
    } else {
      failed.push(ticketIds[i])
      console.error(`Failed to delete ticket ${ticketIds[i]}:`, result.reason)
    }
  }

  return { succeeded, failed }
}

/**
 * Move multiple tickets to a different column (for multi-select drag-drop)
 */
export function useMoveTickets() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, ticketIds, toColumnId, newOrder }: MoveTicketsInput) => {
      // Update all tickets in sequence (could be parallelized in future)
      const results: TicketWithRelations[] = []

      for (let i = 0; i < ticketIds.length; i++) {
        const ticketId = ticketIds[i]
        const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Tab-Id': getTabId(),
          },
          body: JSON.stringify({
            columnId: toColumnId,
            order: newOrder + i,
          }),
        })
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || `Failed to move ticket ${ticketId}`)
        }
        const responseData: TicketAPIResponse = await res.json()
        results.push(transformTicket(responseData))
      }

      return results
    },
    onMutate: async ({ projectId }) => {
      // Store update already happened in handleDragEnd
      // Just cancel refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
    onError: (err, { projectId, previousColumns }) => {
      // Rollback using stored snapshot
      if (previousColumns) {
        useBoardStore.getState().setColumns(projectId, previousColumns)
      }
      toast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}
