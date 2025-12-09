'use client'

import { useMemo } from 'react'
import {
  ArrowUp,
  Bug,
  CheckSquare,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Flame,
  Layers,
  Lightbulb,
  Search,
  User,
  X,
  Zap,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { getAvatarColor, getInitials } from '@/lib/utils'
import { useBacklogStore } from '@/stores/backlog-store'
import type { ColumnWithTickets, IssueType, Priority, UserSummary } from '@/types'
import { ISSUE_TYPES, PRIORITIES } from '@/types'

// Type icons
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

// Priority icons
const priorityIcons: Record<Priority, React.ComponentType<{ className?: string }>> = {
  lowest: ChevronsDown,
  low: ChevronDown,
  medium: ArrowUp,
  high: ChevronUp,
  highest: ChevronsUp,
  critical: Flame,
}

const priorityColors: Record<Priority, string> = {
  lowest: 'text-zinc-400',
  low: 'text-zinc-400',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  highest: 'text-orange-400',
  critical: 'text-red-400',
}

// Demo users for assignee filter - in real app this would come from API/store
const DEMO_USERS: UserSummary[] = [
  { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
  { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
  { id: 'user-3', name: 'Bob Johnson', email: 'bob@punt.local', avatar: null },
]

interface BacklogFiltersProps {
  statusColumns: ColumnWithTickets[]
}

export function BacklogFilters({ statusColumns: _statusColumns }: BacklogFiltersProps) {
  const {
    searchQuery,
    setSearchQuery,
    filterByType,
    setFilterByType,
    filterByPriority,
    setFilterByPriority,
    filterByAssignee,
    setFilterByAssignee,
    filterByLabels,
    setFilterByLabels,
    clearFilters,
    columns,
  } = useBacklogStore()

  const visibleColumns = columns.filter((c) => c.visible)
  const labelsVisible = visibleColumns.some((c) => c.id === 'labels')

  const labelOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>()
    for (const col of _statusColumns) {
      for (const t of col.tickets) {
        for (const lbl of t.labels) {
          map.set(lbl.id, { id: lbl.id, name: lbl.name, color: lbl.color ?? null })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [_statusColumns])

  const hasActiveFilters =
    filterByType.length > 0 ||
    filterByPriority.length > 0 ||
    filterByAssignee.length > 0 ||
    filterByLabels.length > 0 ||
    searchQuery.length > 0

  const toggleType = (type: string) => {
    if (filterByType.includes(type)) {
      setFilterByType(filterByType.filter((t) => t !== type))
    } else {
      setFilterByType([...filterByType, type])
    }
  }

  const togglePriority = (priority: string) => {
    if (filterByPriority.includes(priority)) {
      setFilterByPriority(filterByPriority.filter((p) => p !== priority))
    } else {
      setFilterByPriority([...filterByPriority, priority])
    }
  }

  const toggleAssignee = (assigneeId: string) => {
    if (filterByAssignee.includes(assigneeId)) {
      setFilterByAssignee(filterByAssignee.filter((a) => a !== assigneeId))
    } else {
      setFilterByAssignee([...filterByAssignee, assigneeId])
    }
  }

  const toggleLabel = (labelId: string) => {
    if (filterByLabels.includes(labelId)) {
      setFilterByLabels(filterByLabels.filter((l) => l !== labelId))
    } else {
      setFilterByLabels([...filterByLabels, labelId])
    }
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      {/* Search */}
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0">
            <CheckSquare className="mr-2 h-4 w-4 text-blue-400" />
            Type
            {filterByType.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filterByType.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ISSUE_TYPES.map((type) => {
            const TypeIcon = typeIcons[type]
            return (
              <DropdownMenuCheckboxItem
                key={type}
                checked={filterByType.includes(type)}
                onCheckedChange={() => toggleType(type)}
              >
                <TypeIcon className={`mr-2 h-4 w-4 ${typeColors[type]}`} />
                <span className="capitalize">{type}</span>
              </DropdownMenuCheckboxItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0">
            <ArrowUp className="mr-2 h-4 w-4 text-blue-400" />
            Priority
            {filterByPriority.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filterByPriority.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITIES.map((priority) => {
            const PriorityIcon = priorityIcons[priority]
            return (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={filterByPriority.includes(priority)}
                onCheckedChange={() => togglePriority(priority)}
              >
                <PriorityIcon className={`mr-2 h-4 w-4 ${priorityColors[priority]}`} />
                <span className="capitalize">{priority}</span>
              </DropdownMenuCheckboxItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Labels filter (visible when labels column is on) */}
      {labelsVisible && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              <Layers className="mr-2 h-4 w-4 text-purple-400" />
              Labels
              {filterByLabels.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filterByLabels.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter by labels</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {labelOptions.length === 0 && (
              <DropdownMenuLabel className="text-xs text-zinc-500">No labels found</DropdownMenuLabel>
            )}
            {labelOptions.map((label) => (
              <DropdownMenuCheckboxItem
                key={label.id}
                checked={filterByLabels.includes(label.id)}
                onCheckedChange={() => toggleLabel(label.id)}
              >
                <Badge
                  variant="outline"
                  className="mr-2 text-[10px] px-1.5 py-0 border-zinc-700"
                  style={
                    label.color
                      ? { borderColor: label.color, color: label.color, backgroundColor: `${label.color}20` }
                      : undefined
                  }
                >
                  {label.name}
                </Badge>
                <span className="capitalize">{label.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Assignee filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0">
            <User className="mr-2 h-4 w-4 text-zinc-400" />
            Assignee
            {filterByAssignee.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filterByAssignee.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Filter by assignee</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filterByAssignee.includes('unassigned')}
            onCheckedChange={() => toggleAssignee('unassigned')}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px] text-zinc-400 border border-dashed border-zinc-700 bg-transparent">
                  <User className="h-3 w-3 text-zinc-500" />
                </AvatarFallback>
              </Avatar>
              <span className="text-zinc-400">Unassigned</span>
            </div>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {DEMO_USERS.map((user) => (
            <DropdownMenuCheckboxItem
              key={user.id}
              checked={filterByAssignee.includes(user.id)}
              onCheckedChange={() => toggleAssignee(user.id)}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback 
                    className="text-[10px] text-white font-medium"
                    style={{ backgroundColor: getAvatarColor(user.id || user.name) }}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span>{user.name}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="shrink-0 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
