'use client'

import { format } from 'date-fns'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { getStatusIcon } from '@/lib/status-icons'
import { formatTicketId } from '@/lib/ticket-format'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type {
  IssueType,
  LabelSummary,
  Priority,
  SprintSummary,
  TicketWithRelations,
  UploadedFileInfo,
} from '@/types'
import { ISSUE_TYPES, PRIORITIES } from '@/types'
import { PriorityBadge } from '../common/priority-badge'
import { TypeBadge } from '../common/type-badge'
import type { ParentTicketOption } from './create-ticket-dialog'
import { DatePicker } from './date-picker'
import { DescriptionEditor } from './description-editor'
import { FileUpload } from './file-upload'
import { LabelSelect } from './label-select'
import { ParentSelect } from './parent-select'
import { UserSelect } from './user-select'

interface TicketDetailDrawerProps {
  ticket: TicketWithRelations | null
  projectKey: string
  onClose: () => void
}

// Demo labels - same as in create-ticket-dialog
const DEMO_LABELS: LabelSummary[] = [
  { id: 'label-1', name: 'frontend', color: '#ec4899' },
  { id: 'label-2', name: 'backend', color: '#06b6d4' },
  { id: 'label-3', name: 'database', color: '#8b5cf6' },
  { id: 'label-4', name: 'api', color: '#f59e0b' },
  { id: 'label-5', name: 'auth', color: '#ef4444' },
  { id: 'label-6', name: 'ui/ux', color: '#14b8a6' },
  { id: 'label-7', name: 'documentation', color: '#64748b' },
  { id: 'label-8', name: 'testing', color: '#22c55e' },
  { id: 'label-9', name: 'performance', color: '#eab308' },
  { id: 'label-10', name: 'security', color: '#dc2626' },
  { id: 'label-11', name: 'refactor', color: '#a855f7' },
  { id: 'label-12', name: 'tech-debt', color: '#78716c' },
  { id: 'label-13', name: 'needs-review', color: '#3b82f6' },
  { id: 'label-14', name: 'blocked', color: '#991b1b' },
  { id: 'label-15', name: 'help-wanted', color: '#16a34a' },
]

const DEMO_SPRINTS: SprintSummary[] = [
  {
    id: 'sprint-1',
    name: 'Sprint 1 - Foundation',
    isActive: false,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-14'),
  },
  {
    id: 'sprint-2',
    name: 'Sprint 2 - Core Features',
    isActive: true,
    startDate: new Date('2024-01-15'),
    endDate: new Date('2024-01-28'),
  },
  { id: 'sprint-3', name: 'Sprint 3 - Polish', isActive: false, startDate: null, endDate: null },
]

