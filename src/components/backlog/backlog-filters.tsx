'use client'

import { useMemo } from 'react'
import type * as React from 'react'
import {
  ArrowUp,
  Bug,
  Calendar,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  Flame,
  Hash,
  Layers,
  Lightbulb,
  Search,
  User,
  X,
  Zap,
  Flag,
  RotateCcw,
  Check,
  Clock,
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
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { cn, getAvatarColor, getInitials } from '@/lib/utils'
import { getStatusIcon } from '@/lib/status-icons'
import { useBacklogStore } from '@/stores/backlog-store'
import type { ColumnWithTickets, IssueType, Priority, UserSummary } from '@/types'
import { ISSUE_TYPES, PRIORITIES } from '@/types'
import type { DateRange } from 'react-day-picker'

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

  // Calculate the earliest year from all tickets' due dates
  const calendarStartYear = useMemo(() => {
    let earliestYear = Infinity // Start with infinity to find minimum
    let hasDueDates = false

    // Check all tickets across all columns (including done tickets)
    _statusColumns.forEach(column => {
      column.tickets.forEach(ticket => {
        if (ticket.dueDate) {
          hasDueDates = true
          const ticketYear = ticket.dueDate.getFullYear()
          if (ticketYear < earliestYear) {
            earliestYear = ticketYear
          }
        }
      })
    })

    // If we have due dates, use the earliest year found, otherwise use fallback
    return hasDueDates ? earliestYear : 2020
  }, [_statusColumns])

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
    filterByPoints !== null ||
    (filterByDueDate.from || filterByDueDate.to || filterByDueDate.includeNone || filterByDueDate.includeOverdue) ||
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
                  {filterByPoints && (
                    <Badge variant="secondary" className="ml-2">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="text-base p-0">Filter by points</DropdownMenuLabel>
                  {filterByPoints && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setFilterByPoints(null)
                      }}
                      title="Clear filter"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="p-3 space-y-3">
                  {/* Quick filters */}
                  <div className="space-y-2">
                    <div className="text-sm text-zinc-400 uppercase font-medium">Quick Filters</div>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { operator: '<=' as const, value: 1, label: 'Small (≤ 1 pt)' },
                        { operator: '=' as const, value: 2, label: 'Medium (2 pts)' },
                        { operator: '>' as const, value: 2, label: 'Large (> 2 pts)' },
                        { operator: '>=' as const, value: 5, label: 'Epic (≥ 5 pts)' },
                      ].map(({ operator, value, label }) => {
                        const isSelected = filterByPoints?.operator === operator && filterByPoints?.value === value
                        return (
                          <Button
                            key={`${operator}${value}`}
                            variant={isSelected ? "default" : "ghost"}
                            size="sm"
                            className={cn(
                              "justify-start text-left h-9 px-3",
                              isSelected
                                ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-700"
                                : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                            )}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setFilterByPoints({ operator, value })
                            }}
                          >
                            <span className="text-sm">
                              {label.split(/([≤≥])/).map((part, index) =>
                                /[≤≥]/.test(part) ? (
                                  <span key={index} className="font-semibold text-base leading-none">
                                    {part}
                                  </span>
                                ) : (
                                  part
                                )
                              )}
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Custom filter */}
                  <div className="space-y-2">
                    <div className="text-sm text-zinc-400 uppercase font-medium">Custom Filter</div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          className="flex-1 h-9 px-3 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          value={filterByPoints?.operator || ""}
                          onChange={(e) => {
                            const operator = e.target.value as '<' | '>' | '=' | '<=' | '>=' | ""
                            if (operator) {
                              // If we have a value, set the filter
                              if (filterByPoints?.value !== undefined) {
                                setFilterByPoints({ operator, value: filterByPoints.value })
                              } else {
                                // Set filter with default value of 1 if no value entered yet
                                setFilterByPoints({ operator, value: 1 })
                              }
                            } else {
                              setFilterByPoints(null)
                            }
                          }}
                        >
                          <option value="">Select operator...</option>
                          <option value="<">Less than (&lt;)</option>
                          <option value=">">Greater than (&gt;)</option>
                          <option value="=">Equal to (=)</option>
                          <option value="<=">Less or equal (≤)</option>
                          <option value=">=">Greater or equal (≥)</option>
                        </select>
                        <div className="flex focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-0 rounded-md overflow-hidden">
                          <Input
                            type="number"
                            placeholder="Value..."
                            min="0"
                            value={filterByPoints?.value ?? ""}
                            style={{
                              WebkitAppearance: 'none',
                              MozAppearance: 'textfield',
                              appearance: 'textfield'
                            }}
                            className="w-14 h-9 text-sm bg-zinc-800 border-zinc-700 text-zinc-300 focus:border-amber-500 focus:ring-0 rounded-r-none border-r-0"
                            onChange={(e) => {
                              const value = parseInt(e.target.value)
                              if (!isNaN(value) && value >= 0) {
                                const selectElement = e.currentTarget.parentElement?.previousElementSibling as HTMLSelectElement
                                const operator = selectElement.value as '<' | '>' | '=' | '<=' | '>='
                                if (operator) {
                                  setFilterByPoints({ operator, value })
                                } else {
                                  // Set filter with equals operator if no operator selected yet
                                  setFilterByPoints({ operator: '=', value })
                                }
                              } else if (e.target.value === "") {
                                const selectElement = e.currentTarget.parentElement?.previousElementSibling as HTMLSelectElement
                                const operator = selectElement.value as '<' | '>' | '=' | '<=' | '>='
                                if (operator) {
                                  setFilterByPoints(null)
                                }
                              }
                            }}
                          />
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4.5 w-6 px-0 bg-zinc-800 border border-zinc-700 border-l-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-tr"
                              onClick={() => {
                                const currentValue = filterByPoints?.value ?? 0
                                const newValue = currentValue + 1
                                const selectElement = document.querySelector('select') as HTMLSelectElement
                                const operator = selectElement?.value as '<' | '>' | '=' | '<=' | '>=' || '='
                                setFilterByPoints({ operator: operator || '=', value: newValue })
                              }}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4.5 w-6 px-0 bg-zinc-800 border border-zinc-700 border-l-0 border-t-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-none rounded-br"
                              onClick={() => {
                                const currentValue = filterByPoints?.value ?? 0
                                const newValue = Math.max(0, currentValue - 1)
                                const selectElement = document.querySelector('select') as HTMLSelectElement
                                const operator = selectElement?.value as '<' | '>' | '=' | '<=' | '>=' || '='
                                setFilterByPoints({ operator: operator || '=', value: newValue })
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        case 'dueDate':
          if (!dueVisible) return null

          const hasActiveFilter = (filterByDueDate.from || filterByDueDate.to || filterByDueDate.includeNone || filterByDueDate.includeOverdue)
          const getBadgeText = () => {
            if (filterByDueDate.from && filterByDueDate.to) return 'Range'
            if (filterByDueDate.from || filterByDueDate.to) return '1'
            if (filterByDueDate.includeOverdue) return 'Overdue'
            if (filterByDueDate.includeNone) return 'No Date'
            return ''
          }

          return (
            <Popover key="dueDate">
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <Calendar className="mr-2 h-4 w-4 text-pink-400" />
                  Due Date
                  {hasActiveFilter && (
                    <Badge variant="secondary" className="ml-2">
                      {getBadgeText()}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: filterByDueDate.from,
                    to: filterByDueDate.to
                  }}
                  onSelect={(range) => {
                    setFilterByDueDate({
                      from: range?.from,
                      to: range?.to,
                      includeNone: filterByDueDate.includeNone,
                      includeOverdue: filterByDueDate.includeOverdue
                    })
                  }}
                  disabled={filterByDueDate.includeNone}
                  defaultMonth={new Date()}
                  initialFocus
                  numberOfMonths={2}
                  captionLayout="dropdown"
                  fromYear={calendarStartYear}
                  toYear={new Date().getFullYear() + 1}
                  className={`rounded-md border-zinc-800 bg-zinc-950 text-zinc-300 ${
                    filterByDueDate.includeNone ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  classNames={{
                    button_previous: 'text-zinc-400 hover:text-zinc-200',
                    button_next: 'text-zinc-400 hover:text-zinc-200'
                  }}
                />
                <div className="p-3 border-t border-zinc-800 bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant={!filterByDueDate.includeOverdue && !filterByDueDate.includeNone ? "default" : "outline"}
                        size="sm"
                        className={`h-8 px-3 text-xs ${
                          !filterByDueDate.includeOverdue && !filterByDueDate.includeNone
                            ? "bg-amber-600 text-white border-amber-600"
                            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                        onClick={() => {
                          setFilterByDueDate({
                            ...filterByDueDate,
                            includeOverdue: false,
                            includeNone: false
                          })
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        All dates
                      </Button>
                      <Button
                        variant={filterByDueDate.includeOverdue ? "default" : "outline"}
                        size="sm"
                        className={`h-8 px-3 text-xs ${
                          filterByDueDate.includeOverdue
                            ? "bg-amber-600 text-white border-amber-600"
                            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                        onClick={() => {
                          setFilterByDueDate({
                            ...filterByDueDate,
                            includeOverdue: true,
                            includeNone: false
                          })
                        }}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Overdue
                      </Button>
                      <Button
                        variant={filterByDueDate.includeNone ? "default" : "outline"}
                        size="sm"
                        className={`h-8 px-3 text-xs ${
                          filterByDueDate.includeNone
                            ? "bg-amber-600 text-white border-amber-600"
                            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                        onClick={() => {
                          setFilterByDueDate({
                            ...filterByDueDate,
                            includeOverdue: false,
                            includeNone: true
                          })
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        No due date
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
                      onClick={() => {
                        setFilterByDueDate({
                          from: undefined,
                          to: undefined,
                          includeNone: false,
                          includeOverdue: false
                        })
                      }}
                      title="Clear date filter"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
    .filter((btn): btn is React.ReactElement => Boolean(btn))

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
