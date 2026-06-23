import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockTicket } from '@/__tests__/utils/mocks'
import { batchCreateTicketsAPI } from '@/hooks/queries/use-tickets'
import { showToast } from '@/lib/toast'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { pasteTickets } from '../paste-tickets'

vi.mock('@/hooks/queries/use-tickets', () => ({
  batchCreateTicketsAPI: vi.fn(),
}))
vi.mock('@/lib/toast', () => ({
  showToast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('@/lib/undo-toast', () => ({
  showUndoRedoToast: vi.fn(),
}))

const mockBatchCreate = vi.mocked(batchCreateTicketsAPI)
const PROJECT_ID = 'project-1'

function seedColumns(tickets: TicketWithRelations[]): ColumnWithTickets[] {
  return [
    { id: 'col-1', name: 'To Do', order: 0, projectId: PROJECT_ID, tickets },
    { id: 'col-2', name: 'Done', order: 1, projectId: PROJECT_ID, tickets: [] },
  ]
}

describe('pasteTickets', () => {
  let columns: ColumnWithTickets[]
  let original: TicketWithRelations

  beforeEach(() => {
    vi.clearAllMocks()
    original = createMockTicket({ id: 'ticket-1', number: 1, columnId: 'col-1', title: 'Original' })
    columns = seedColumns([original])

    useBoardStore.setState({ projects: { [PROJECT_ID]: columns }, _hasHydrated: true })
    useSelectionStore.setState({ selectedTicketIds: new Set(), copiedTicketIds: [] })
    useUndoStore.setState({ undoStack: [], redoStack: [] })
    useUIStore.setState({ activeTicketId: null })
    useProjectsStore.setState({
      projects: [{ id: PROJECT_ID, key: 'PUNT', name: 'Punt', ticketCount: 1 }],
    })
    // Default: API echoes back a server ticket per temp id
    mockBatchCreate.mockResolvedValue(new Map())
  })

  describe('validation', () => {
    it('fails when there are no copied IDs', () => {
      const result = pasteTickets({ projectId: PROJECT_ID, columns })
      expect(result.success).toBe(false)
      expect(result.error).toBe('No tickets to paste')
    })

    it('fails when copied IDs match no ticket in the columns', () => {
      const result = pasteTickets({
        projectId: PROJECT_ID,
        columns,
        copiedIds: ['does-not-exist'],
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Could not find copied tickets')
    })

    it('falls back to the selection store copied IDs when none are passed', () => {
      useSelectionStore.setState({ copiedTicketIds: ['ticket-1'] })
      const result = pasteTickets({ projectId: PROJECT_ID, columns })
      expect(result.success).toBe(true)
      expect(result.newTickets).toHaveLength(1)
    })
  })

  describe('optimistic update (synchronous)', () => {
    it('adds a copy with an incremented number and "(copy)" suffix', () => {
      const result = pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'] })

      expect(result.success).toBe(true)
      const pasted = result.newTickets[0].ticket
      expect(pasted.title).toBe('Original (copy)')
      expect(pasted.number).toBe(2) // max existing (1) + 1
      expect(pasted.id).not.toBe('ticket-1') // fresh temp id

      // Board reflects the optimistic add in the same column
      const col1 = useBoardStore.getState().getColumns(PROJECT_ID)[0]
      expect(col1.tickets.map((t) => t.id)).toContain(pasted.id)
    })

    it('registers an undo entry for the paste', () => {
      pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'] })
      const stack = useUndoStore.getState().undoStack
      expect(stack).toHaveLength(1)
      expect(stack[0].action.type).toBe('paste')
    })

    it('selects only the newly pasted tickets, clearing prior selection', () => {
      useSelectionStore.setState({ selectedTicketIds: new Set(['some-old-id']) })
      const result = pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'] })

      const selected = useSelectionStore.getState().selectedTicketIds
      expect(selected.has('some-old-id')).toBe(false)
      expect(selected.has(result.newTickets[0].ticket.id)).toBe(true)
    })

    it('shows an undo/redo toast', () => {
      pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'] })
      expect(showUndoRedoToast).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({
          title: 'Ticket pasted',
        }),
      )
    })

    it('pluralizes the toast title for multiple tickets', () => {
      const second = createMockTicket({ id: 'ticket-2', number: 2, columnId: 'col-1' })
      columns = seedColumns([original, second])
      useBoardStore.setState({ projects: { [PROJECT_ID]: columns }, _hasHydrated: true })

      pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1', 'ticket-2'] })
      expect(showUndoRedoToast).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({
          title: '2 tickets pasted',
        }),
      )
    })

    it('opens the drawer for a single paste when enabled', () => {
      const result = pasteTickets({
        projectId: PROJECT_ID,
        columns,
        copiedIds: ['ticket-1'],
        openSinglePastedTicket: true,
      })
      expect(useUIStore.getState().activeTicketId).toBe(result.newTickets[0].ticket.id)
    })

    it('does not open the drawer when openSinglePastedTicket is false', () => {
      pasteTickets({
        projectId: PROJECT_ID,
        columns,
        copiedIds: ['ticket-1'],
        openSinglePastedTicket: false,
      })
      expect(useUIStore.getState().activeTicketId).toBeNull()
    })

    it('invokes the onComplete callback', () => {
      const onComplete = vi.fn()
      pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'], onComplete })
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  describe('persistence (asynchronous)', () => {
    it('replaces the optimistic temp ticket with the server ticket', async () => {
      // Build the server response dynamically from the temp ids the action generated.
      mockBatchCreate.mockImplementation(async (_projectId, toCreate) => {
        const map = new Map<string, TicketWithRelations>()
        for (const { tempId, columnId } of toCreate) {
          map.set(tempId, createMockTicket({ id: `server-${tempId}`, number: 2, columnId }))
        }
        return map
      })

      const result = pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'] })
      const tempId = result.newTickets[0].ticket.id

      await vi.waitFor(() => {
        const ids = useBoardStore
          .getState()
          .getColumns(PROJECT_ID)
          .flatMap((c) => c.tickets.map((t) => t.id))
        expect(ids).toContain(`server-${tempId}`)
        expect(ids).not.toContain(tempId)
      })
    })

    it('rolls back the optimistic ticket and shows an error when persistence fails', async () => {
      mockBatchCreate.mockRejectedValue(new Error('boom'))
      const result = pasteTickets({ projectId: PROJECT_ID, columns, copiedIds: ['ticket-1'] })
      const tempId = result.newTickets[0].ticket.id

      await vi.waitFor(() => {
        expect(showToast.error).toHaveBeenCalledWith('Failed to paste tickets')
      })
      const ids = useBoardStore
        .getState()
        .getColumns(PROJECT_ID)
        .flatMap((c) => c.tickets.map((t) => t.id))
      expect(ids).not.toContain(tempId)
    })
  })
})
