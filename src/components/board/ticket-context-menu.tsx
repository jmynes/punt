'use client'

import {
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Pencil,
  Send,
  Trash2,
  UserCheck,
  User as UserIcon,
} from 'lucide-react'
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { PriorityBadge } from '@/components/common/priority-badge'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { getStatusIcon } from '@/lib/status-icons'
import { formatTicketId, formatTicketIds } from '@/lib/ticket-format'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'

type MenuProps = {
  ticket: TicketWithRelations
  children: React.ReactElement
}

export function TicketContextMenu({ ticket, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement | null>(null)

  const { getColumns } = useBoardStore()
  const { activeProjectId } = useUIStore()
  const projectId = activeProjectId || '1'
  const columns = getColumns(projectId)
  const boardState = useBoardStore()
  const board = (useBoardStore as typeof useBoardStore & { getState?: () => ReturnType<typeof useBoardStore> }).getState?.() ?? boardState
  const undoStore = (useUndoStore as typeof useUndoStore & { getState?: () => ReturnType<typeof useUndoStore> }).getState?.() ?? useUndoStore()
  const uiStore = (useUIStore as typeof useUIStore & { getState?: () => ReturnType<typeof useUIStore> }).getState?.() ?? useUIStore()
  const selection = useSelectionStore()
  const selectionApi = (useSelectionStore as typeof useSelectionStore & { getState?: () => ReturnType<typeof useSelectionStore> }).getState?.() ?? selection
  const _shortcutsApi = uiStore
  const currentUser = useCurrentUser()
  const members = useProjectMembers()
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TicketWithRelations[]>([])

  const selectedIds = useMemo(() => {
    const selectionState = useSelectionStore.getState ? useSelectionStore.getState() : selection
    const getIds = (selectionState as { getSelectedIds?: () => string[] }).getSelectedIds || (() => [])
    const ids = getIds()
    return ids.length > 0 ? ids : [ticket.id]
  }, [selection, ticket.id])

  const multi = selectedIds.length > 1
  const [submenu, setSubmenu] = useState<null | {
    id: 'priority' | 'assign' | 'send'
    anchor: { x: number; y: number; height: number }
  }>(null)

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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      ensureSelection()
      setOpen(true)
      setCoords({ x: e.clientX, y: e.clientY })
      setSubmenu(null)
      ;(children.props as { onContextMenu?: (e: React.MouseEvent) => void })?.onContextMenu?.(e)
    },
    [children, ensureSelection],
  )

  const doCopy = () => {
    const copySelected = selectionApi.copySelected || (() => {})
    const getIds = selectionApi.getSelectedIds || (() => [])
    copySelected()
    const ids = getIds()
    const ticketKeys = formatTicketIds(columns, ids)
    const count = ids.length
    toast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, {
      description: ticketKeys.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 2000,
    })
    setOpen(false)
    setSubmenu(null)
  }

  const doPaste = () => {
    const getCopiedIds = selectionApi.getCopiedIds || (() => [])
    const clearSelection = selectionApi.clearSelection || (() => {})
    const toggleTicket = selectionApi.toggleTicket || (() => {})
    const copiedIds = getCopiedIds()
    if (copiedIds.length === 0) return

    const ticketsToPaste: Array<{ ticket: TicketWithRelations; columnId: string }> = []
    for (const id of copiedIds) {
      for (const column of columns) {
        const t = column.tickets.find((tk: TicketWithRelations) => tk.id === id)
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
    let nextNumber = getNext(projectId)

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
      addTicket(projectId, columnId, newTicket)
    }

    const uiState = useUIStore.getState ? useUIStore.getState() : uiStore
    const showUndo = uiState.showUndoButtons ?? true
    const boardState = useBoardStore.getState ? useBoardStore.getState() : board
    const removeTicket = boardState.removeTicket || (() => {})
    const addTicketAgain = boardState.addTicket || (() => {})

    const toastId = showUndoRedoToast('success', {
      title: newTickets.length === 1 ? 'Ticket pasted' : `${newTickets.length} tickets pasted`,
      description: newTickets.map(({ ticket }) => formatTicketId(ticket)).join(', '),
      duration: 5000,
      showUndoButtons: showUndo,
      onUndo: () => {
        for (const { ticket: t } of newTickets) removeTicket(projectId, t.id)
      },
      onRedo: () => {
        for (const { ticket: t, columnId } of newTickets) addTicketAgain(projectId, columnId, t)
      },
      undoneTitle: 'Paste undone',
      redoneTitle: 'Paste redone',
    })
    undoStore.pushPaste(newTickets, toastId)

    clearSelection()
    for (const { ticket } of newTickets) {
      toggleTicket(ticket.id)
    }
    setOpen(false)
    setSubmenu(null)
  }

  const doSendTo = (toColumnId: string) => {
    const column = columns.find((c: ColumnWithTickets) => c.id === toColumnId)
    if (!column) return
    const toOrder = column.tickets.length
    const moveTickets = board.moveTickets || (() => {})
    const moveTicket = board.moveTicket || (() => {})

    const movableIds = selectedIds.filter((id: string) => {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      return current && current.columnId !== toColumnId
    })
    if (movableIds.length === 0) return

    const beforeColumns = columns.map((col: ColumnWithTickets) => ({
      ...col,
      tickets: col.tickets.map((t) => ({ ...t })),
    }))

    if (movableIds.length > 1) {
      moveTickets(projectId, movableIds, toColumnId, toOrder)
    } else {
      const from = ticket.columnId
      moveTicket(projectId, movableIds[0], from, toColumnId, toOrder)
    }

    const boardStateAfter = useBoardStore.getState ? useBoardStore.getState() : board
    const afterColumns = boardStateAfter.getColumns(projectId).map((col: ColumnWithTickets) => ({
      ...col,
      tickets: col.tickets.map((t: TicketWithRelations) => ({ ...t })),
    }))

    const moves = movableIds.map((id: string) => ({
      ticketId: id,
      fromColumnId:
        beforeColumns.find((c: ColumnWithTickets) => c.tickets.some((t) => t.id === id))?.id || '',
      toColumnId: toColumnId,
    }))
    const fromColumnName =
      moves.length === 1
        ? beforeColumns.find((c: ColumnWithTickets) => c.id === moves[0].fromColumnId)?.name ||
          'Source'
        : 'Multiple'
    const toColumnName = column.name

    const ticketKeys = formatTicketIds(
      afterColumns,
      moves.map((m: { ticketId: string }) => m.ticketId),
    )

    const toastTitle =
      moves.length === 1
        ? `Ticket moved from ${fromColumnName}`
        : `${moves.length} tickets moved from ${fromColumnName}`
    const { icon: StatusIcon, color: statusColor } = getStatusIcon(toColumnName)
    const toastDescription =
      moves.length === 1 ? (
        <div className="flex items-center gap-1.5">
          <span>{`${ticketKeys[0]} Moved to`}</span>
          <StatusIcon className={`h-4 w-4 ${statusColor}`} aria-hidden />
          <span>{toColumnName}</span>
        </div>
      ) : (
        <div className="space-y-1">
          {ticketKeys.map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span>{`${k} Moved to`}</span>
              <StatusIcon className={`h-4 w-4 ${statusColor}`} aria-hidden />
              <span>{toColumnName}</span>
            </div>
          ))}
        </div>
      )

    const uiState = useUIStore.getState ? useUIStore.getState() : uiStore
    const showUndo = uiState.showUndoButtons ?? true
    const boardStateMove = useBoardStore.getState ? useBoardStore.getState() : board
    const toastId = showUndoRedoToast('success', {
      title: toastTitle,
      description: toastDescription,
      duration: 3000,
      showUndoButtons: showUndo,
      onUndo: () => {
        boardStateMove.setColumns(projectId, beforeColumns)
      },
      onRedo: () => {
        boardStateMove.setColumns(projectId, afterColumns)
      },
      undoneTitle: 'Move undone',
      redoneTitle: toastTitle,
      redoneDescription: toastDescription,
    })

    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushMove(moves, fromColumnName, toColumnName, toastId, beforeColumns, afterColumns)

    setOpen(false)
    setSubmenu(null)
  }

  const doDelete = () => {
    const ticketsToDelete: TicketWithRelations[] = []
    for (const col of columns) {
      for (const t of col.tickets) {
        if (selectedIds.includes(t.id)) ticketsToDelete.push(t)
      }
    }
    if (ticketsToDelete.length === 0) return
    setPendingDelete(ticketsToDelete)
    setShowDeleteConfirm(true)
    setOpen(false)
    setSubmenu(null)
  }

  const doEdit = () => {
    if (multi) return
    uiStore.setActiveTicketId(ticket.id)
    setOpen(false)
    setSubmenu(null)
  }

  const doPriority = (priority: TicketWithRelations['priority']) => {
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current || current.priority === priority) continue
      const after = { ...current, priority }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, { priority })
    }
    if (updates.length === 0) return

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    const toastId = toast.success(
      updates.length === 1 ? 'Priority updated' : `${updates.length} priorities updated`,
      { description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '), duration: 3000 },
    )
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(updates, toastId)

    setOpen(false)
    setSubmenu(null)
  }

  const doAssign = (userId: string | null) => {
    const user = members.find((m) => m.id === userId) || null
    const updateTicket = board.updateTicket || (() => {})
    const updates: { ticketId: string; before: TicketWithRelations; after: TicketWithRelations }[] =
      []
    for (const id of selectedIds) {
      const current = columns
        .flatMap((c: ColumnWithTickets) => c.tickets)
        .find((t: TicketWithRelations) => t.id === id)
      if (!current) continue
      const currentAssignee = current.assigneeId || null
      if (currentAssignee === userId) continue
      const after: TicketWithRelations = {
        ...current,
        assignee: user ?? null,
        assigneeId: user?.id ?? null,
      }
      updates.push({ ticketId: id, before: current, after })
      updateTicket(projectId, id, { assignee: user ?? null, assigneeId: user?.id ?? null })
    }
    if (updates.length === 0) return

    const ticketKeys = formatTicketIds(
      columns,
      updates.map((u) => u.ticketId),
    )

    const msg =
      updates.length === 1
        ? user
          ? `Assigned to ${user.name}`
          : 'Unassigned'
        : user
          ? `Assigned ${updates.length} tickets to ${user.name}`
          : `Unassigned ${updates.length} tickets`

    const toastId = toast.success(msg, {
      description: updates.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 3000,
    })
    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushUpdate(updates, toastId)

    setOpen(false)
    setSubmenu(null)
  }

  const confirmDeleteNow = () => {
    const ticketsToDelete = pendingDelete
    if (ticketsToDelete.length === 0) return

    const removeTicket = board.removeTicket || (() => {})
    const addTicket = board.addTicket || (() => {})

    const deletedBatch = ticketsToDelete.map((t) => ({ ticket: t, columnId: t.columnId }))
    const ticketKeys = ticketsToDelete.map((t) => formatTicketId(t))

    for (const t of ticketsToDelete) {
      removeTicket(projectId, t.id)
    }
    selectionApi.clearSelection?.()

    const uiState = useUIStore.getState ? useUIStore.getState() : uiStore
    const showUndo = uiState.showUndoButtons ?? true
    const toastId = showUndoRedoToast('error', {
      title:
        ticketsToDelete.length === 1
          ? 'Ticket deleted'
          : `${ticketsToDelete.length} tickets deleted`,
      description: ticketsToDelete.length === 1 ? ticketKeys[0] : ticketKeys.join(', '),
      duration: 5000,
      showUndoButtons: showUndo,
      onUndo: () => {
        for (const { ticket, columnId } of deletedBatch) {
          addTicket(projectId, columnId, ticket)
        }
        useUndoStore.getState?.()?.removeEntry?.(toastId)
      },
      onRedo: () => {
        for (const { ticket } of deletedBatch) {
          removeTicket(projectId, ticket.id)
        }
      },
      undoneTitle:
        ticketsToDelete.length === 1
          ? 'Ticket restored'
          : `${ticketsToDelete.length} tickets restored`,
      redoneTitle:
        ticketsToDelete.length === 1 ? 'Delete redone' : `${ticketsToDelete.length} deletes redone`,
    })

    const undoState = useUndoStore.getState ? useUndoStore.getState() : undoStore
    undoState.pushDeletedBatch(deletedBatch, toastId)

    setPendingDelete([])
    setShowDeleteConfirm(false)
  }

  const contextChild = useMemo(
    () => cloneElement(children as React.ReactElement<{ onContextMenu?: (e: React.MouseEvent) => void }>, { onContextMenu: handleContextMenu }),
    [children, handleContextMenu],
  )

  if (typeof document === 'undefined') {
    return contextChild
  }

  const openSubmenu = (id: 'priority' | 'assign' | 'send') => (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSubmenu({ id, anchor: { x: rect.right, y: rect.top, height: rect.height } })
  }

  const closeSubmenu = () => setSubmenu(null)

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
            <div className="py-1 text-sm text-zinc-200 relative">
              <div className="px-3 pb-1 pt-2 text-xs uppercase text-zinc-500">
                {multi ? `Modify ${selectedIds.length} Tasks` : 'Modify Task'}
              </div>
              <MenuButton
                icon={<UserIcon className="h-4 w-4" />}
                label="Assign"
                trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                onMouseEnter={openSubmenu('assign')}
              />
              <MenuButton
                icon={<UserCheck className="h-4 w-4" />}
                label="Priority"
                trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                onMouseEnter={openSubmenu('priority')}
              />
              {!multi && (
                <MenuButton
                  icon={<Pencil className="h-4 w-4" />}
                  label="Edit"
                  onMouseEnter={closeSubmenu}
                  onClick={doEdit}
                />
              )}

              <MenuSection title="Status">
                <MenuButton
                  icon={<Send className="h-4 w-4" />}
                  label="Status"
                  trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                  onMouseEnter={openSubmenu('send')}
                />
              </MenuSection>

              <MenuSection title="Operations">
                <MenuButton
                  icon={<ClipboardCopy className="h-4 w-4" />}
                  label="Copy"
                  shortcut="Ctrl/Cmd + C"
                  onMouseEnter={closeSubmenu}
                  onClick={doCopy}
                />
                <MenuButton
                  icon={<ClipboardPaste className="h-4 w-4" />}
                  label="Paste"
                  shortcut="Ctrl/Cmd + V"
                  onMouseEnter={closeSubmenu}
                  onClick={doPaste}
                />
                <MenuButton
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete"
                  shortcut="Del"
                  destructive
                  onMouseEnter={closeSubmenu}
                  onClick={doDelete}
                />
              </MenuSection>

              {submenu && (
                <div
                  className="fixed z-[201] min-w-[200px] rounded-md border border-zinc-800 bg-zinc-900 shadow-lg"
                  style={{
                    left: submenu.anchor.x + 2,
                    top: submenu.anchor.y,
                  }}
                >
                  <div className="py-1 text-sm text-zinc-200">
                    {submenu.id === 'priority' &&
                      (['critical', 'highest', 'high', 'medium', 'low', 'lowest'] as const).map(
                        (p) => (
                          <button
                            key={p}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => doPriority(p)}
                          >
                            <PriorityBadge priority={p} size="sm" />
                          </button>
                        ),
                      )}

                    {submenu.id === 'assign' && (
                      <>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doAssign(currentUser.id)}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback
                              className="text-[10px] text-white font-medium"
                              style={{ backgroundColor: getAvatarColor(currentUser.id) }}
                            >
                              {getInitials(currentUser.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>Assign to me</span>
                        </button>
                        <div className="my-1 border-t border-zinc-800" />
                        {sortedMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => doAssign(m.id)}
                          >
                            <Avatar className="h-5 w-5">
                              {m.avatar && <AvatarImage src={m.avatar} />}
                              <AvatarFallback
                                className="text-[10px] text-white font-medium"
                                style={{ backgroundColor: getAvatarColor(m.id) }}
                              >
                                {getInitials(m.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{m.name}</span>
                          </button>
                        ))}
                        <div className="my-1 border-t border-zinc-800" />
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doAssign(null)}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                              <UserIcon className="h-3 w-3 text-zinc-500" />
                            </AvatarFallback>
                          </Avatar>
                          <span>Unassign</span>
                        </button>
                      </>
                    )}

                    {submenu.id === 'send' &&
                      columns.map((col) => {
                        const { icon: StatusIcon, color } = getStatusIcon(col.name)
                        return (
                          <button
                            key={col.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                            onClick={() => doSendTo(col.id)}
                          >
                            <StatusIcon className={`h-4 w-4 ${color}`} />
                            <span>{col.name}</span>
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open)
          if (!open) setPendingDelete([])
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">
              Delete {pendingDelete.length === 1 ? 'ticket' : `${pendingDelete.length} tickets`}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {pendingDelete.length === 1 ? (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-zinc-300">{pendingDelete[0]?.title}</span>?
                </>
              ) : (
                <>
                  Are you sure you want to delete these {pendingDelete.length} tickets? This action
                  can be undone with Ctrl+Z.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteNow}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label: string
  trailing?: React.ReactNode
  shortcut?: string
  destructive?: boolean
}

function MenuButton({
  icon,
  label,
  trailing,
  shortcut,
  destructive,
  className,
  ...rest
}: MenuButtonProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800',
        destructive && 'text-red-200 hover:bg-red-900/30',
        className,
      )}
      {...rest}
    >
      {icon && <span className="text-zinc-400">{icon}</span>}
      <span className={cn('flex-1', destructive && 'text-red-200')}>{label}</span>
      {shortcut && (
        <span className={cn('text-[10px] text-zinc-500 ml-3', destructive && 'text-red-300')}>
          {shortcut}
        </span>
      )}
      {trailing && <span className="text-zinc-500">{trailing}</span>}
    </button>
  )
}

interface MenuSectionProps {
  title: string
  children: React.ReactNode
}

function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <>
      <div className="my-1 border-t border-zinc-800" />
      <div className="px-3 py-1 text-xs uppercase text-zinc-500">{title}</div>
      {children}
    </>
  )
}
