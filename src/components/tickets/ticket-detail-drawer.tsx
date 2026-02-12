'use client'

import { format } from 'date-fns'
import {
  Bug,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Layers,
  Lightbulb,
  Link2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  useAddAttachments,
  useRemoveAttachment,
  useUploadConfig,
} from '@/hooks/queries/use-attachments'
import {
  useCreateLabel,
  useDeleteLabel,
  useDeleteTicket,
  useProjectLabels,
  useProjectSprints,
  useUpdateLabel,
  useUpdateTicket,
} from '@/hooks/queries/use-tickets'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { useHasPermission } from '@/hooks/use-permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { isCompletedColumn } from '@/lib/sprint-utils'
import { getStatusIcon } from '@/lib/status-icons'
import { formatTicketId } from '@/lib/ticket-format'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { useBoardStore } from '@/stores/board-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import type {
  IssueType,
  LabelSummary,
  Priority,
  TicketWithRelations,
  UploadedFileInfo,
} from '@/types'
import { ISSUE_TYPES, PRIORITIES, RESOLUTIONS } from '@/types'
import { InlineCodeText } from '../common/inline-code'
import { PriorityBadge } from '../common/priority-badge'
import { resolutionConfig } from '../common/resolution-badge'
import { TypeBadge } from '../common/type-badge'
import type { ParentTicketOption } from './create-ticket-dialog'
import { DatePicker } from './date-picker'
import { DescriptionEditor } from './description-editor'
import { FileUpload } from './file-upload'
import { LabelSelect } from './label-select'
import { MarkdownViewer } from './markdown-viewer'
import { ParentSelect } from './parent-select'
import { UserSelect } from './user-select'

// Type icons and colors (matching backlog filters)
const typeIcons: Record<IssueType, React.ComponentType<{ className?: string }>> = {
  epic: Zap,
  story: Lightbulb,
  task: CheckSquare,
  bug: Bug,
  subtask: Layers,
}

const typeColors: Record<IssueType, string> = {
  epic: 'text-purple-400',
  story: 'text-green-400',
  task: 'text-blue-400',
  bug: 'text-red-400',
  subtask: 'text-cyan-400',
}

interface TicketDetailDrawerProps {
  ticket: TicketWithRelations | null
  projectKey: string
  onClose: () => void
}

