'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  Bot,
  CircleDot,
  GitBranch,
  MessageSquare,
  Pencil,
  Plus,
  Tag,
  User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type ActivityEntry,
  type ActivityGroupEntry,
  type CommentEntry,
  type TimelineEntry,
  useTicketActivity,
} from '@/hooks/queries/use-activity'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { MarkdownViewer } from './markdown-viewer'

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

function ActivityGroupRow({ entry }: { entry: ActivityGroupEntry }) {
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
          <MarkdownViewer markdown={entry.content} />
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
  user: { name: string; avatar: string | null; username: string; avatarColor?: string | null }
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <Avatar className={sizeClass}>
      {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
      <AvatarFallback
        className={cn(textSize, 'font-medium text-white', getAvatarColor(user.username))}
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
  oldValue: string | null
  newValue: string | null
}) {
  switch (action) {
    case 'created':
      return <span>created this ticket</span>

    case 'moved':
      return (
        <span>
          moved to <ValueBadge value={newValue} />
          {oldValue && (
            <>
              {' '}
              from <ValueBadge value={oldValue} />
            </>
          )}
        </span>
      )

    case 'assigned': {
      if (!newValue || newValue === 'null') {
        return <span>removed the assignee</span>
      }
      return (
        <span>
          assigned to <ValueBadge value={newValue} />
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
      return (
        <span>
          set resolution to <ValueBadge value={newValue} />
        </span>
      )
    }

    case 'priority_changed':
      return (
        <span>
          changed priority from <ValueBadge value={oldValue} /> to <ValueBadge value={newValue} />
        </span>
      )

    case 'type_changed':
      return (
        <span>
          changed type from <ValueBadge value={oldValue} /> to <ValueBadge value={newValue} />
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

function ValueBadge({ value }: { value: string | null }) {
  if (!value || value === 'null') return <span className="text-zinc-500">none</span>

  return (
    <span className="font-medium text-zinc-200 bg-zinc-800/50 px-1 py-0.5 rounded text-xs">
      {value}
    </span>
  )
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'title',
    description: 'description',
    type: 'type',
    priority: 'priority',
    columnId: 'status',
    assigneeId: 'assignee',
    creatorId: 'reporter',
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
