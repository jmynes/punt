'use client'

import { useMemo } from 'react'
import {
  ArrowUp,
  Bug,
  Calendar,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  Flame,
  Hash,
  Layers,
  Lightbulb,
  Search,
  User,
  X,
  Zap,
  Flag,
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
import { getStatusIcon } from '@/lib/status-icons'
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
  low: ChevronsDown,
  medium: ArrowUp,
  high: ArrowUp,
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

const PRIORITY_ORDER_DESC: Priority[] = ['critical', 'highest', 'high', 'medium', 'low', 'lowest']

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
    filterByStatus,
    setFilterByStatus,
    filterByAssignee,
    setFilterByAssignee,
    filterByLabels,
    setFilterByLabels,
    filterBySprint,
    setFilterBySprint,
    filterByPoints,
    setFilterByPoints,
    filterByDueDate,
    setFilterByDueDate,
    clearFilters,
    columns,
  } = useBacklogStore()

  const visibleColumns = columns.filter((c) => c.visible)
  const labelsVisible = visibleColumns.some((c) => c.id === 'labels')
  const pointsVisible = visibleColumns.some((c) => c.id === 'storyPoints')
  const dueVisible = visibleColumns.some((c) => c.id === 'dueDate')
  const statusVisible = visibleColumns.some((c) => c.id === 'status')

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

  const sprintOptions = useMemo(() => {
    const set = new Map<string, { id: string; name: string }>()
    for (const col of _statusColumns) {
      for (const t of col.tickets) {
        if (t.sprint) {
          set.set(t.sprint.id, { id: t.sprint.id, name: t.sprint.name })
        }
      }
    }
    return Array.from(set.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [_statusColumns])

  const pointsOptions = useMemo(() => {
    const set = new Set<number>()
    for (const col of _statusColumns) {
      for (const t of col.tickets) {
        if (typeof t.storyPoints === 'number') {
          set.add(t.storyPoints)
        }
      }
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [_statusColumns])

  const dueDateOptions = useMemo(() => {
    const set = new Set<string>()
    for (const col of _statusColumns) {
      for (const t of col.tickets) {
        if (t.dueDate) {
          set.add(t.dueDate.toISOString().slice(0, 10))
        }
      }
    }
    return Array.from(set).sort()
  }, [_statusColumns])

  const hasActiveFilters =
    filterByType.length > 0 ||
    filterByPriority.length > 0 ||
    filterByStatus.length > 0 ||
    filterByAssignee.length > 0 ||
    filterByLabels.length > 0 ||
    filterByPoints.length > 0 ||
    filterByDueDate.length > 0 ||
    (typeof filterBySprint === 'string' && filterBySprint.length > 0) ||
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

  const toggleStatus = (statusId: string) => {
    if (filterByStatus.includes(statusId)) {
      setFilterByStatus(filterByStatus.filter((s) => s !== statusId))
    } else {
      setFilterByStatus([...filterByStatus, statusId])
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

  const togglePoints = (points: number) => {
    if (filterByPoints.includes(points)) {
      setFilterByPoints(filterByPoints.filter((p) => p !== points))
    } else {
      setFilterByPoints([...filterByPoints, points])
    }
  }

  const toggleDueDate = (date: string) => {
    if (filterByDueDate.includes(date)) {
      setFilterByDueDate(filterByDueDate.filter((d) => d !== date))
    } else {
      setFilterByDueDate([...filterByDueDate, date])
    }
  }

  const selectSprint = (sprintId: string | null) => {
    setFilterBySprint(sprintId)
  }

  const filterButtons = visibleColumns
    .map((col) => {
      switch (col.id) {
        case 'type':
          return (
            <DropdownMenu key="type">
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
          )
        case 'status':
          if (!statusVisible) return null
          return (
            <DropdownMenu key="status">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Zap className="mr-2 h-4 w-4 text-cyan-400" />
                  Status
                  {filterByStatus.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {filterByStatus.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {_statusColumns.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={filterByStatus.includes(c.id)}
                    onCheckedChange={() => toggleStatus(c.id)}
                  >
                    {(() => {
                      const { icon: StatusIcon, color } = getStatusIcon(c.name)
                      return <StatusIcon className={`mr-2 h-4 w-4 ${color}`} />
                    })()}
                    {c.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        case 'priority':
          return (
            <DropdownMenu key="priority">
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
                {PRIORITY_ORDER_DESC.map((priority) => {
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
          )
        case 'labels':
          if (!labelsVisible) return null
          return (
            <DropdownMenu key="labels">
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
          )
        case 'storyPoints':
          if (!pointsVisible) return null
          return (
            <DropdownMenu key="points">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Hash className="mr-2 h-4 w-4 text-green-400" />
                  Points
                  {filterByPoints.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {filterByPoints.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by points</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pointsOptions.map((pts) => (
                  <DropdownMenuCheckboxItem
                    key={pts}
                    checked={filterByPoints.includes(pts)}
                    onCheckedChange={() => togglePoints(pts)}
                  >
                    {pts} pts
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        case 'dueDate':
          if (!dueVisible) return null
          return (
            <DropdownMenu key="dueDate">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Calendar className="mr-2 h-4 w-4 text-pink-400" />
                  Due Date
                  {filterByDueDate.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {filterByDueDate.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by due date</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filterByDueDate.includes('none')}
                  onCheckedChange={() => toggleDueDate('none')}
                >
                  No due date
                </DropdownMenuCheckboxItem>
                {dueDateOptions.map((d) => (
                  <DropdownMenuCheckboxItem
                    key={d}
                    checked={filterByDueDate.includes(d)}
                    onCheckedChange={() => toggleDueDate(d)}
                  >
                    {d}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        case 'sprint':
          return (
            <DropdownMenu key="sprint">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Flag className="mr-2 h-4 w-4 text-amber-400" />
                  Sprint
                  {filterBySprint && (
                    <Badge variant="secondary" className="ml-2">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by sprint</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filterBySprint === 'backlog'}
                  onCheckedChange={() => selectSprint(filterBySprint === 'backlog' ? null : 'backlog')}
                >
                  Backlog (no sprint)
                </DropdownMenuCheckboxItem>
                {sprintOptions.map((sprint) => (
                  <DropdownMenuCheckboxItem
                    key={sprint.id}
                    checked={filterBySprint === sprint.id}
                    onCheckedChange={() => selectSprint(filterBySprint === sprint.id ? null : sprint.id)}
                  >
                    {sprint.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        case 'assignee':
          return (
            <DropdownMenu key="assignee">
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
          )
        default:
          return null
      }
    })
    .filter((btn): btn is JSX.Element => Boolean(btn))

  return (
    <div className="flex flex-1 items-center gap-3">
      {filterButtons}

      {/* Search (aligned with filters) */}
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

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
