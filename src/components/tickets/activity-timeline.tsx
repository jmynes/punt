'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  GitBranch,
  MessageSquare,
  Pencil,
  Plus,
  Tag,
  Undo2,
  User,
} from 'lucide-react'
import { ResolutionBadge } from '@/components/common/resolution-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type ActivityChange,
  type ActivityEntry,
  type ActivityGroupEntry,
  type ActivityValue,
  type CommentEntry,
  type TimelineEntry,
  useTicketActivity,
} from '@/hooks/queries/use-activity'
import { getColumnIcon } from '@/lib/status-icons'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import type { Resolution } from '@/types'
import { MarkdownViewer } from './markdown-viewer'

// ============================================================================
// Type definitions for parsed metadata
// ============================================================================

interface ColumnMeta {
  name: string
  icon?: string | null
  color?: string | null
}

interface UserMeta {
  id: string
  name: string
  username: string
  avatar?: string | null
  avatarColor?: string | null
}

/**
 * Try to parse a value as JSON metadata, returning the parsed object or null.
 */
function tryParseJson<T>(value: string | null): T | null {
  if (!value || value === 'null') return null
  try {
    // Only attempt JSON parse if it looks like JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      return JSON.parse(value) as T
    }
  } catch {
    // Not valid JSON, return null
  }
  return null
}

/**
 * Parse a column value that may be JSON metadata or a plain string name.
 */
function parseColumnValue(value: ActivityValue): ColumnMeta | null {
  if (!value || value === 'null') return null
  // Column values are always strings (not user objects)
  if (typeof value !== 'string') return null
  const parsed = tryParseJson<ColumnMeta>(value)
  if (parsed?.name) return parsed
  // Fallback: treat as plain column name
  return { name: value }
}

/**
 * Parse a user value that may be a user object, JSON metadata, or a plain string name.
 */
function parseUserValue(value: ActivityValue): UserMeta | null {
  if (!value || value === 'null') return null
  // If it's already a user object (from API resolution), use it directly
  if (typeof value === 'object' && 'name' in value) {
    return {
      id: value.id,
      name: value.name,
      username: value.username,
      avatar: value.avatar,
      avatarColor: value.avatarColor,
    }
  }
  // Try parsing as JSON (for backwards compatibility with old entries)
  const parsed = tryParseJson<UserMeta>(value)
  if (parsed?.name) return parsed
  // Fallback: treat as plain user name
  return { id: '', name: value, username: value }
}

interface ActivityTimelineProps {
  projectId: string
  ticketId: string
}

export function ActivityTimeline({ projectId, ticketId }: ActivityTimelineProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTicketActivity(
    projectId,
    ticketId,
  )

  const entries = data?.pages.flatMap((page) => page.entries) ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-7 w-7 rounded-full bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-48 rounded bg-zinc-800" />
              <div className="h-3 w-24 rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500 italic">No activity recorded yet.</p>
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <TimelineEntryRow key={`${entry.type}-${entry.id}`} entry={entry} />
      ))}

      {hasNextPage && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full text-zinc-400 hover:text-zinc-200"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more activity'}
          </Button>
        </div>
      )}
    </div>
  )
}

