/**
 * Unified action modules for ticket operations.
 *
 * These modules consolidate the action logic used by context menus, keyboard shortcuts,
 * and other UI triggers. Each action module handles:
 * - Optimistic updates for immediate UI feedback
 * - API persistence for real projects
 * - Undo/redo support with proper toast integration
 * - Selection management
 *
 * Usage:
 * ```typescript
 * import { pasteTickets, deleteTickets } from '@/lib/actions'
 *
 * // Paste copied tickets
 * pasteTickets({ projectId, columns })
 *
 * // Delete selected tickets
 * deleteTickets({ projectId, tickets })
 * ```
 */

export * from './delete-tickets'
export * from './paste-tickets'
export * from './types'