export function TicketDetailDrawer({ ticket, projectKey, onClose }: TicketDetailDrawerProps) {
  const { removeTicket, addTicket, updateTicket, columns } = useBoardStore()
  const { pushDeleted, removeDeleted } = useUndoStore()
  const { openCreateTicketWithData } = useUIStore()
  const currentUser = useCurrentUser()
  const members = useProjectMembers()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  // State for editing fields
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempTitle, setTempTitle] = useState('')
  const [tempDescription, setTempDescription] = useState('')
  const [tempType, setTempType] = useState<IssueType>('task')
  const [tempPriority, setTempPriority] = useState<Priority>('medium')
  const [tempAssigneeId, setTempAssigneeId] = useState<string | null>(null)
  const [tempLabelIds, setTempLabelIds] = useState<string[]>([])
  const [tempSprintId, setTempSprintId] = useState<string | null>(null)
  const [tempStoryPoints, setTempStoryPoints] = useState<number | null>(null)
  const [tempEstimate, setTempEstimate] = useState('')
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempDueDate, setTempDueDate] = useState<Date | null>(null)
  const [tempEnvironment, setTempEnvironment] = useState('')
  const [tempAffectedVersion, setTempAffectedVersion] = useState('')
  const [tempFixVersion, setTempFixVersion] = useState('')
  const [tempParentId, setTempParentId] = useState<string | null>(null)
  const [tempStatusId, setTempStatusId] = useState<string | null>(null)
  const [_tempCreatorId, setTempCreatorId] = useState<string>('')
  const [tempAttachments, setTempAttachments] = useState<UploadedFileInfo[]>([])

  // Get all tickets for parent selection (exclude current ticket)
  const parentTickets: ParentTicketOption[] = useMemo(() => {
    const allTickets = columns.flatMap((col) => col.tickets)
    return allTickets
      .filter((t) => t.id !== ticket?.id && (t.type === 'epic' || t.type === 'story'))
      .map((t) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        type: t.type as 'epic' | 'story',
        projectKey,
      }))
  }, [columns, ticket?.id, projectKey])

  // Reset editing state when ticket changes
  useEffect(() => {
    if (ticket) {
      setEditingField(null)
      setTempTitle(ticket.title)
      setTempDescription(ticket.description || '')
      setTempType(ticket.type)
      setTempPriority(ticket.priority)
      setTempAssigneeId(ticket.assigneeId)
      setTempLabelIds(ticket.labels.map((l) => l.id))
      setTempSprintId(ticket.sprintId)
      setTempStoryPoints(ticket.storyPoints)
      setTempEstimate(ticket.estimate || '')
      setTempStartDate(ticket.startDate)
      setTempDueDate(ticket.dueDate)
      setTempEnvironment(ticket.environment || '')
      setTempAffectedVersion(ticket.affectedVersion || '')
      setTempFixVersion(ticket.fixVersion || '')
      setTempParentId(ticket.parentId)
      setTempCreatorId(ticket.creatorId)
      // Attachments would need to be loaded from the ticket's attachment array
      setTempAttachments([])
    }
  }, [ticket])

  // Handler for immediate save on change (for always-visible fields)
  const handleImmediateChange = (field: string, value: unknown) => {
    if (!ticket) return

    const oldTicket = { ...ticket }
    const updates: Partial<TicketWithRelations> = {
      updatedAt: new Date(),
    }

    switch (field) {
      case 'status': {
        const columnId = value as string
        updates.columnId = columnId
        setTempStatusId(columnId)
        break
      }
      case 'type': {
        const newType = value as IssueType
        updates.type = newType
        setTempType(newType)
        break
      }
      case 'priority': {
        const newPriority = value as Priority
        updates.priority = newPriority
        setTempPriority(newPriority)
        break
      }
      case 'storyPoints': {
        const newStoryPoints = value as number | null
        updates.storyPoints = newStoryPoints
        setTempStoryPoints(newStoryPoints)
        break
      }
      case 'sprint': {
        const newSprintId = value as string | null
        updates.sprintId = newSprintId
        setTempSprintId(newSprintId)
        break
      }
      case 'assignee': {
        const assigneeId = value as string | null
        updates.assigneeId = assigneeId
        updates.assignee = assigneeId ? members.find((m) => m.id === assigneeId) || null : null
        setTempAssigneeId(assigneeId)
        break
      }
      case 'creator': {
        const creatorId = value as string
        updates.creatorId = creatorId
        updates.creator = members.find((m) => m.id === creatorId) || ticket.creator
        setTempCreatorId(creatorId)
        break
      }
      case 'startDate': {
        const date = value as Date | null
        updates.startDate = date
        setTempStartDate(date)
        break
      }
      case 'dueDate': {
        const date = value as Date | null
        updates.dueDate = date
        setTempDueDate(date)
        break
      }
      case 'labels': {
        const labelIds = value as string[]
        updates.labels = labelIds
          .map((id: string) => DEMO_LABELS.find((l) => l.id === id))
          .filter((l): l is LabelSummary => l !== undefined)
        setTempLabelIds(labelIds)
        break
      }
      case 'parent': {
        const parentId = value as string | null
        updates.parentId = parentId
        setTempParentId(parentId)
        break
      }
      case 'environment': {
        const env = value as string
        updates.environment = env || null
        setTempEnvironment(env)
        break
      }
      case 'affectedVersion': {
        const version = value as string
        updates.affectedVersion = version || null
        setTempAffectedVersion(version)
        break
      }
      case 'fixVersion': {
        const version = value as string
        updates.fixVersion = version || null
        setTempFixVersion(version)
        break
      }
      case 'attachments':
        // Attachments would be handled separately in a real implementation
        return
    }

    const updatedTicket = { ...oldTicket, ...updates }
    updateTicket(ticket.id, updates)

    // Add to undo stack
    const { pushUpdate } = useUndoStore.getState()
    const showUndo = useUIStore.getState().showUndoButtons

    const toastId = showUndoRedoToast('success', {
      title: 'Ticket updated',
      description: ticketKey,
      duration: 3000,
      showUndoButtons: showUndo,
      onUndo: (id) => {
        useUndoStore.getState().undoByToastId(id)
        updateTicket(ticket.id, oldTicket)
      },
      onRedo: (id) => {
        useUndoStore.getState().redoByToastId(id)
        updateTicket(ticket.id, updates)
      },
      undoneTitle: 'Update undone',
      redoneTitle: 'Update redone',
    })

    pushUpdate([{ ticketId: ticket.id, before: oldTicket, after: updatedTicket }], toastId)
  }

  // Focus delete button when dialog opens
  useEffect(() => {
    if (showDeleteConfirm) {
      setTimeout(() => {
        deleteButtonRef.current?.focus()
      }, 0)
    }
  }, [showDeleteConfirm])

  if (!ticket) return null

  const ticketKey = formatTicketId(ticket)
  const _isOverdue =
    ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.columnId !== 'col-5'

  const handleSaveField = (field: string) => {
    if (!ticket) return

    const oldTicket = { ...ticket }
    const updates: Partial<TicketWithRelations> = {
      updatedAt: new Date(),
    }

    switch (field) {
      case 'title':
        if (tempTitle.trim()) {
          updates.title = tempTitle.trim()
        } else {
          return // Don't save empty title
        }
        break
      case 'description':
        updates.description = tempDescription || null
        break
      case 'type':
        updates.type = tempType
        break
      case 'priority':
        updates.priority = tempPriority
        break
      case 'assignee':
        updates.assigneeId = tempAssigneeId
        updates.assignee = tempAssigneeId
          ? members.find((m) => m.id === tempAssigneeId) || null
          : null
        break
      case 'labels':
        updates.labels = tempLabelIds
          .map((id) => DEMO_LABELS.find((l) => l.id === id))
          .filter((l): l is LabelSummary => l !== undefined)
        break
      case 'sprint':
        updates.sprintId = tempSprintId
        updates.sprint = tempSprintId
          ? DEMO_SPRINTS.find((s) => s.id === tempSprintId) || null
          : null
        break
      case 'storyPoints':
        updates.storyPoints = tempStoryPoints
        break
      case 'estimate':
        updates.estimate = tempEstimate || null
        break
      case 'startDate':
        updates.startDate = tempStartDate
        break
      case 'dueDate':
        updates.dueDate = tempDueDate
        break
      case 'environment':
        updates.environment = tempEnvironment || null
        break
      case 'affectedVersion':
        updates.affectedVersion = tempAffectedVersion || null
        break
      case 'fixVersion':
        updates.fixVersion = tempFixVersion || null
        break
      case 'parent':
        updates.parentId = tempParentId
        break
      case 'attachments':
        // Attachments would be handled separately in a real implementation
        // For now, just close the editor
        setEditingField(null)
        return
      case 'status':
        updates.columnId = tempStatusId || ticket.columnId
        break
    }

    const updatedTicket = { ...oldTicket, ...updates }
    updateTicket(ticket.id, updates)

    // Add to undo stack
    const { pushUpdate } = useUndoStore.getState()
    const showUndo = useUIStore.getState().showUndoButtons

    const toastId = showUndoRedoToast('success', {
      title: 'Ticket updated',
      description: ticketKey,
      duration: 3000,
      showUndoButtons: showUndo,
      onUndo: (id) => {
        useUndoStore.getState().undoByToastId(id)
        updateTicket(ticket.id, oldTicket)
      },
      onRedo: (id) => {
        useUndoStore.getState().redoByToastId(id)
        updateTicket(ticket.id, updates)
      },
      undoneTitle: 'Update undone',
      redoneTitle: 'Update redone',
    })

    pushUpdate([{ ticketId: ticket.id, before: oldTicket, after: updatedTicket }], toastId)

    setEditingField(null)
  }

  const handleCancelEdit = () => {
    // Reset temp values to current ticket values
    if (ticket) {
      setTempTitle(ticket.title)
      setTempDescription(ticket.description || '')
      setTempType(ticket.type)
      setTempPriority(ticket.priority)
      setTempAssigneeId(ticket.assigneeId)
      setTempLabelIds(ticket.labels.map((l) => l.id))
      setTempSprintId(ticket.sprintId)
      setTempStoryPoints(ticket.storyPoints)
      setTempEstimate(ticket.estimate || '')
      setTempStartDate(ticket.startDate)
      setTempDueDate(ticket.dueDate)
      setTempEnvironment(ticket.environment || '')
      setTempAffectedVersion(ticket.affectedVersion || '')
      setTempFixVersion(ticket.fixVersion || '')
      setTempParentId(ticket.parentId)
      setTempStatusId(ticket.columnId)
    }
    setEditingField(null)
  }

  const handleDelete = () => {
    const columnId = ticket.columnId
    const deletedTicket = { ...ticket }

    removeTicket(ticket.id)
    setShowDeleteConfirm(false)

    const showUndo = useUIStore.getState().showUndoButtons
    const toastId = showUndoRedoToast('error', {
      title: 'Ticket deleted',
      description: ticketKey,
      duration: 5000,
      showUndoButtons: showUndo,
      onUndo: () => {
        addTicket(columnId, deletedTicket)
        removeDeleted(toastId)
      },
      onRedo: () => {
        removeTicket(deletedTicket.id)
      },
      undoneTitle: 'Ticket restored',
      redoneTitle: 'Delete redone',
    })

    pushDeleted(deletedTicket, columnId, toastId)
    onClose()
  }

  const handleClone = () => {
    openCreateTicketWithData({
      title: `${ticket.title} (Copy)`,
      description: ticket.description || '',
      type: ticket.type,
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
      sprintId: ticket.sprintId,
      labelIds: ticket.labels.map((l) => l.id),
      watcherIds: ticket.watchers.map((w) => w.id),
      storyPoints: ticket.storyPoints,
      estimate: ticket.estimate || '',
      startDate: ticket.startDate,
      dueDate: ticket.dueDate,
      environment: ticket.environment || '',
      affectedVersion: ticket.affectedVersion || '',
      fixVersion: ticket.fixVersion || '',
      parentId: ticket.parentId,
      attachments: [],
    })

    onClose()
  }

  const startEditing = (field: string) => {
    setEditingField(field)
  }

  const _selectedSprint = ticket.sprint ? DEMO_SPRINTS.find((s) => s.id === ticket.sprintId) : null

  return (
    <Sheet open={!!ticket} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full border-zinc-800 bg-zinc-950 p-0 sm:max-w-xl md:max-w-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header - pr-14 gives space for the close button */}
          <SheetHeader className="border-b border-zinc-800 px-6 pr-14 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <TypeBadge type={ticket.type} size="md" />
                <SheetTitle className="text-base font-mono text-zinc-400">{ticketKey}</SheetTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <SheetDescription className="sr-only">Ticket details for {ticketKey}</SheetDescription>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1 h-full">
            <div className="space-y-6 p-6">
              {/* Title */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Title</Label>
                {editingField === 'title' ? (
                  <div className="space-y-2">
                    <Input
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveField('title')
                        } else if (e.key === 'Escape') {
                          handleCancelEdit()
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveField('title')}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <h2
                    className="text-xl font-semibold text-zinc-100 cursor-pointer hover:bg-amber-500/15 rounded px-2 py-1 -mx-2"
                    onClick={() => startEditing('title')}
                  >
                    {ticket.title}
                  </h2>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Select
                  value={ticket.type}
                  onValueChange={(value) => {
                    const newType = value as IssueType
                    handleImmediateChange('type', newType)
                  }}
                >
                  <SelectTrigger className="w-24 h-8 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {ISSUE_TYPES.map((type) => (
                      <SelectItem
                        key={type}
                        value={type}
                        className="focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        <div className="flex items-center gap-2">
                          <TypeBadge type={type} size="sm" />
                          <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-0 rounded-md overflow-hidden">
                  <Input
                    type="number"
                    min={0}
                    value={tempStoryPoints ?? ticket.storyPoints ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number.parseInt(e.target.value, 10) : null
                      setTempStoryPoints(val !== null && val < 0 ? 0 : val)
                    }}
                    onBlur={() => {
                      if (tempStoryPoints !== ticket.storyPoints) {
                        handleImmediateChange('storyPoints', tempStoryPoints)
                      }
                    }}
                    placeholder="pts"
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield',
                      appearance: 'textfield',
                    }}
                    className="w-12 h-8 bg-zinc-900 border-zinc-700 text-zinc-300 focus:border-amber-500 focus:ring-0 rounded-r-none border-r-0"
                  />
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-5 px-0 bg-zinc-900 border border-zinc-700 border-l-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-tr"
                      onClick={() => {
                        const currentValue = ticket.storyPoints ?? 0
                        const newValue = currentValue + 1
                        handleImmediateChange('storyPoints', newValue)
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-5 px-0 bg-zinc-900 border border-zinc-700 border-l-0 border-t-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-br"
                      onClick={() => {
                        const currentValue = ticket.storyPoints ?? 0
                        const newValue = Math.max(0, currentValue - 1)
                        handleImmediateChange('storyPoints', newValue)
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer">
                      <PriorityBadge priority={ticket.priority} showLabel />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {PRIORITIES.map((priority) => (
                      <DropdownMenuCheckboxItem
                        key={priority}
                        checked={ticket.priority === priority}
                        onCheckedChange={() => {
                          handleImmediateChange('priority', priority)
                        }}
                        className="cursor-pointer"
                      >
                        <PriorityBadge priority={priority} showLabel />
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer">
                      {ticket.sprint ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            ticket.sprint.isActive
                              ? 'border-green-600 bg-green-900/30 text-green-400'
                              : 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
                          )}
                        >
                          {ticket.sprint.name}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-zinc-600 bg-zinc-800/50 text-zinc-400"
                        >
                          Backlog
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuCheckboxItem
                      checked={!ticket.sprint}
                      onCheckedChange={() => {
                        handleImmediateChange('sprint', null)
                      }}
                      className="cursor-pointer"
                    >
                      No sprint (Backlog)
                    </DropdownMenuCheckboxItem>
                    {DEMO_SPRINTS.map((sprint) => (
                      <DropdownMenuCheckboxItem
                        key={sprint.id}
                        checked={ticket.sprint?.id === sprint.id}
                        onCheckedChange={() => {
                          handleImmediateChange('sprint', sprint.id)
                        }}
                        className="cursor-pointer"
                      >
                        {sprint.name} {sprint.isActive && '(Active)'}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {editingField === 'estimate' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tempEstimate}
                      onChange={(e) => setTempEstimate(e.target.value)}
                      placeholder="e.g., 2h, 1d"
                      className="w-24 h-8 bg-zinc-900 border-zinc-700 focus:border-amber-500"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveField('estimate')}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </div>
                ) : ticket.estimate ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-zinc-400 cursor-pointer hover:bg-amber-500/15 rounded px-2 py-1 -mx-2"
                    onClick={() => startEditing('estimate')}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {ticket.estimate}
                  </button>
                ) : null}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Description</Label>
                {editingField === 'description' ? (
                  <div className="space-y-2">
                    <DescriptionEditor
                      markdown={tempDescription}
                      onChange={setTempDescription}
                      placeholder="Add a more detailed description..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveField('description')}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full text-left rounded-md bg-zinc-900/50 p-4 text-sm text-zinc-300 whitespace-pre-wrap cursor-pointer hover:bg-amber-500/15 min-h-[60px]"
                    onClick={() => startEditing('description')}
                  >
                    {ticket.description || (
                      <span className="text-zinc-500 italic">No description provided</span>
                    )}
                  </button>
                )}
              </div>

              <Separator className="bg-zinc-800" />

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Reporter */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Reporter</Label>
                  <UserSelect
                    value={ticket.creatorId}
                    onChange={(value) => handleImmediateChange('creator', value)}
                    users={members}
                    currentUserId={currentUser.id}
                    placeholder="Unassigned"
                  />
                </div>

                {/* Assignee */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Assignee</Label>
                  <UserSelect
                    value={ticket.assigneeId}
                    onChange={(value) => handleImmediateChange('assignee', value)}
                    users={members}
                    currentUserId={currentUser.id}
                    placeholder="Unassigned"
                    showAssignToMe
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Status</Label>
                  <Select
                    value={ticket.columnId}
                    onValueChange={(value) => handleImmediateChange('status', value)}
                  >
                    <SelectTrigger className="w-full h-10 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {columns.map((col) => {
                        const { icon: StatusIcon, color } = getStatusIcon(col.name)
                        return (
                          <SelectItem
                            key={col.id}
                            value={col.id}
                            className="focus:bg-zinc-800 focus:text-zinc-100"
                          >
                            <div className="flex items-center gap-2">
                              <StatusIcon className={`h-4 w-4 ${color}`} />
                              <span>{col.name}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parent Epic/Story */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Parent Epic / Story</Label>
                  <ParentSelect
                    value={ticket.parentId}
                    onChange={(value) => handleImmediateChange('parent', value)}
                    parentTickets={parentTickets}
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Due Date</Label>
                  <DatePicker
                    value={ticket.dueDate}
                    onChange={(value) => handleImmediateChange('dueDate', value)}
                    placeholder="Set due date"
                    context="ticket-form"
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Start Date</Label>
                  <DatePicker
                    value={ticket.startDate}
                    onChange={(value) => handleImmediateChange('startDate', value)}
                    placeholder="Set start date"
                    context="ticket-form"
                  />
                </div>

                {/* Environment */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Environment</Label>
                  <Input
                    value={ticket.environment || ''}
                    onChange={(e) => handleImmediateChange('environment', e.target.value)}
                    placeholder="e.g., Production, Staging"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>

                {/* Affected Version */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Affected Version</Label>
                  <Input
                    value={ticket.affectedVersion || ''}
                    onChange={(e) => handleImmediateChange('affectedVersion', e.target.value)}
                    placeholder="e.g., 1.0.0"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>

                {/* Fix Version */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Fix Version</Label>
                  <Input
                    value={ticket.fixVersion || ''}
                    onChange={(e) => handleImmediateChange('fixVersion', e.target.value)}
                    placeholder="e.g., 1.0.1"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Labels</Label>
                <LabelSelect
                  value={ticket.labels.map((l) => l.id)}
                  onChange={(value) => handleImmediateChange('labels', value)}
                  labels={DEMO_LABELS}
                />
              </div>

              {/* Watchers */}
              {ticket.watchers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-zinc-400">Watchers</Label>
                  <div className="flex -space-x-2">
                    {ticket.watchers.map((watcher) => (
                      <Avatar key={watcher.id} className="h-7 w-7 border-2 border-zinc-900">
                        <AvatarImage src={watcher.avatar || undefined} />
                        <AvatarFallback
                          className="text-xs text-white font-medium"
                          style={{ backgroundColor: getAvatarColor(watcher.id || watcher.name) }}
                        >
                          {getInitials(watcher.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div className="space-y-2">
                <Label className="text-zinc-400 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </Label>
                <FileUpload
                  value={tempAttachments}
                  onChange={(files) => setTempAttachments(files as UploadedFileInfo[])}
                  maxFiles={10}
                />
              </div>

              <Separator className="bg-zinc-800" />

              {/* Activity section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-400">Activity</Label>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    {ticket._count && (
                      <>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {ticket._count.comments} comments
                        </span>
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3.5 w-3.5" />
                          {ticket._count.attachments} attachments
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Comment input */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    rows={3}
                    className="resize-none bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                      Comment
                    </Button>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="pt-4 border-t border-zinc-800 text-xs text-zinc-500 space-y-1">
                <p>Created {format(ticket.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
                <p>Updated {format(ticket.updatedAt, "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
            </div>
          </ScrollArea>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <div />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClone}>
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 hover:border-red-800"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete ticket?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete{' '}
              <span className="font-mono text-zinc-300">{ticketKey}</span>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              ref={deleteButtonRef}
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