function TimelineEntryRow({ entry }: { entry: TimelineEntry }) {
  if (entry.type === 'comment') {
    return <CommentRow entry={entry} />
  }
  if (entry.type === 'activity_group') {
    return <ActivityGroupRow entry={entry} />
  }
  return <ActivityRow entry={entry} />
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const iconColor = getActionIconColor(entry.action)

  return (
    <div className="flex gap-2.5 py-1.5 group">
      <div className={cn('mt-0.5 shrink-0', iconColor)}>
        {entry.user ? (
          <ActivityAvatar user={entry.user} size="sm" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
            {getActionIcon(entry.action)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 leading-snug">
          <UserName user={entry.user} />{' '}
          <ActionDescription
            action={entry.action}
            field={entry.field}
            oldValue={entry.oldValue}
            newValue={entry.newValue}
          />
        </p>
        <Timestamp date={entry.createdAt} />
      </div>
    </div>
  )
}

/**
 * Detect whether a group of changes represents a "marked as done" or "unmarked as done" action.
 * This happens when a column move to/from a done column is auto-coupled with resolution set/cleared.
 *
 * Returns:
 * - 'marked_done' if moved to done column + resolution was set
 * - 'unmarked_done' if moved from done column + resolution was cleared
 * - null if neither pattern matches
 */
function detectDoneTransition(changes: ActivityChange[]): 'marked_done' | 'unmarked_done' | null {
  const moveChange = changes.find((c) => c.action === 'moved')
  const resolutionChange = changes.find((c) => c.action === 'resolution_changed')

  if (!moveChange || !resolutionChange) return null

  // Marked as done: resolution was set (non-null new value)
  if (resolutionChange.newValue && resolutionChange.newValue !== 'null') {
    return 'marked_done'
  }

  // Unmarked as done: resolution was cleared (null/empty new value)
  if (!resolutionChange.newValue || resolutionChange.newValue === 'null') {
    return 'unmarked_done'
  }

  return null
}

function ActivityGroupRow({ entry }: { entry: ActivityGroupEntry }) {
  const doneTransition = detectDoneTransition(entry.changes)

  // Render combined "marked as done" / "unmarked as done" entry
  if (doneTransition) {
    const isMarked = doneTransition === 'marked_done'
    const moveChange = entry.changes.find((c) => c.action === 'moved')
    const resolutionChange = entry.changes.find((c) => c.action === 'resolution_changed')
    const destinationColumn = moveChange ? parseColumnValue(moveChange.newValue) : null
    // Show the specific resolution if it's not just "Done"
    const resolutionValue =
      isMarked && resolutionChange?.newValue && typeof resolutionChange.newValue === 'string'
        ? resolutionChange.newValue
        : null
    const showResolution =
      resolutionValue && resolutionValue !== 'null' && resolutionValue !== 'Done'
    // Collect any remaining changes that are not part of the done transition
    const otherChanges = entry.changes.filter(
      (c) => c.action !== 'moved' && c.action !== 'resolution_changed',
    )

    return (
      <div className="flex gap-2.5 py-1.5 group">
        <div className={cn('mt-0.5 shrink-0', isMarked ? 'text-green-500' : 'text-zinc-400')}>
          {entry.user ? (
            <ActivityAvatar user={entry.user} size="sm" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
              {isMarked ? <CheckCircle2 className="h-3 w-3" /> : <Undo2 className="h-3 w-3" />}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 leading-snug">
            <UserName user={entry.user} />{' '}
            {isMarked ? (
              <span>
                {showResolution ? (
                  <>
                    resolved as{' '}
                    <ResolutionBadge resolution={resolutionValue as Resolution} size="sm" />
                  </>
                ) : (
                  'marked as done'
                )}
                {destinationColumn && (
                  <>
                    {' '}
                    — moved to <ColumnBadge column={destinationColumn} />
                  </>
                )}
              </span>
            ) : (
              <span>
                unmarked as done
                {destinationColumn && (
                  <>
                    {' '}
                    — moved to <ColumnBadge column={destinationColumn} />
                  </>
                )}
              </span>
            )}
          </p>
          {otherChanges.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {otherChanges.map((change, i) => (
                <div key={i} className="text-xs text-zinc-500 flex items-start gap-1">
                  <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-zinc-600" />
                  <span>
                    <ActionDescription
                      action={change.action}
                      field={change.field}
                      oldValue={change.oldValue}
                      newValue={change.newValue}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
          <Timestamp date={entry.createdAt} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 py-1.5 group">
      <div className="mt-0.5 shrink-0">
        {entry.user ? (
          <ActivityAvatar user={entry.user} size="sm" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <Pencil className="h-3 w-3 text-zinc-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 leading-snug">
          <UserName user={entry.user} /> made {entry.changes.length} changes
        </p>
        <div className="mt-1 space-y-0.5">
          {entry.changes.map((change, i) => (
            <div key={i} className="text-xs text-zinc-500 flex items-start gap-1">
              <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-zinc-600" />
              <span>
                <ActionDescription
                  action={change.action}
                  field={change.field}
                  oldValue={change.oldValue}
                  newValue={change.newValue}
                />
              </span>
            </div>
          ))}
        </div>
        <Timestamp date={entry.createdAt} />
      </div>
    </div>
  )
}

function CommentRow({ entry }: { entry: CommentEntry }) {
  return (
    <div className="flex gap-2.5 py-2 group">
      <div className="mt-0.5 shrink-0">
        {entry.user ? (
          <ActivityAvatar user={entry.user} size="sm" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
            <MessageSquare className="h-3 w-3 text-zinc-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{entry.user?.name ?? 'Unknown'}</span>
          <span className="text-xs text-zinc-500">commented</span>
          {entry.isEdited && <span className="text-xs text-zinc-600">(edited)</span>}
          {entry.isSystemGenerated && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-500/70">
              <Bot className="h-3 w-3" />
              {entry.source ?? 'system'}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-zinc-400 break-words border-l-2 border-zinc-700 pl-3">
          <MarkdownViewer markdown={entry.content} readonlyCheckboxes />
        </div>
        <Timestamp date={entry.createdAt} />
      </div>
    </div>
  )
}

// Helper components

function ActivityAvatar({
  user,
  size = 'sm',
}: {
  user: {
    name: string
    avatar: string | null
    username: string
    id?: string
    avatarColor?: string | null
  }
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const bgColor = user.avatarColor || getAvatarColor(user.id || user.username)

  return (
    <Avatar className={sizeClass}>
      {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
      <AvatarFallback
        className={cn(textSize, 'font-medium text-white')}
        style={{ backgroundColor: bgColor }}
      >
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

function UserName({ user }: { user: { name: string; username: string } | null }) {
  if (!user) return <span className="text-zinc-500">System</span>
  return <span className="font-medium text-zinc-200">{user.name}</span>
}

function Timestamp({ date }: { date: string | Date }) {
  const d = typeof date === 'string' ? new Date(date) : date
  const relative = formatDistanceToNow(d, { addSuffix: true })
  const absolute = d.toLocaleString()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs text-zinc-600 cursor-default">{relative}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {absolute}
      </TooltipContent>
    </Tooltip>
  )
}

function ActionDescription({
  action,
  field,
  oldValue,
  newValue,
}: {
  action: string
  field: string | null
  oldValue: ActivityValue
  newValue: ActivityValue
}) {
  switch (action) {
    case 'created':
      return <span>created this ticket</span>

    case 'moved': {
      const oldColumn = parseColumnValue(oldValue)
      const newColumn = parseColumnValue(newValue)
      return (
        <span>
          moved to <ColumnBadge column={newColumn} />
          {oldColumn && (
            <>
              {' '}
              from <ColumnBadge column={oldColumn} />
            </>
          )}
        </span>
      )
    }

    case 'assigned': {
      const newUser = parseUserValue(newValue)
      if (!newUser) {
        return <span>removed the assignee</span>
      }
      return (
        <span className="inline-flex items-center gap-1">
          assigned to <UserBadge user={newUser} />
        </span>
      )
    }

    case 'sprint_changed': {
      if (!newValue || newValue === 'null') {
        return <span>removed from sprint</span>
      }
      return (
        <span>
          moved to sprint <ValueBadge value={newValue} />
        </span>
      )
    }

    case 'labeled':
      return <span>changed labels</span>

    case 'resolution_changed': {
      if (!newValue || newValue === 'null') {
        return <span>cleared resolution</span>
      }
      const resolutionStr = typeof newValue === 'string' ? newValue : null
      return (
        <span>
          set resolution to{' '}
          {resolutionStr && resolutionStr !== 'null' ? (
            <ResolutionBadge resolution={resolutionStr as Resolution} size="sm" />
          ) : (
            <ValueBadge value={newValue} />
          )}
        </span>
      )
    }

    case 'priority_changed':
      return (
        <span>
          changed priority from <PriorityBadge value={oldValue} /> to{' '}
          <PriorityBadge value={newValue} />
        </span>
      )

    case 'type_changed':
      return (
        <span>
          changed type from <TypeBadge value={oldValue} /> to <TypeBadge value={newValue} />
        </span>
      )

    case 'parent_changed': {
      if (!newValue || newValue === 'null') {
        return <span>removed parent ticket</span>
      }
      return <span>set parent ticket</span>
    }

    case 'updated': {
      const fieldLabel = field ? getFieldLabel(field) : 'a field'
      if (field === 'description') {
        return <span>updated the description</span>
      }
      if (field === 'title') {
        return (
          <span>
            changed title to <ValueBadge value={newValue} />
          </span>
        )
      }
      if (oldValue && newValue) {
        return (
          <span>
            changed {fieldLabel} from <ValueBadge value={oldValue} /> to{' '}
            <ValueBadge value={newValue} />
          </span>
        )
      }
      if (newValue && !oldValue) {
        return (
          <span>
            set {fieldLabel} to <ValueBadge value={newValue} />
          </span>
        )
      }
      if (oldValue && !newValue) {
        return <span>cleared {fieldLabel}</span>
      }
      return <span>updated {fieldLabel}</span>
    }

    case 'deleted':
      return <span>deleted this ticket</span>

    default:
      return <span>{action}</span>
  }
}

function ValueBadge({ value }: { value: ActivityValue }) {
  if (!value || value === 'null') return <span className="text-zinc-500">none</span>

  // Extract string value - if it's a user object, use the name
  const displayValue = typeof value === 'object' ? value.name : value

  return (
    <span className="font-medium text-zinc-200 bg-zinc-800/50 px-1 py-0.5 rounded text-xs">
      {displayValue}
    </span>
  )
}

/**
 * Badge for displaying column/status with icon
 */
function ColumnBadge({ column }: { column: ColumnMeta | null }) {
  if (!column) return <span className="text-zinc-500">none</span>

  // Get icon and color from status-icons utility
  const { icon: Icon, color } = getColumnIcon(column.icon, column.name, column.color)
  const isHexColor = column.color?.startsWith('#')

  return (
    <span className="inline-flex items-center gap-1 font-medium text-zinc-200 bg-zinc-800/50 px-1.5 py-0.5 rounded text-xs">
      <span
        className={cn('shrink-0', !isHexColor && color)}
        style={isHexColor ? { color: column.color ?? undefined } : undefined}
      >
        <Icon className="h-3 w-3" />
      </span>
      {column.name}
    </span>
  )
}

/**
 * Badge for displaying user with mini avatar
 */
function UserBadge({ user }: { user: UserMeta | null }) {
  if (!user) return <span className="text-zinc-500">none</span>

  // Use avatarColor if available, otherwise fall back to id-based color generation
  // This matches how avatars are rendered throughout the app
  const bgColor = user.avatarColor || getAvatarColor(user.id || user.username || user.name)

  return (
    <span className="inline-flex items-center gap-1 font-medium text-zinc-200 bg-zinc-800/50 px-1.5 py-0.5 rounded text-xs">
      <Avatar className="h-3.5 w-3.5">
        {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
        <AvatarFallback
          className="text-[8px] font-medium text-white"
          style={{ backgroundColor: bgColor }}
        >
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      {user.name}
    </span>
  )
}

/**
 * Badge for displaying priority with color coding
 */
function PriorityBadge({ value }: { value: ActivityValue }) {
  if (!value || value === 'null') return <span className="text-zinc-500">none</span>

  // Priority values are always strings
  const strValue = typeof value === 'string' ? value : String(value)

  const colorMap: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
    highest: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    high: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    lowest: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  }

  const colorClass = colorMap[strValue.toLowerCase()] ?? 'text-zinc-400 bg-zinc-800/50'

  return (
    <span className={cn('font-medium px-1.5 py-0.5 rounded text-xs border', colorClass)}>
      {strValue}
    </span>
  )
}

/**
 * Badge for displaying ticket type with color coding
 */
function TypeBadge({ value }: { value: ActivityValue }) {
  if (!value || value === 'null') return <span className="text-zinc-500">none</span>

  // Type values are always strings
  const strValue = typeof value === 'string' ? value : String(value)

  const colorMap: Record<string, string> = {
    epic: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    story: 'text-green-400 bg-green-500/10 border-green-500/20',
    task: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    bug: 'text-red-400 bg-red-500/10 border-red-500/20',
    subtask: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  }

  const colorClass = colorMap[strValue.toLowerCase()] ?? 'text-zinc-400 bg-zinc-800/50'

  return (
    <span className={cn('font-medium px-1.5 py-0.5 rounded text-xs border', colorClass)}>
      {strValue}
    </span>
  )
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'title',
    description: 'description',
    type: 'type',
    priority: 'priority',
    status: 'status',
    columnId: 'status',
    assignee: 'assignee',
    assigneeId: 'assignee',
    creatorId: 'reporter',
    sprint: 'sprint',
    sprintId: 'sprint',
    parentId: 'parent',
    storyPoints: 'story points',
    estimate: 'estimate',
    resolution: 'resolution',
    resolvedAt: 'resolved date',
    startDate: 'start date',
    dueDate: 'due date',
    environment: 'environment',
    affectedVersion: 'affected version',
    fixVersion: 'fix version',
    labels: 'labels',
  }
  return labels[field] ?? field
}

function getActionIcon(action: string) {
  switch (action) {
    case 'created':
      return <Plus className="h-3 w-3" />
    case 'moved':
      return <ArrowRight className="h-3 w-3" />
    case 'assigned':
      return <User className="h-3 w-3" />
    case 'sprint_changed':
      return <GitBranch className="h-3 w-3" />
    case 'labeled':
      return <Tag className="h-3 w-3" />
    case 'resolution_changed':
      return <CircleDot className="h-3 w-3" />
    default:
      return <Pencil className="h-3 w-3" />
  }
}

function getActionIconColor(action: string): string {
  switch (action) {
    case 'created':
      return 'text-green-500'
    case 'moved':
      return 'text-blue-400'
    case 'assigned':
      return 'text-amber-400'
    case 'resolution_changed':
      return 'text-purple-400'
    default:
      return 'text-zinc-400'
  }
}
