'use client'

import { Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TypeBadge } from '@/components/common/type-badge'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useTicketSearch } from '@/hooks/queries/use-tickets'
import { getColumnIcon } from '@/lib/status-icons'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/stores/projects-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'

type ColumnInfo = { name: string; icon?: string | null; color?: string | null }

function ColumnBadge({ column }: { column: ColumnInfo }) {
  const { icon: Icon, color } = getColumnIcon(column.icon, column.name, column.color)
  const isHex = color?.startsWith('#')
  return (
    <span className="flex items-center gap-1.5 ml-auto shrink-0">
      <Icon className={cn('h-3 w-3', !isHex && color)} style={isHex ? { color } : undefined} />
      <span className={cn('text-xs', !isHex && color)} style={isHex ? { color } : undefined}>
        {column.name}
      </span>
    </span>
  )
}

interface TicketSearchProps {
  projectId: string
  projectKey: string
}

/**
 * Command palette for searching tickets within a project.
 * Accessible via Cmd/Ctrl+K keyboard shortcut or by clicking the search input in the header.
 */
export function TicketSearch({ projectId, projectKey }: TicketSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setActiveTicketId } = useUIStore()

  // Debounce the search query
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const { data: results, isLoading } = useTicketSearch(projectId, debouncedQuery)

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset query when closing
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  const handleSelect = useCallback(
    (ticket: TicketWithRelations) => {
      setOpen(false)
      setActiveTicketId(ticket.id)
    },
    [setActiveTicketId],
  )

  const getColumn = useCallback((ticket: TicketWithRelations) => {
    return (ticket as TicketWithRelations & { column?: ColumnInfo }).column ?? null
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search Tickets"
      description={`Search tickets in ${projectKey}`}
      showCloseButton={false}
    >
      <CommandInput
        placeholder={`Search tickets in ${projectKey}...`}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {debouncedQuery.trim().length === 0 ? (
          <CommandEmpty>Type to search tickets by title, description, or key...</CommandEmpty>
        ) : isLoading && !results ? (
          <CommandEmpty>Searching...</CommandEmpty>
        ) : results && results.length === 0 ? (
          <CommandEmpty>No tickets found for "{debouncedQuery}"</CommandEmpty>
        ) : results && results.length > 0 ? (
          <CommandGroup heading="Tickets">
            {results.map((ticket) => {
              const column = getColumn(ticket)
              return (
                <CommandItem
                  key={ticket.id}
                  value={`${projectKey}-${ticket.number} ${ticket.title}`}
                  onSelect={() => handleSelect(ticket)}
                  className="flex items-center gap-3 py-2.5 cursor-pointer"
                >
                  <TypeBadge type={ticket.type} size="sm" />
                  <span className="shrink-0 text-xs font-mono text-zinc-400">
                    {projectKey}-{ticket.number}
                  </span>
                  <span className="truncate text-sm text-zinc-200">{ticket.title}</span>
                  {column && <ColumnBadge column={column} />}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}

/**
 * Global ticket search that works across the current project context.
 * Detects the active project from the URL or project store.
 */
export function GlobalTicketSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setActiveTicketId, activeProjectId } = useUIStore()
  const { projects } = useProjectsStore()

  // Find the current project - prefer active project, fall back to first project
  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0]

  // Debounce the search query
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const { data: results, isLoading } = useTicketSearch(currentProject?.id || '', debouncedQuery)

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset query when closing
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  const handleSelect = useCallback(
    (ticket: TicketWithRelations) => {
      setOpen(false)
      setActiveTicketId(ticket.id)
    },
    [setActiveTicketId],
  )

  const getColumn = useCallback((ticket: TicketWithRelations) => {
    return (ticket as TicketWithRelations & { column?: ColumnInfo }).column ?? null
  }, [])

  const projectKey = currentProject?.key || ''

  if (!currentProject) {
    return null
  }

  return (
    <>
      {/* Search trigger in header - desktop */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'hidden md:flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-500',
          'hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-400 transition-colors',
          'w-full max-w-md cursor-pointer',
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search tickets...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-500 sm:flex">
          <span className="text-xs">
            {typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
              ? '\u2318'
              : 'Ctrl'}
          </span>
          K
        </kbd>
      </button>

      {/* Mobile search button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex md:hidden items-center justify-center h-9 w-9 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        title="Search tickets"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {/* Command palette dialog */}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Tickets"
        description={`Search tickets in ${projectKey}`}
        showCloseButton={false}
      >
        <CommandInput
          placeholder={`Search tickets in ${projectKey}...`}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {debouncedQuery.trim().length === 0 ? (
            <CommandEmpty>Type to search tickets by title, description, or key...</CommandEmpty>
          ) : isLoading && !results ? (
            <CommandEmpty>Searching...</CommandEmpty>
          ) : results && results.length === 0 ? (
            <CommandEmpty>No tickets found for "{debouncedQuery}"</CommandEmpty>
          ) : results && results.length > 0 ? (
            <CommandGroup heading="Tickets">
              {results.map((ticket) => {
                const column = getColumn(ticket)
                return (
                  <CommandItem
                    key={ticket.id}
                    value={`${projectKey}-${ticket.number} ${ticket.title}`}
                    onSelect={() => handleSelect(ticket)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <TypeBadge type={ticket.type} size="sm" />
                    <span className="shrink-0 text-xs font-mono text-zinc-400">
                      {projectKey}-{ticket.number}
                    </span>
                    <span className="truncate text-sm text-zinc-200">{ticket.title}</span>
                    {column && <ColumnBadge column={column} />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
