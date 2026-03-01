'use client'

import { useCallback } from 'react'
import { useSelectionStore } from '@/stores/selection-store'

/**
 * Selectors for interactive elements that should NOT trigger deselection.
 * Clicking on these elements (or their descendants) will be ignored.
 */
const INTERACTIVE_SELECTORS = [
  // Ticket elements (board cards and table rows)
  '[data-ticket-card]',
  '[data-ticket-row]',
  // Standard interactive elements
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  // ARIA roles for menus, dialogs, popovers
  '[role="menuitem"]',
  '[role="menu"]',
  '[role="option"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[role="combobox"]',
  '[role="tab"]',
  // Radix UI primitives (dropdowns, popovers, tooltips, etc.)
  '[data-radix-popper-content-wrapper]',
  '[data-radix-select-content]',
  '[data-radix-popover-content]',
  '[data-radix-dropdown-menu-content]',
  '[data-radix-context-menu-content]',
  // Sonner toasts
  '[data-sonner-toast]',
].join(', ')

/**
 * Hook that returns a click handler for deselecting tickets when clicking
 * on empty (non-interactive) space. Attach this handler to the outermost
 * page container so that clicks on headers, filter bars, and empty areas
 * all clear the selection.
 *
 * Interactive elements (buttons, inputs, links, menus, ticket cards/rows,
 * Radix UI popovers, etc.) are excluded so clicking them doesn't accidentally
 * clear the selection.
 */
export function useClickToDeselect() {
  const clearSelection = useSelectionStore((s) => s.clearSelection)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement

      // Don't interfere if the click is on an interactive element
      if (target.closest(INTERACTIVE_SELECTORS)) {
        return
      }

      // Only clear if there's actually something selected
      if (useSelectionStore.getState().selectedTicketIds.size > 0) {
        clearSelection()
      }
    },
    [clearSelection],
  )

  return handleClick
}
