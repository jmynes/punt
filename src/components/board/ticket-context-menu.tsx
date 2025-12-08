'use client'

import { cloneElement, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUndoStore } from '@/stores/undo-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'

type MenuProps = {
  ticket: TicketWithRelations
  children: React.ReactElement
}

function formatTicketId(ticket: TicketWithRelations): string {
  return ticket.key || `${ticket.number ?? ''}` || ticket.id
}

export function TicketContextMenu({ ticket, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement | null>(null)

  const columns = useBoardStore((s) => s.columns)
  const boardState = useBoardStore() as any
  const board = (useBoardStore as any).getState ? (useBoardStore as any).getState() : boardState
  const undoStore = useUndoStore.getState ? useUndoStore.getState() : useUndoStore()
  const uiStore = useUIStore.getState ? useUIStore.getState() : useUIStore()
  const selection = useSelectionStore()
  const selectionApi = (useSelectionStore as any).getState ? (useSelectionStore as any).getState() : selection
  const currentUser = useCurrentUser()
  const members = useProjectMembers()

  const selectedIds = useMemo(() => {
    const getIds =
      (useSelectionStore as any).getState?.().getSelectedIds ||
      (selection as any).getSelectedIds ||
      (() => [])
    const ids = getIds()
    return ids.length > 0 ? ids : [ticket.id]
  }, [selection, ticket.id])

  const multi = selectedIds.length > 1

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const ensureSelection = () => {
    const isSelected = selectionApi.isSelected || (() => false)
    const selectTicket = selectionApi.selectTicket || (() => {})
    if (!isSelected(ticket.id)) {
      selectTicket(ticket.id)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    ensureSelection()
    setOpen(true)
    setCoords({ x: e.clientX, y: e.clientY })
    children.props.onContextMenu?.(e)
  }

  const doCopy = () => {
    const copySelected = selectionApi.copySelected || (() => {})
    const getIds = selectionApi.getSelectedIds || (() => [])
    copySelected()
    const count = getIds().length
    toast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, { duration: 1500 })
    setOpen(false)
  }

  const doPaste = () => {
    const getCopiedIds = selectionApi.getCopiedIds || (() => [])
    const clearSelection = selectionApi.clearSelection || (() => {})
    const toggleTicket = selectionApi.toggleTicket || (() => {})
    const copiedIds = getCopiedIds()
    if (copiedIds.length === 0) return

    const ticketsToPaste: Array<{ ticket: TicketWithRelations; columnId: string }> = []
    for (const id of copiedIds) {
      for (const column of board.columns) {
        const t = column.tickets.find((tk) => tk.id === id)
        if (t) {
          ticketsToPaste.push({ ticket: t, columnId: column.id })
          break
        }
      }
    }
    if (ticketsToPaste.length === 0) return

    const newTickets: Array<{ ticket: TicketWithRelations; columnId: string }> = []
    const getNext = board.getNextTicketNumber || (() => Date.now())
    const addTicket = board.addTicket || (() => {})
    let nextNumber = getNext()

    for (const { ticket: t, columnId } of ticketsToPaste) {
      const newTicket: TicketWithRelations = {
        ...t,
        id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        number: nextNumber++,
        title: `${t.title} (copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      newTickets.push({ ticket: newTicket, columnId })
      addTicket(columnId, newTicket)
    }

    const toastId = toast.success(
      newTickets.length === 1 ? 'Ticket pasted' : `${newTickets.length} tickets pasted`,
      {
        description: newTickets.map(({ ticket }) => formatTicketId(ticket)).join(', '),
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            const removeTicket =
              (useBoardStore as any).getState?.().removeTicket || board.removeTicket || (() => {})
            for (const { ticket: t } of newTickets) removeTicket(t.id)
            toast.success('Paste undone', { duration: 1500 })
          },
        },
      },
    )
    undoStore.pushPaste(newTickets, toastId)

    clearSelection()
    newTickets.forEach(({ ticket }) => toggleTicket(ticket.id))
    setOpen(false)
  }

  const doSendTo = (toColumnId: string) => {
    const column = board.columns.find((c) => c.id === toColumnId)
    if (!column) return
    const toOrder = column.tickets.length
    const moveTickets = board.moveTickets || (() => {})
    const moveTicket = board.moveTicket || (() => {})

    if (multi) {
      moveTickets(selectedIds, toColumnId, toOrder)
    } else {
      const from = ticket.columnId
      moveTicket(ticket.id, from, toColumnId, toOrder)
    }
    setOpen(false)
  }

  const doDelete = () => {
    const ticketsToDelete: TicketWithRelations[] = []
    for (const col of board.columns) {
      for (const t of col.tickets) {
        if (selectedIds.includes(t.id)) ticketsToDelete.push(t)
      }
    }
    if (ticketsToDelete.length === 0) return
    const removeTicket = board.removeTicket || (() => {})
    ticketsToDelete.forEach((t) => removeTicket(t.id))
    toast.success(
      ticketsToDelete.length === 1
        ? `${formatTicketId(ticketsToDelete[0])} deleted`
        : `${ticketsToDelete.length} tickets deleted`,
    )
    setOpen(false)
  }

  const doEdit = () => {
    if (multi) return
    uiStore.setActiveTicketId(ticket.id)
    setOpen(false)
  }

  const doPriority = (priority: TicketWithRelations['priority']) => {
    const updateTicket = board.updateTicket || (() => {})
    selectedIds.forEach((id) => updateTicket(id, { priority }))
    toast.success(
      selectedIds.length === 1
        ? 'Priority updated'
        : `Priority updated for ${selectedIds.length} tickets`,
      { duration: 1500 },
    )
    setOpen(false)
  }

  const doAssign = (userId: string | null) => {
    const user = members.find((m) => m.id === userId) || null
    const updateTicket = board.updateTicket || (() => {})
    selectedIds.forEach((id) => updateTicket(id, { assignee: user ?? undefined, assigneeId: user?.id }))
    toast.success(
      selectedIds.length === 1
        ? user ? `Assigned to ${user.name}` : 'Unassigned'
        : user
          ? `Assigned ${selectedIds.length} tickets to ${user.name}`
          : `Unassigned ${selectedIds.length} tickets`,
      { duration: 1500 },
    )
    setOpen(false)
  }

  const contextChild = useMemo(
    () => cloneElement(children, { onContextMenu: handleContextMenu }),
    [children],
  )

  if (typeof document === 'undefined') {
    return contextChild
  }

  return (
    <>
      {contextChild}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="z-[200] min-w-[220px] rounded-md border border-zinc-800 bg-zinc-900 shadow-lg"
            style={{ position: 'fixed', left: coords.x, top: coords.y }}
          >
            <div className="py-1 text-sm text-zinc-200">
              <button className="w-full px-3 py-1.5 text-left hover:bg-zinc-800" onClick={doCopy}>
                Copy
              </button>
              <button className="w-full px-3 py-1.5 text-left hover:bg-zinc-800" onClick={doPaste}>
                Paste
              </button>
              <div className="my-1 border-t border-zinc-800" />
              <div className="px-3 py-1 text-xs uppercase text-zinc-500">Send to</div>
              {columns.map((col) => (
                <button
                  key={col.id}
                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-800"
                  onClick={() => doSendTo(col.id)}
                >
                  {col.name}
                </button>
              ))}
              <div className="my-1 border-t border-zinc-800" />
              {!multi && (
                <button className="w-full px-3 py-1.5 text-left hover:bg-zinc-800" onClick={doEdit}>
                  Edit
                </button>
              )}
              <button className="w-full px-3 py-1.5 text-left hover:bg-zinc-800" onClick={doDelete}>
                Delete
              </button>
              <div className="my-1 border-t border-zinc-800" />
              <div className="px-3 py-1 text-xs uppercase text-zinc-500">Priority</div>
              {['critical', 'highest', 'high', 'medium', 'low', 'lowest'].map((p) => (
                <button
                  key={p}
                  className="w-full px-3 py-1.5 text-left capitalize hover:bg-zinc-800"
                  onClick={() => doPriority(p as TicketWithRelations['priority'])}
                >
                  {p}
                </button>
              ))}
              <div className="my-1 border-t border-zinc-800" />
              <div className="px-3 py-1 text-xs uppercase text-zinc-500">Assign</div>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-zinc-800"
                onClick={() => doAssign(currentUser.id)}
              >
                Assign to me
              </button>
              {members.map((m) => (
                <button
                  key={m.id}
                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-800"
                  onClick={() => doAssign(m.id)}
                >
                  {m.name}
                </button>
              ))}
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-zinc-800"
                onClick={() => doAssign(null)}
              >
                Unassign
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

