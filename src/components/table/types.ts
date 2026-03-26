import type { BacklogColumn, SortConfig, SortDirection } from '@/stores/backlog-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

/**
 * Context information passed to ticket table components.
 * Used to determine section identity and provide project context.
 */
export interface TableContext {
  /** Section identifier - sprint ID or 'backlog' */
  sectionId: string
  /** Sprint ID if this is a sprint section, null for backlog */
  sprintId: string | null
  /** Project key for ticket display (e.g., 'PUNT') */
  projectKey: string
  /** Project ID for API calls */
  projectId: string
  /** Board columns for status name lookup */
  statusColumns: ColumnWithTickets[]
}

/**
 * Props for the unified TicketTable component.
 */
export interface TicketTableProps {
  /** Context information for this table */
  context: TableContext
  /** Tickets to display in order */
  tickets: TicketWithRelations[]
  /** Column configuration from BacklogStore */
  columns: BacklogColumn[]
  /** All ticket IDs for range selection across sections */
  allTicketIds: string[]

  // External DnD integration (parent provides DndContext)
  /** IDs of tickets currently being dragged */
  draggingTicketIds?: string[]
  /** Insert index for drop indicator (null = no drop target) */
  dropPosition?: number | null

  // Optional features
  /** Whether to show the header row */
  showHeader?: boolean
  /** Current sort configuration */
  sort?: SortConfig | null
  /** Callback when a sortable column header is clicked */
  onToggleSort?: (columnId: string) => void
  /** Callback to explicitly set sort column and direction, or null to clear */
  onSetSort?: (sort: SortConfig | null) => void
  /** Whether columns can be reordered via drag-and-drop */
  enableColumnReorder?: boolean
  /** Callback to hide a column */
  onHideColumn?: (columnId: string) => void

  /** Whether manual reorder is disabled (e.g., a column sort is active) */
  reorderDisabled?: boolean

  // Overlay mode (for DragOverlay)
  /** If provided, renders a single ticket as overlay */
  overlayTicket?: TicketWithRelations | null
}

/**
 * Props for the TicketTableRow component.
 */
export interface TicketTableRowProps {
  /** The ticket to render */
  ticket: TicketWithRelations
  /** Context information for this table */
  context: TableContext
  /** Visible column configuration */
  columns: BacklogColumn[]
  /** All ticket IDs for range selection */
  allTicketIds: string[]
  /** Whether this row is currently being dragged */
  isBeingDragged?: boolean
  /** Whether to show drop indicator before this row */
  showDropIndicator?: boolean
  /** Number of items being dragged (for indicator display) */
  draggingCount?: number
  /** Whether this is a drag overlay (standalone rendering) */
  isOverlay?: boolean
  /** Whether manual reorder is disabled (e.g., a column sort is active) */
  reorderDisabled?: boolean
}

/**
 * Props for the TicketCell component.
 */
export interface TicketCellProps {
  /** Column configuration */
  column: BacklogColumn
  /** The ticket to render */
  ticket: TicketWithRelations
  /** Project key for ticket display (e.g., 'PUNT-123') */
  projectKey: string
  /** Function to get status name from column ID */
  getStatusName: (columnId: string) => string
}

/**
 * Props for the TicketTableHeader component.
 */
export interface TicketTableHeaderProps {
  /** Visible column configuration */
  columns: BacklogColumn[]
  /** Current sort configuration */
  sort?: SortConfig | null
  /** Callback when a sortable column header is clicked */
  onToggleSort?: (columnId: string) => void
  /** Callback to explicitly set sort column and direction, or null to clear */
  onSetSort?: (sort: SortConfig | null) => void
  /** Whether columns can be reordered */
  enableColumnReorder?: boolean
  /** Callback to hide a column */
  onHideColumn?: (columnId: string) => void
  /** All ticket IDs in this table section (for select-all) */
  allTicketIds?: string[]
}

/**
 * Props for the SortableHeader cell.
 */
export interface SortableHeaderCellProps {
  column: BacklogColumn
  sort?: SortConfig | null
  onToggleSort?: (columnId: string) => void
  onSetSort?: (sort: SortConfig | null) => void
  onHideColumn?: (columnId: string) => void
}

/**
 * Props for the TicketListSection component.
 * Shared wrapper around TicketTable used by SprintSection (and the backlog page).
 */
export interface TicketListSectionProps {
  /** Section identifier - sprint ID or 'backlog' */
  sectionId: string
  /** Sprint ID if this is a sprint section, null for backlog */
  sprintId: string | null
  /** Project key for ticket display */
  projectKey: string
  /** Project ID for API calls */
  projectId: string
  /** Board columns for status name lookup */
  statusColumns: ColumnWithTickets[]
  /** Pre-sorted, pre-filtered tickets to display */
  tickets: TicketWithRelations[]

  // DnD
  /** IDs of tickets currently being dragged */
  draggingTicketIds?: string[]
  /** Insert index for drop indicator (null = no drop target) */
  dropPosition?: number | null
  /** Droppable zone ID for this section */
  droppableId: string
  /** Data for the section droppable */
  droppableData: Record<string, unknown>
  /** Droppable zone ID for the end of the section */
  endDroppableId: string
  /** Data for the end-of-section droppable */
  endDroppableData: Record<string, unknown>

  // Sort
  /** Current sort configuration */
  sort: SortConfig | null
  /** Callback when a sortable column header is clicked */
  onToggleSort: (columnId: string) => void
  /** Callback to explicitly set sort, or null to clear */
  onSetSort: (sort: SortConfig | null) => void

  // Column features (optional — backlog enables, sprint doesn't)
  /** Whether columns can be reordered via drag-and-drop */
  enableColumnReorder?: boolean
  /** Callback to hide a column */
  onHideColumn?: (columnId: string) => void

  /** Whether manual reorder is disabled (e.g., a column sort is active) */
  reorderDisabled?: boolean

  // Layout
  /** Message shown in the empty drop zone */
  emptyMessage?: string
  /** Whether to show the table header row */
  showHeader?: boolean
  /** Custom class name for the container div */
  className?: string
  /** Custom class name for the end-of-list drop zone */
  endZoneClassName?: string

  // Callbacks
  /** Called when isOver state changes for the section droppable */
  onIsOver?: (isOver: boolean) => void
}

export type { BacklogColumn, SortConfig, SortDirection }
