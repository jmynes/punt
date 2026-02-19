'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getTabId } from '@/hooks/use-realtime'
import type { CreateTicketInput, UpdateTicketInput } from '@/lib/data-provider'
import { getDataProvider } from '@/lib/data-provider'
import { showToast } from '@/lib/toast'
import { useBoardStore } from '@/stores/board-store'
import type { Column, ColumnWithTickets, TicketFormData, TicketWithRelations } from '@/types'

export const ticketKeys = {
  all: ['tickets'] as const,
  byProject: (projectId: string) => ['tickets', 'project', projectId] as const,
  detail: (projectId: string, ticketId: string) =>
    ['tickets', 'project', projectId, ticketId] as const,
  search: (projectId: string, query: string) => ['tickets', 'search', projectId, query] as const,
}

export const columnKeys = {
  all: ['columns'] as const,
  byProject: (projectId: string) => ['columns', 'project', projectId] as const,
}

/**
 * Fetch columns for a project (creates defaults if none exist)
 */
export function useColumnsByProject(projectId: string, options?: { enabled?: boolean }) {
  const { setColumns, getColumns } = useBoardStore()

  const query = useQuery<Column[]>({
    queryKey: columnKeys.byProject(projectId),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      // getColumnsWithTickets returns ColumnWithTickets[], but API returns just columns
      // Extract column data without tickets for this hook
      const columnsWithTickets = await provider.getColumnsWithTickets(projectId)
      return columnsWithTickets.map(({ id, name, icon, color, order, projectId }) => ({
        id,
        name,
        icon: icon ?? null,
        color: color ?? null,
        order,
        projectId,
      }))
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

/**
 * Fetch all tickets for a project and sync with board store
 */
export function useTicketsByProject(projectId: string, options?: { enabled?: boolean }) {
  const { syncTicketsFromAPI } = useBoardStore()

  const query = useQuery<TicketWithRelations[]>({
    queryKey: ticketKeys.byProject(projectId),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.getTickets(projectId)
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

interface CreateTicketMutationInput {
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
  const { addTicket, removeTicket } = useBoardStore()

  return useMutation({
    mutationFn: async ({ projectId, columnId, data }: CreateTicketMutationInput) => {
      const provider = getDataProvider(getTabId())
      const input: CreateTicketInput = {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        columnId,
        storyPoints: data.storyPoints,
        estimate: data.estimate,
        startDate: data.startDate,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId,
        reporterId: data.reporterId,
        sprintId: data.sprintId,
        parentId: data.parentId,
        labelIds: data.labelIds,
      }
      return provider.createTicket(projectId, input)
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
      showToast.error(err.message)
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

interface UpdateTicketMutationInput {
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
    mutationFn: async ({ projectId, ticketId, updates }: UpdateTicketMutationInput) => {
      const provider = getDataProvider(getTabId())

      // Convert TicketWithRelations updates to UpdateTicketInput format
      const apiUpdates: UpdateTicketInput = {}

      // Copy scalar fields
      if ('title' in updates) apiUpdates.title = updates.title
      if ('description' in updates) apiUpdates.description = updates.description
      if ('type' in updates) apiUpdates.type = updates.type
      if ('priority' in updates) apiUpdates.priority = updates.priority
      if ('columnId' in updates) apiUpdates.columnId = updates.columnId
      if ('order' in updates) apiUpdates.order = updates.order
      if ('storyPoints' in updates) apiUpdates.storyPoints = updates.storyPoints
      if ('estimate' in updates) apiUpdates.estimate = updates.estimate
      if ('assigneeId' in updates) apiUpdates.assigneeId = updates.assigneeId
      if ('creatorId' in updates) apiUpdates.reporterId = updates.creatorId // Map to API field name
      if ('sprintId' in updates) apiUpdates.sprintId = updates.sprintId
      if ('parentId' in updates) apiUpdates.parentId = updates.parentId
      if ('startDate' in updates) apiUpdates.startDate = updates.startDate
      if ('dueDate' in updates) apiUpdates.dueDate = updates.dueDate
      if ('resolution' in updates) apiUpdates.resolution = updates.resolution

      // Convert labels to labelIds
      if ('labels' in updates && updates.labels) {
        apiUpdates.labelIds = updates.labels.map((l) => l.id)
      }

      return provider.updateTicket(projectId, ticketId, apiUpdates)
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
      showToast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface DeleteTicketMutationInput {
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
    mutationFn: async ({ projectId, ticketId }: DeleteTicketMutationInput) => {
      const provider = getDataProvider(getTabId())
      await provider.deleteTicket(projectId, ticketId)
      return { success: true }
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
      showToast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface MoveTicketMutationInput {
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
    mutationFn: async ({ projectId, ticketId, toColumnId, newOrder }: MoveTicketMutationInput) => {
      const provider = getDataProvider(getTabId())
      return provider.moveTicket(projectId, ticketId, {
        columnId: toColumnId,
        order: newOrder,
      })
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
      showToast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

interface MoveTicketsMutationInput {
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
  const provider = getDataProvider(getTabId())

  const input: CreateTicketInput = {
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
    startDate: ticketData.startDate ?? null,
    dueDate: ticketData.dueDate ?? null,
    labelIds: ticketData.labels?.map((l) => l.id) ?? [],
    // For undo/restore operations - preserve original creation timestamp
    createdAt: ticketData.createdAt ?? null,
  }

  return provider.createTicket(projectId, input)
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

  const provider = getDataProvider(getTabId())
  await provider.deleteTicket(projectId, ticketId)
}

/**
 * Update a ticket via API (imperative, for undo/redo operations)
 */
export async function updateTicketAPI(
  projectId: string,
  ticketId: string,
  updates: Partial<TicketWithRelations>,
): Promise<TicketWithRelations> {
  // Skip API call for temp IDs (pasted tickets not yet synced)
  if (ticketId.startsWith('ticket-')) {
    console.warn('Skipping API update for temp ticket ID:', ticketId)
    // Return the updates as-is for temp tickets
    return { id: ticketId, ...updates } as TicketWithRelations
  }

  const provider = getDataProvider(getTabId())

  // Convert TicketWithRelations updates to UpdateTicketInput format
  const apiUpdates: UpdateTicketInput = {}

  if ('title' in updates) apiUpdates.title = updates.title
  if ('description' in updates) apiUpdates.description = updates.description
  if ('type' in updates) apiUpdates.type = updates.type
  if ('priority' in updates) apiUpdates.priority = updates.priority
  if ('columnId' in updates) apiUpdates.columnId = updates.columnId
  if ('order' in updates) apiUpdates.order = updates.order
  if ('storyPoints' in updates) apiUpdates.storyPoints = updates.storyPoints
  if ('estimate' in updates) apiUpdates.estimate = updates.estimate
  if ('assigneeId' in updates) apiUpdates.assigneeId = updates.assigneeId
  if ('creatorId' in updates) apiUpdates.reporterId = updates.creatorId // Map to API field name
  if ('sprintId' in updates) apiUpdates.sprintId = updates.sprintId
  if ('parentId' in updates) apiUpdates.parentId = updates.parentId
  if ('startDate' in updates) apiUpdates.startDate = updates.startDate
  if ('dueDate' in updates) apiUpdates.dueDate = updates.dueDate
  if ('resolution' in updates) apiUpdates.resolution = updates.resolution

  if ('labels' in updates && updates.labels) {
    apiUpdates.labelIds = updates.labels.map((l) => l.id)
  }

  return provider.updateTicket(projectId, ticketId, apiUpdates)
}

/**
 * Batch create tickets via API (for paste operations)
 * Creates tickets in parallel for performance
 * Returns map of temp ID -> server ticket for replacing optimistic tickets
 */
export async function batchCreateTicketsAPI(
  projectId: string,
  tickets: Array<{
    tempId: string
    columnId: string
    ticketData: Partial<TicketWithRelations> & { title: string }
  }>,
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
    mutationFn: async ({
      projectId,
      ticketIds,
      toColumnId,
      newOrder,
    }: MoveTicketsMutationInput) => {
      const provider = getDataProvider(getTabId())
      return provider.moveTickets(projectId, ticketIds, toColumnId, newOrder)
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
      showToast.error(err.message)
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
  })
}

// ============================================================================
// Sprint queries
// ============================================================================

export const sprintKeys = {
  all: ['sprints'] as const,
  byProject: (projectId: string) => ['sprints', 'project', projectId] as const,
}

/**
 * Fetch all sprints for a project
 */
export function useProjectSprints(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sprintKeys.byProject(projectId),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.getSprints(projectId)
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - sprints change rarely
    enabled: options?.enabled ?? true,
  })
}

// ============================================================================
// Label queries
// ============================================================================

export const labelKeys = {
  all: ['labels'] as const,
  byProject: (projectId: string) => ['labels', 'project', projectId] as const,
}

/**
 * Fetch all labels for a project
 */
export function useProjectLabels(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: labelKeys.byProject(projectId),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.getLabels(projectId)
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - labels change rarely
    enabled: options?.enabled ?? true,
  })
}

interface CreateLabelMutationInput {
  projectId: string
  name: string
  color?: string
}

/**
 * Create a new label for a project
 * Returns existing label if one with the same name (case-insensitive) exists
 */
export function useCreateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, name, color }: CreateLabelMutationInput) => {
      const provider = getDataProvider(getTabId())
      return provider.createLabel(projectId, { name, color })
    },
    onSuccess: (_data, { projectId }) => {
      // Invalidate labels query to refetch with new label
      queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

interface DeleteLabelMutationInput {
  projectId: string
  labelId: string
}

/**
 * Delete a label from a project
 * Removes the label from all tickets that use it
 */
export function useDeleteLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, labelId }: DeleteLabelMutationInput) => {
      const provider = getDataProvider(getTabId())
      await provider.deleteLabel(projectId, labelId)
      return { success: true }
    },
    onSuccess: (_data, { projectId }) => {
      // Invalidate labels query to refetch without deleted label
      queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
      // Also invalidate tickets as they may have had this label
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

interface UpdateLabelMutationInput {
  projectId: string
  labelId: string
  color: string
}

/**
 * Update a label's color
 */
export function useUpdateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, labelId, color }: UpdateLabelMutationInput) => {
      const provider = getDataProvider(getTabId())
      return provider.updateLabel(projectId, labelId, { color })
    },
    onSuccess: (_data, { projectId }) => {
      // Invalidate labels query to refetch with updated label
      queryClient.invalidateQueries({ queryKey: labelKeys.byProject(projectId) })
      // Also invalidate tickets as they display label colors
      queryClient.invalidateQueries({ queryKey: ticketKeys.byProject(projectId) })
    },
    onError: (err) => {
      showToast.error(err.message)
    },
  })
}

// ============================================================================
// Ticket search
// ============================================================================

/**
 * Search tickets within a project.
 * Only runs when query is non-empty (use with debounced input).
 */
export function useTicketSearch(projectId: string, query: string) {
  return useQuery<TicketWithRelations[]>({
    queryKey: ticketKeys.search(projectId, query),
    queryFn: async () => {
      const provider = getDataProvider(getTabId())
      return provider.searchTickets(projectId, { query, limit: 20 })
    },
    enabled: !!projectId && query.trim().length > 0,
    staleTime: 1000 * 30, // 30 seconds
    placeholderData: (prev) => prev, // Keep previous results while loading
  })
}