// Helper to convert MIME type to category
function getMimeTypeCategory(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

export function TicketDetailDrawer({ ticket, projectKey, onClose }: TicketDetailDrawerProps) {
  const { getColumns } = useBoardStore()
  const { activeProjectId, setActiveTicketId, drawerFocusField, clearDrawerFocusField } =
    useUIStore()

  // Get columns for the active project
  const projectId = activeProjectId || ticket?.projectId || ''
  const columns = getColumns(projectId)
  const { openCreateTicketWithData } = useUIStore()
  const currentUser = useCurrentUser()
  const members = useProjectMembers(projectId)

  // API mutations
  const updateTicketMutation = useUpdateTicket()
  const deleteTicketMutation = useDeleteTicket()
  const createLabelMutation = useCreateLabel()
  const deleteLabelMutation = useDeleteLabel()
  const updateLabelMutation = useUpdateLabel()
  const addAttachmentsMutation = useAddAttachments()
  const removeAttachmentMutation = useRemoveAttachment()

  // Get upload config for max attachments
  const { data: uploadConfig } = useUploadConfig()

  // Fetch sprints and labels from API
  const { data: projectSprints } = useProjectSprints(projectId, { enabled: !!projectId })
  const { data: projectLabels } = useProjectLabels(projectId, { enabled: !!projectId })

  // Use API data with fallback to empty arrays while loading
  const availableSprints = projectSprints ?? []
  const availableLabels = projectLabels ?? []

  // Check permission to manage labels
  const canManageLabels = useHasPermission(projectId, PERMISSIONS.LABELS_MANAGE)

  // Callback for creating new labels inline
  const handleCreateLabel = useCallback(
    async (name: string): Promise<LabelSummary | null> => {
      if (!projectId) return null

      try {
        const result = await createLabelMutation.mutateAsync({ projectId, name })
        return result
      } catch {
        return null
      }
    },
    [projectId, createLabelMutation],
  )

  // Callback for deleting labels
  const handleDeleteLabel = useCallback(
    async (labelId: string): Promise<void> => {
      if (!projectId) return

      await deleteLabelMutation.mutateAsync({ projectId, labelId })
    },
    [projectId, deleteLabelMutation],
  )

  // Callback for updating label colors
  const handleUpdateLabel = useCallback(
    async (labelId: string, color: string): Promise<void> => {
      if (!projectId) return

      await updateLabelMutation.mutateAsync({ projectId, labelId, color })
    },
    [projectId, updateLabelMutation],
  )

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showUnsavedChangesConfirm, setShowUnsavedChangesConfirm] = useState(false)
  const [_pendingClose, setPendingClose] = useState(false)
  const [rememberPreference, setRememberPreference] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const storyPointsInputRef = useRef<HTMLInputElement>(null)

  const { autoSaveOnDrawerClose, setAutoSaveOnDrawerClose } = useSettingsStore()

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
  const [tempResolution, setTempResolution] = useState<string | null>(null)
  const [tempParentId, setTempParentId] = useState<string | null>(null)
  const [tempStatusId, setTempStatusId] = useState<string | null>(null)
  const [tempCreatorId, setTempCreatorId] = useState<string | null>(null)
  const [tempAttachments, setTempAttachments] = useState<UploadedFileInfo[]>([])

  // Ensure current user is always in the members list for assignment
  const membersWithCurrentUser = useMemo(() => {
    if (!currentUser) return members
    const hasCurrentUser = members.some((m) => m.id === currentUser.id)
    if (hasCurrentUser) return members
    return [currentUser, ...members]
  }, [members, currentUser])

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

  // Find parent ticket if this ticket has a parent
  const parentTicket = useMemo(() => {
    if (!ticket?.parentId) return null
    const allTickets = columns.flatMap((col) => col.tickets)
    return allTickets.find((t) => t.id === ticket.parentId) || null
  }, [columns, ticket?.parentId])

  // Find all child tickets (tickets that have this ticket as parent)
  const childTickets = useMemo(() => {
    if (!ticket) return []
    const allTickets = columns.flatMap((col) => col.tickets)
    return allTickets.filter((t) => t.parentId === ticket.id)
  }, [columns, ticket?.id, ticket])

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
      setTempStartDate(ticket.startDate ? new Date(ticket.startDate) : null)
      setTempDueDate(ticket.dueDate ? new Date(ticket.dueDate) : null)
      setTempResolution(ticket.resolution || null)
      setTempEnvironment(ticket.environment || '')
      setTempAffectedVersion(ticket.affectedVersion || '')
      setTempFixVersion(ticket.fixVersion || '')
      setTempParentId(ticket.parentId)
      setTempStatusId(ticket.columnId)
      setTempCreatorId(ticket.creatorId)
      // Convert database attachments to UploadedFileInfo format
      setTempAttachments(
        (ticket.attachments || []).map((a) => ({
          id: a.id,
          filename: a.filename,
          originalName: a.filename, // Use filename as original name
          mimetype: a.mimeType,
          size: a.size,
          url: a.url,
          category: getMimeTypeCategory(a.mimeType),
        })),
      )
    }
  }, [ticket])

  // Focus specific field when drawer opens with focus request
  useEffect(() => {
    if (drawerFocusField === 'storyPoints') {
      // Delay to ensure drawer is fully rendered and scrollable
      const timer = setTimeout(() => {
        if (storyPointsInputRef.current) {
          storyPointsInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Additional delay after scroll for focus
          setTimeout(() => {
            storyPointsInputRef.current?.focus()
            storyPointsInputRef.current?.select()
          }, 100)
        }
        clearDrawerFocusField()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [drawerFocusField, clearDrawerFocusField])

  // Handler for updating temp state (no immediate save)
  const handleChange = (field: string, value: unknown) => {
    if (!ticket) return

    switch (field) {
      case 'status': {
        const columnId = value as string
        setTempStatusId(columnId)
        // Auto-couple: moving to done column sets resolution, moving out clears it
        const targetCol = columns.find((c) => c.id === columnId)
        if (targetCol) {
          if (isCompletedColumn(targetCol.name) && !tempResolution) {
            setTempResolution('Done')
          } else if (!isCompletedColumn(targetCol.name) && tempResolution) {
            setTempResolution(null)
          }
        }
        break
      }
      case 'type': {
        const newType = value as IssueType
        setTempType(newType)
        break
      }
      case 'priority': {
        const newPriority = value as Priority
        setTempPriority(newPriority)
        break
      }
      case 'storyPoints': {
        const newStoryPoints = value as number | null
        setTempStoryPoints(newStoryPoints)
        break
      }
      case 'sprint': {
        const newSprintId = value as string | null
        setTempSprintId(newSprintId)
        break
      }
      case 'assignee': {
        const assigneeId = value as string | null
        setTempAssigneeId(assigneeId)
        break
      }
      case 'creator': {
        const creatorId = value as string | null
        setTempCreatorId(creatorId)
        break
      }
      case 'startDate': {
        const date = value as Date | null
        setTempStartDate(date)
        break
      }
      case 'dueDate': {
        const date = value as Date | null
        setTempDueDate(date)
        break
      }
      case 'labels': {
        const labelIds = value as string[]
        setTempLabelIds(labelIds)
        break
      }
      case 'parent': {
        const parentId = value as string | null
        setTempParentId(parentId)
        break
      }
      case 'environment': {
        const env = value as string
        setTempEnvironment(env)
        break
      }
      case 'affectedVersion': {
        const version = value as string
        setTempAffectedVersion(version)
        break
      }
      case 'fixVersion': {
        const version = value as string
        setTempFixVersion(version)
        break
      }
      case 'resolution': {
        const resolution = value as string | null
        setTempResolution(resolution)
        // Auto-couple: setting a resolution moves to done column, clearing leaves in place
        if (resolution) {
          const currentCol = columns.find((c) => c.id === tempStatusId)
          if (currentCol && !isCompletedColumn(currentCol.name)) {
            const doneCol = columns.find((c) => isCompletedColumn(c.name))
            if (doneCol) {
              setTempStatusId(doneCol.id)
            }
          }
        }
        break
      }
      case 'attachments':
        // Attachments would be handled separately in a real implementation
        return
    }
  }

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!ticket) return false
    return (
      tempTitle !== ticket.title ||
      tempDescription !== (ticket.description || '') ||
      tempType !== ticket.type ||
      tempPriority !== ticket.priority ||
      tempAssigneeId !== ticket.assigneeId ||
      tempStatusId !== ticket.columnId ||
      tempStoryPoints !== ticket.storyPoints ||
      tempSprintId !== ticket.sprintId ||
      tempEstimate !== (ticket.estimate || '') ||
      tempStartDate?.getTime() !==
        (ticket.startDate
          ? (ticket.startDate instanceof Date
              ? ticket.startDate
              : new Date(ticket.startDate)
            ).getTime()
          : undefined) ||
      tempDueDate?.getTime() !==
        (ticket.dueDate
          ? (ticket.dueDate instanceof Date ? ticket.dueDate : new Date(ticket.dueDate)).getTime()
          : undefined) ||
      tempParentId !== ticket.parentId ||
      tempResolution !== (ticket.resolution || null) ||
      tempEnvironment !== (ticket.environment || '') ||
      tempAffectedVersion !== (ticket.affectedVersion || '') ||
      tempFixVersion !== (ticket.fixVersion || '') ||
      tempCreatorId !== ticket.creatorId ||
      JSON.stringify(tempLabelIds.sort()) !== JSON.stringify(ticket.labels.map((l) => l.id).sort())
    )
  }, [
    ticket,
    tempTitle,
    tempDescription,
    tempType,
    tempPriority,
    tempAssigneeId,
    tempStatusId,
    tempStoryPoints,
    tempSprintId,
    tempEstimate,
    tempStartDate,
    tempDueDate,
    tempParentId,
    tempResolution,
    tempEnvironment,
    tempAffectedVersion,
    tempFixVersion,
    tempCreatorId,
    tempLabelIds,
  ])

  // Save all pending changes
  const handleSave = useCallback(() => {
    if (!ticket || !hasUnsavedChanges) return

    const oldTicket = { ...ticket }
    const updates: Partial<TicketWithRelations> = {
      updatedAt: new Date(),
    }

    // Apply all temp values to updates
    if (tempTitle.trim() && tempTitle !== ticket.title) {
      updates.title = tempTitle.trim()
    }
    if (tempDescription !== (ticket.description || '')) {
      updates.description = tempDescription.trim() || null
    }
    if (tempType !== ticket.type) {
      updates.type = tempType
    }
    if (tempPriority !== ticket.priority) {
      updates.priority = tempPriority
    }
    if (tempAssigneeId !== ticket.assigneeId) {
      updates.assigneeId = tempAssigneeId
      updates.assignee = tempAssigneeId
        ? members.find((m) => m.id === tempAssigneeId) || null
        : null
    }
    if (tempStatusId !== ticket.columnId) {
      updates.columnId = tempStatusId || ticket.columnId
    }
    if (tempStoryPoints !== ticket.storyPoints) {
      updates.storyPoints = tempStoryPoints
    }
    if (tempSprintId !== ticket.sprintId) {
      updates.sprintId = tempSprintId
    }
    if (tempEstimate !== (ticket.estimate || '')) {
      updates.estimate = tempEstimate || null
    }
    if (
      tempStartDate?.getTime() !==
      (ticket.startDate
        ? (ticket.startDate instanceof Date
            ? ticket.startDate
            : new Date(ticket.startDate)
          ).getTime()
        : undefined)
    ) {
      updates.startDate = tempStartDate
    }
    if (
      tempDueDate?.getTime() !==
      (ticket.dueDate
        ? (ticket.dueDate instanceof Date ? ticket.dueDate : new Date(ticket.dueDate)).getTime()
        : undefined)
    ) {
      updates.dueDate = tempDueDate
    }
    if (tempParentId !== ticket.parentId) {
      updates.parentId = tempParentId
    }
    if (tempResolution !== (ticket.resolution || null)) {
      updates.resolution = tempResolution
    }
    if (tempEnvironment !== (ticket.environment || '')) {
      updates.environment = tempEnvironment || null
    }
    if (tempAffectedVersion !== (ticket.affectedVersion || '')) {
      updates.affectedVersion = tempAffectedVersion || null
    }
    if (tempFixVersion !== (ticket.fixVersion || '')) {
      updates.fixVersion = tempFixVersion || null
    }
    if (tempCreatorId !== ticket.creatorId && tempCreatorId) {
      updates.creatorId = tempCreatorId
      updates.creator = membersWithCurrentUser.find((m) => m.id === tempCreatorId) || ticket.creator
    }
    if (
      JSON.stringify(tempLabelIds.sort()) !== JSON.stringify(ticket.labels.map((l) => l.id).sort())
    ) {
      updates.labels = tempLabelIds
        .map((id: string) => availableLabels.find((l) => l.id === id))
        .filter((l): l is LabelSummary => l !== undefined)
    }

    // Use API mutation (optimistic update is handled by the mutation)
    updateTicketMutation.mutate({
      projectId,
      ticketId: ticket.id,
      updates,
      previousTicket: oldTicket,
    })
  }, [
    ticket,
    hasUnsavedChanges,
    tempTitle,
    tempDescription,
    tempType,
    tempPriority,
    tempAssigneeId,
    tempStatusId,
    tempStoryPoints,
    tempSprintId,
    tempEstimate,
    tempStartDate,
    tempDueDate,
    tempParentId,
    tempResolution,
    tempEnvironment,
    tempAffectedVersion,
    tempFixVersion,
    tempCreatorId,
    tempLabelIds,
    members,
    membersWithCurrentUser,
    projectId,
    updateTicketMutation,
    availableLabels,
  ])

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
        updates.description = tempDescription.trim() || null
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
          .map((id) => availableLabels.find((l) => l.id === id))
          .filter((l): l is LabelSummary => l !== undefined)
        break
      case 'sprint':
        updates.sprintId = tempSprintId
        updates.sprint = tempSprintId
          ? availableSprints.find((s) => s.id === tempSprintId) || null
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
      case 'resolution':
        updates.resolution = tempResolution
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

    // Use API mutation (optimistic update is handled by the mutation)
    updateTicketMutation.mutate({
      projectId,
      ticketId: ticket.id,
      updates,
      previousTicket: oldTicket,
    })

    setEditingField(null)
  }

  // Cancel editing a single field - only resets that field's temp value
  const handleCancelFieldEdit = (field: string) => {
    if (!ticket) return

    switch (field) {
      case 'title':
        setTempTitle(ticket.title)
        break
      case 'description':
        setTempDescription(ticket.description || '')
        break
      case 'estimate':
        setTempEstimate(ticket.estimate || '')
        break
    }
    setEditingField(null)
  }

  // Discard ALL pending changes - resets all temp values to original ticket values
  const handleDiscardAllChanges = () => {
    if (ticket) {
      setTempTitle(ticket.title)
      setTempDescription(ticket.description || '')
      setTempType(ticket.type)
      setTempPriority(ticket.priority)
      setTempAssigneeId(ticket.assigneeId)
      setTempCreatorId(ticket.creatorId)
      setTempLabelIds(ticket.labels.map((l) => l.id))
      setTempSprintId(ticket.sprintId)
      setTempStoryPoints(ticket.storyPoints)
      setTempEstimate(ticket.estimate || '')
      setTempStartDate(ticket.startDate ? new Date(ticket.startDate) : null)
      setTempDueDate(ticket.dueDate ? new Date(ticket.dueDate) : null)
      setTempResolution(ticket.resolution || null)
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

    setShowDeleteConfirm(false)

    // Use API mutation (optimistic delete is handled by the mutation)
    deleteTicketMutation.mutate({
      projectId,
      ticketId: ticket.id,
      columnId,
      deletedTicket,
    })

    onClose()
  }

  const handleClone = () => {
    openCreateTicketWithData({
      title: `${ticket.title} (Copy)`,
      description: ticket.description || '',
      type: ticket.type,
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
      reporterId: ticket.creatorId,
      sprintId: ticket.sprintId,
      labelIds: ticket.labels.map((l) => l.id),
      watcherIds: ticket.watchers.map((w) => w.id),
      storyPoints: ticket.storyPoints,
      estimate: ticket.estimate || '',
      startDate: ticket.startDate,
      dueDate: ticket.dueDate,
      resolution: null,
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

  return (
    <Sheet
      open={!!ticket}
      onOpenChange={(open) => {
        if (!open) {
          // Check for unsaved changes
          if (hasUnsavedChanges) {
            // If auto-save is enabled, save and close
            if (autoSaveOnDrawerClose) {
              handleSave()
              onClose()
            } else {
              // Otherwise, show confirmation dialog
              // Don't call onClose() - keep Sheet open until user confirms
              setRememberPreference(false) // Reset checkbox when dialog opens
              setShowUnsavedChangesConfirm(true)
            }
          } else {
            // No unsaved changes, close normally
            onClose()
          }
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full border-zinc-800 bg-zinc-950 p-0 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Header - pr-14 gives space for the close button */}
          <SheetHeader className="border-b border-zinc-800 px-6 pr-14 py-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <TypeBadge type={ticket.type} size="md" />
                <SheetTitle className="text-base font-mono text-zinc-400">{ticketKey}</SheetTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?ticket=${ticketKey}`
                  navigator.clipboard.writeText(url)
                  toast.success('Link copied to clipboard', {
                    description: ticketKey,
                  })
                }}
                title="Copy link to ticket"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription className="sr-only">Ticket details for {ticketKey}</SheetDescription>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
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
                          handleCancelFieldEdit('title')
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => handleSaveField('title')}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelFieldEdit('title')}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <h2
                    className="text-xl font-semibold text-zinc-100 cursor-pointer hover:bg-amber-500/15 rounded px-2 py-1 -mx-2"
                    onClick={() => startEditing('title')}
                  >
                    <InlineCodeText text={ticket.title} />
                  </h2>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 shrink-0">
                      <TypeBadge type={tempType} size="sm" />
                      <span className="ml-2 capitalize">{tempType}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700">
                    {ISSUE_TYPES.map((type) => {
                      const TypeIcon = typeIcons[type]
                      return (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={tempType === type}
                          onCheckedChange={() => {
                            const newType = type as IssueType
                            handleChange('type', newType)
                          }}
                          className="focus:bg-zinc-800 focus:text-zinc-100"
                        >
                          <TypeIcon className={`mr-2 h-4 w-4 ${typeColors[type]}`} />
                          <span className="capitalize">{type}</span>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-0 rounded-md overflow-hidden">
                  <Input
                    ref={storyPointsInputRef}
                    type="number"
                    min={0}
                    value={tempStoryPoints ?? ticket.storyPoints ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number.parseInt(e.target.value, 10) : null
                      setTempStoryPoints(val !== null && val < 0 ? 0 : val)
                    }}
                    onBlur={() => {
                      if (tempStoryPoints !== ticket.storyPoints) {
                        handleChange('storyPoints', tempStoryPoints)
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
                        const currentValue = tempStoryPoints ?? 0
                        const newValue = currentValue + 1
                        handleChange('storyPoints', newValue)
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-5 px-0 bg-zinc-900 border border-zinc-700 border-l-0 border-t-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-br"
                      onClick={() => {
                        const currentValue = tempStoryPoints ?? 0
                        const newValue = Math.max(0, currentValue - 1)
                        handleChange('storyPoints', newValue)
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer">
                      <PriorityBadge priority={tempPriority} showLabel />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {[...PRIORITIES].reverse().map((priority) => (
                      <DropdownMenuCheckboxItem
                        key={priority}
                        checked={tempPriority === priority}
                        onCheckedChange={() => {
                          handleChange('priority', priority)
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
                      {(() => {
                        const selectedSprint = tempSprintId
                          ? availableSprints.find((s) => s.id === tempSprintId)
                          : null
                        return selectedSprint ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              selectedSprint.status === 'active'
                                ? 'border-green-600 bg-green-900/30 text-green-400'
                                : 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
                            )}
                          >
                            {selectedSprint.name}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-zinc-600 bg-zinc-800/50 text-zinc-400"
                          >
                            Backlog
                          </Badge>
                        )
                      })()}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuCheckboxItem
                      checked={!tempSprintId}
                      onCheckedChange={() => {
                        handleChange('sprint', null)
                      }}
                      className="cursor-pointer"
                    >
                      No sprint (Backlog)
                    </DropdownMenuCheckboxItem>
                    {availableSprints.map((sprint) => (
                      <DropdownMenuCheckboxItem
                        key={sprint.id}
                        checked={tempSprintId === sprint.id}
                        onCheckedChange={() => {
                          handleChange('sprint', sprint.id)
                        }}
                        className="cursor-pointer"
                      >
                        {sprint.name} {sprint.status === 'active' && '(Active)'}
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
                    <Button size="sm" variant="primary" onClick={() => handleSaveField('estimate')}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelFieldEdit('estimate')}
                    >
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
                        variant="primary"
                        onClick={() => handleSaveField('description')}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelFieldEdit('description')}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full text-left rounded-md bg-zinc-900/50 px-3 py-2 cursor-pointer hover:bg-amber-500/15 min-h-[40px]"
                    onClick={() => startEditing('description')}
                  >
                    {ticket.description?.trim() ? (
                      <MarkdownViewer markdown={ticket.description} />
                    ) : (
                      <span className="text-zinc-500 italic text-sm">No description provided</span>
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
                    value={tempCreatorId}
                    onChange={(value) => handleChange('creator', value)}
                    users={membersWithCurrentUser}
                    currentUserId={currentUser?.id}
                    placeholder="Select reporter"
                    showAssignToMe
                    allowUnassigned={false}
                  />
                </div>

                {/* Assignee */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Assignee</Label>
                  <UserSelect
                    value={tempAssigneeId}
                    onChange={(value) => handleChange('assignee', value)}
                    users={membersWithCurrentUser}
                    currentUserId={currentUser?.id}
                    placeholder="Unassigned"
                    showAssignToMe
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Status</Label>
                  <Select
                    value={tempStatusId || ticket.columnId}
                    onValueChange={(value) => handleChange('status', value)}
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

                {/* Resolution */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Resolution</Label>
                  <Select
                    value={tempResolution || 'none'}
                    onValueChange={(value) =>
                      handleChange('resolution', value === 'none' ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full h-10 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                      <SelectValue placeholder="Unresolved" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="none" className="focus:bg-zinc-800 focus:text-zinc-100">
                        Unresolved
                      </SelectItem>
                      {RESOLUTIONS.map((resolution) => {
                        const config = resolutionConfig[resolution]
                        const Icon = config?.icon
                        return (
                          <SelectItem
                            key={resolution}
                            value={resolution}
                            className="focus:bg-zinc-800 focus:text-zinc-100"
                          >
                            <span className="flex items-center gap-2">
                              {Icon && (
                                <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                              )}
                              {resolution}
                            </span>
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
                    value={tempParentId}
                    onChange={(value) => handleChange('parent', value)}
                    parentTickets={parentTickets}
                  />
                </div>

                {/* Environment */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Environment</Label>
                  <Input
                    value={tempEnvironment}
                    onChange={(e) => handleChange('environment', e.target.value)}
                    placeholder="e.g., Production, Staging"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Start Date</Label>
                  <DatePicker
                    value={tempStartDate}
                    onChange={(value) => handleChange('startDate', value)}
                    placeholder="Set start date"
                    context="ticket-form"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Due Date</Label>
                  <DatePicker
                    value={tempDueDate}
                    onChange={(value) => handleChange('dueDate', value)}
                    placeholder="Set due date"
                    context="ticket-form"
                  />
                </div>

                {/* Affected Version */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Affected Version</Label>
                  <Input
                    value={tempAffectedVersion}
                    onChange={(e) => handleChange('affectedVersion', e.target.value)}
                    placeholder="e.g., 1.0.0"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>

                {/* Fix Version */}
                <div className="space-y-2">
                  <Label className="text-zinc-400">Fix Version</Label>
                  <Input
                    value={tempFixVersion}
                    onChange={(e) => handleChange('fixVersion', e.target.value)}
                    placeholder="e.g., 1.0.1"
                    className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Labels</Label>
                <LabelSelect
                  value={tempLabelIds}
                  onChange={(value) => handleChange('labels', value)}
                  labels={availableLabels}
                  onCreateLabel={canManageLabels ? handleCreateLabel : undefined}
                  onUpdateLabel={canManageLabels ? handleUpdateLabel : undefined}
                  onDeleteLabel={canManageLabels ? handleDeleteLabel : undefined}
                />
              </div>

              {/* Parent Ticket */}
              {parentTicket && (
                <div className="space-y-2">
                  <Label className="text-zinc-400">Parent</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-amber-500"
                    onClick={() => {
                      setActiveTicketId(parentTicket.id)
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {parentTicket.type === 'epic' ? (
                        <Zap className="h-4 w-4 text-purple-400 shrink-0" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-green-400 shrink-0" />
                      )}
                      <span className="font-mono text-zinc-500 shrink-0">
                        {projectKey}-{parentTicket.number}
                      </span>
                      <InlineCodeText
                        text={parentTicket.title}
                        className="truncate text-zinc-300"
                      />
                      <Link2 className="h-3.5 w-3.5 text-zinc-500 ml-auto shrink-0" />
                    </div>
                  </Button>
                </div>
              )}

              {/* Child Tickets */}
              {childTickets.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-zinc-400">Children ({childTickets.length})</Label>
                  <div className="space-y-1">
                    {childTickets.map((child) => (
                      <Button
                        key={child.id}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-amber-500"
                        onClick={() => {
                          setActiveTicketId(child.id)
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <TypeBadge type={child.type} size="sm" />
                          <span className="font-mono text-zinc-500 shrink-0">
                            {projectKey}-{child.number}
                          </span>
                          <InlineCodeText text={child.title} className="truncate text-zinc-300" />
                          <Link2 className="h-3.5 w-3.5 text-zinc-500 ml-auto shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

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
                          style={{
                            backgroundColor:
                              watcher.avatarColor || getAvatarColor(watcher.id || watcher.name),
                          }}
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
                  onChange={(files) => {
                    const newFiles = files as UploadedFileInfo[]
                    const currentIds = new Set(tempAttachments.map((a) => a.id))
                    const newIds = new Set(newFiles.map((f) => f.id))

                    // Find added files (in new but not in current)
                    const addedFiles = newFiles.filter((f) => !currentIds.has(f.id))

                    // Find removed files (in current but not in new)
                    const removedFiles = tempAttachments.filter((a) => !newIds.has(a.id))

                    // Handle persistence - add new files to database
                    if (ticket && addedFiles.length > 0) {
                      addAttachmentsMutation.mutate({
                        projectId,
                        ticketId: ticket.id,
                        attachments: addedFiles.map((f) => ({
                          filename: f.filename,
                          originalName: f.originalName,
                          mimeType: f.mimetype,
                          size: f.size,
                          url: f.url,
                        })),
                      })
                    }

                    // Remove deleted files from database
                    if (ticket) {
                      for (const removed of removedFiles) {
                        removeAttachmentMutation.mutate({
                          projectId,
                          ticketId: ticket.id,
                          attachmentId: removed.id,
                        })
                      }
                    }

                    // Update local state
                    setTempAttachments(newFiles)
                  }}
                  maxFiles={uploadConfig?.maxAttachmentsPerTicket ?? 20}
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
                    <Button size="sm" variant="primary">
                      Comment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 flex-shrink-0">
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Created {format(ticket.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
              <p>Updated {format(ticket.updatedAt, "MMM d, yyyy 'at' h:mm a")}</p>
              {ticket.resolvedAt && (
                <p className="text-green-500">
                  Resolved {format(new Date(ticket.resolvedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDiscardAllChanges}
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 hover:border-orange-800"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Discard Changes
                  </Button>
                  <Button size="sm" variant="primary" onClick={handleSave}>
                    Save Changes
                  </Button>
                </>
              )}
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

      {/* Unsaved changes confirmation dialog */}
      <AlertDialog
        open={showUnsavedChangesConfirm}
        onOpenChange={(open) => {
          if (!open) {
            // If dialog is being closed (e.g., clicking outside), just close it and keep drawer open
            setShowUnsavedChangesConfirm(false)
            setPendingClose(false)
          }
        }}
      >
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              You have unsaved changes to this ticket. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-preference"
                checked={rememberPreference}
                onCheckedChange={(checked) => {
                  // Only update local state, don't save preference until "Save and Close" is clicked
                  setRememberPreference(checked === true)
                }}
                className="border-zinc-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <Label
                htmlFor="remember-preference"
                className="text-sm text-zinc-300 cursor-pointer select-none"
              >
                Remember my preference to save and close
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => {
                setShowUnsavedChangesConfirm(false)
                setPendingClose(false)
                setRememberPreference(false)
              }}
            >
              Go Back
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setShowUnsavedChangesConfirm(false)
                setPendingClose(false)
                setRememberPreference(false)
                onClose()
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Discard
            </Button>
            <AlertDialogAction
              onClick={() => {
                // Only save preference if checkbox is checked when "Save and Close" is clicked
                if (rememberPreference) {
                  setAutoSaveOnDrawerClose(true)
                }
                handleSave()
                setShowUnsavedChangesConfirm(false)
                setPendingClose(false)
                setRememberPreference(false)
                onClose()
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Save and Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
