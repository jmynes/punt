'use client'

import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useCurrentUser, useProjectMembers } from '@/hooks/use-current-user'
import { getStatusIcon } from '@/lib/status-icons'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import {
  DEFAULT_TICKET_FORM,
  type IssueType,
  type LabelSummary,
  type Priority,
  type SprintSummary,
  type TicketFormData,
  type UploadedFileInfo,
} from '@/types'
import type { ParentTicketOption } from './create-ticket-dialog'
import { DatePicker } from './date-picker'
import { DescriptionEditor } from './description-editor'
import { FileUpload } from './file-upload'
import { LabelSelect } from './label-select'
import { ParentSelect } from './parent-select'
import { PrioritySelect } from './priority-select'
import { TypeSelect } from './type-select'
import { UserSelect } from './user-select'

interface TicketFormProps {
  data: TicketFormData
  onChange: (data: TicketFormData) => void
  labels: LabelSummary[]
  sprints: SprintSummary[]
  parentTickets?: ParentTicketOption[]
  disabled?: boolean
}

export function TicketForm({
  data,
  onChange,
  labels,
  sprints,
  parentTickets = [],
  disabled,
}: TicketFormProps) {
  const currentUser = useCurrentUser()
  const { getColumns } = useBoardStore()
  const { activeProjectId } = useUIStore()
  const projectId = activeProjectId || '1'
  const members = useProjectMembers(projectId)
  const boardColumns = getColumns(projectId)

  const updateField = <K extends keyof TicketFormData>(field: K, value: TicketFormData[K]) => {
    onChange({ ...data, [field]: value })
  }

  // Auto-set type to subtask when parent is selected
  const handleParentChange = (parentId: string | null) => {
    updateField('parentId', parentId)
    // If selecting a parent and current type isn't subtask, suggest subtask
    if (parentId && data.type !== 'subtask') {
      // Optionally auto-switch to subtask type
      // updateField('type', 'subtask')
    }
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Title - Required */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-zinc-300">
          Title <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          value={data.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Enter a brief summary..."
          disabled={disabled}
          className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
        />
      </div>

      {/* Type and Priority - Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-zinc-300">Type</Label>
          <TypeSelect
            value={data.type}
            onChange={(value: IssueType) => updateField('type', value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-300">Priority</Label>
          <PrioritySelect
            value={data.priority}
            onChange={(value: Priority) => updateField('priority', value)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Parent Epic/Story */}
      {parentTickets.length > 0 && (
        <div className="space-y-2">
          <Label className="text-zinc-300">Parent Epic / Story</Label>
          <ParentSelect
            value={data.parentId}
            onChange={handleParentChange}
            parentTickets={parentTickets}
            disabled={disabled}
          />
          <p className="text-xs text-zinc-500">
            Link this ticket to an Epic or Story for better organization
          </p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-zinc-300">
          Description
        </Label>
        <DescriptionEditor
          markdown={data.description || ''}
          onChange={(value) => updateField('description', value)}
          disabled={disabled}
          placeholder="Add a more detailed description..."
        />
      </div>

      <Separator className="bg-zinc-800" />

      {/* Assignee with Assign to Me button */}
      <div className="space-y-2">
        <Label className="text-zinc-300">Assignee</Label>
        <UserSelect
          value={data.assigneeId}
          onChange={(value) => updateField('assigneeId', value)}
          users={members}
          currentUserId={currentUser?.id}
          placeholder="Unassigned"
          disabled={disabled}
          showAssignToMe
        />
      </div>

      {/* Labels */}
      <div className="space-y-2">
        <Label className="text-zinc-300">Labels</Label>
        <LabelSelect
          value={data.labelIds}
          onChange={(value) => updateField('labelIds', value)}
          labels={labels}
          disabled={disabled}
        />
      </div>

      {/* Sprint */}
      <div className="space-y-2">
        <Label className="text-zinc-300">Sprint</Label>
        <Select
          value={data.sprintId || 'none'}
          onValueChange={(v) => updateField('sprintId', v === 'none' ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
            <SelectValue placeholder="No sprint (Backlog)" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="none" className="focus:bg-zinc-800 focus:text-zinc-100">
              No sprint (Backlog)
            </SelectItem>
            {sprints.map((sprint) => (
              <SelectItem
                key={sprint.id}
                value={sprint.id}
                className="focus:bg-zinc-800 focus:text-zinc-100"
              >
                {sprint.name} {sprint.isActive && '(Active)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status (column) */}
      <div className="space-y-2">
        <Label className="text-zinc-300">Status</Label>
        <Select
          value={data.columnId || 'default'}
          onValueChange={(v) => updateField('columnId', v === 'default' ? undefined : v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
            <SelectValue placeholder="Use default" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="default" className="focus:bg-zinc-800 focus:text-zinc-100">
              Use default
            </SelectItem>
            {boardColumns.map((col) => {
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

      <Separator className="bg-zinc-800" />

      {/* Dates - Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-zinc-300">Start Date</Label>
          <DatePicker
            value={data.startDate}
            onChange={(value) => updateField('startDate', value)}
            placeholder="Set start date"
            disabled={disabled}
            context="ticket-form"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-300">Due Date</Label>
          <DatePicker
            value={data.dueDate}
            onChange={(value) => updateField('dueDate', value)}
            placeholder="Set due date"
            disabled={disabled}
            context="ticket-form"
          />
        </div>
      </div>

      {/* Estimation - Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="storyPoints" className="text-zinc-300">
            Story Points
          </Label>
          <div className="flex focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-0 rounded-md overflow-hidden">
            <Input
              id="storyPoints"
              type="number"
              min={0}
              step={1}
              value={data.storyPoints ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number.parseInt(e.target.value, 10) : null
                updateField('storyPoints', val !== null && val < 0 ? 0 : val)
              }}
              placeholder="pts"
              disabled={disabled}
              className="flex-1 h-9 bg-zinc-900 border-zinc-700 focus:border-amber-500 focus:ring-0 rounded-r-none border-r-0"
            />
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-4.5 w-6 px-0 bg-zinc-900 border border-zinc-700 border-l-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-tr disabled:opacity-50"
                onClick={() => {
                  const currentValue = data.storyPoints ?? 0
                  const newValue = currentValue + 1
                  updateField('storyPoints', newValue)
                }}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-4.5 w-6 px-0 bg-zinc-900 border border-zinc-700 border-l-0 border-t-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-br disabled:opacity-50"
                onClick={() => {
                  const currentValue = data.storyPoints ?? 0
                  const newValue = Math.max(0, currentValue - 1)
                  updateField('storyPoints', newValue)
                }}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimate" className="text-zinc-300">
            Time Estimate
          </Label>
          <Input
            id="estimate"
            value={data.estimate}
            onChange={(e) => updateField('estimate', e.target.value)}
            placeholder="e.g., 2h, 1d, 1w"
            disabled={disabled}
            className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
          />
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Additional Fields Accordion */}
      <Accordion title="Additional Fields" scrollTo="bottom">
        {/* Environment */}
        <div className="space-y-2">
          <Label htmlFor="environment" className="text-zinc-300">
            Environment
          </Label>
          <Input
            id="environment"
            value={data.environment}
            onChange={(e) => updateField('environment', e.target.value)}
            placeholder="e.g., Production, Staging, Development"
            disabled={disabled}
            className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
          />
        </div>

        {/* Version fields - Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="affectedVersion" className="text-zinc-300">
              Affected Version
            </Label>
            <Input
              id="affectedVersion"
              value={data.affectedVersion || ''}
              onChange={(e) => updateField('affectedVersion', e.target.value)}
              placeholder="e.g., 1.0.0"
              disabled={disabled}
              className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fixVersion" className="text-zinc-300">
              Fix Version
            </Label>
            <Input
              id="fixVersion"
              value={data.fixVersion || ''}
              onChange={(e) => updateField('fixVersion', e.target.value)}
              placeholder="e.g., 1.0.1"
              disabled={disabled}
              className="bg-zinc-900 border-zinc-700 focus:border-amber-500"
            />
          </div>
        </div>
      </Accordion>

      {/* Attachments */}
      <div className="space-y-2">
        <Label className="text-zinc-300 flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments
        </Label>
        <FileUpload
          value={data.attachments}
          onChange={(files) => updateField('attachments', files as UploadedFileInfo[])}
          maxFiles={10}
          disabled={disabled}
        />
        <p className="text-xs text-zinc-500">
          Upload images, videos, PDFs, or documents. Max 10 files.
        </p>
      </div>
    </div>
  )
}

export { DEFAULT_TICKET_FORM }
