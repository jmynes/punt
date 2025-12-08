'use client'

import { cloneElement, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Pencil,
  Send,
  Trash2,
  User as UserIcon,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { PriorityBadge } from '@/components/common/priority-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
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
  const [submenu, setSubmenu] = useState<
    | null
    | {
        id: 'priority' | 'assign'
        anchor: { x: number; y: number; height: number }
      }
  >(null)

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
    setSubmenu(null)
    children.props.onContextMenu?.(e)
  }

  const doCopy = () => {
    const copySelected = selectionApi.copySelected || (() => {})
    const getIds = selectionApi.getSelectedIds || (() => [])
    copySelected()
    const count = getIds().length
    toast.success(count === 1 ? 'Ticket copied' : `${count} tickets copied`, { duration: 1500 })
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
    setSubmenu(null)
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
    setSubmenu(null)
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
    selectedIds.forEach((id) => updateTicket(id, { priority }))
    toast.success(
      selectedIds.length === 1
        ? 'Priority updated'
        : `Priority updated for ${selectedIds.length} tickets`,
      { duration: 1500 },
    )
    setOpen(false)
    setSubmenu(null)
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
    setSubmenu(null)
  }

  const contextChild = useMemo(
    () => cloneElement(children, { onContextMenu: handleContextMenu }),
    [children],
  )

  if (typeof document === 'undefined') {
    return contextChild
  }

  const openSubmenu = (id: 'priority' | 'assign') => (e: React.MouseEvent) => {
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
              <MenuButton icon={<ClipboardCopy className="h-4 w-4" />} label="Copy" onClick={doCopy} />
              <MenuButton icon={<ClipboardPaste className="h-4 w-4" />} label="Paste" onClick={doPaste} />

              <MenuSection title="Send to">
                {columns.map((col) => (
                  <MenuButton
                    key={col.id}
                    icon={<Send className="h-4 w-4" />}
                    label={col.name}
                    onClick={() => doSendTo(col.id)}
                  />
                ))}
              </MenuSection>

              {!multi && (
                <MenuButton icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={doEdit} />
              )}
              <MenuButton icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={doDelete} />

              <MenuButton
                icon={<UserCheck className="h-4 w-4" />}
                label="Priority"
                trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                onMouseEnter={openSubmenu('priority')}
                onMouseLeave={closeSubmenu}
              />

              <MenuButton
                icon={<UserIcon className="h-4 w-4" />}
                label="Assign"
                trailing={<ChevronRight className="h-4 w-4 text-zinc-500" />}
                onMouseEnter={openSubmenu('assign')}
                onMouseLeave={closeSubmenu}
              />

              {submenu && (
                <div
                  className="fixed z-[201] min-w-[200px] rounded-md border border-zinc-800 bg-zinc-900 shadow-lg"
                  style={{
                    left: submenu.anchor.x + 8,
                    top: submenu.anchor.y,
                  }}
                  onMouseLeave={closeSubmenu}
                >
                  <div className="py-1 text-sm text-zinc-200">
                    {submenu.id === 'priority' &&
                      (['critical', 'highest', 'high', 'medium', 'low', 'lowest'] as const).map((p) => (
                        <button
                          key={p}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doPriority(p)}
                        >
                          <PriorityBadge priority={p} size="xs" />
                        </button>
                      ))}

                    {submenu.id === 'assign' && (
                      <>
                        <button
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
                        {members.map((m) => (
                          <button
                            key={m.id}
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
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800"
                          onClick={() => doAssign(null)}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] text-zinc-400">–</AvatarFallback>
                          </Avatar>
                          <span>Unassign</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label: string
  trailing?: React.ReactNode
}

function MenuButton({ icon, label, trailing, className, ...rest }: MenuButtonProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800',
        className,
      )}
      {...rest}
    >
      {icon && <span className="text-zinc-400">{icon}</span>}
      <span className="flex-1">{label}</span>
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

