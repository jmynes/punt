'use client'

import { AlertCircle, Link2, Search, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateTicketLinks } from '@/hooks/queries/use-ticket-links'
import { useBoardStore } from '@/stores/board-store'
import { useUndoStore } from '@/stores/undo-store'
import type { LinkType, TicketLinkSummary, TicketWithRelations } from '@/types'
import { INVERSE_LINK_TYPES, LINK_TYPE_LABELS, LINK_TYPES } from '@/types'
import { InlineCodeText } from '../common/inline-code'
import { TypeBadge } from '../common/type-badge'

interface StagedTicket {
  id: string
  number: number
  title: string
  type: TicketWithRelations['type']
  linkType: LinkType
  /** The existing link type if this ticket is already linked (for display only) */
  existingLinkType?: string
}

interface PasteError {
  key: string
  message: string
}

interface LinkTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Single source ticket (from ticket detail view) */
  ticket?: TicketWithRelations
  /** Multiple source tickets (from multi-select context menu) */
  tickets?: TicketWithRelations[]
  projectKey: string
  projectId: string
  existingLinks?: TicketLinkSummary[]
}

export function LinkTicketDialog({
  open,
  onOpenChange,
  ticket,
  tickets: ticketsProp,
  projectKey,
  projectId,
  existingLinks = [],
}: LinkTicketDialogProps) {
  // Normalize to array of source tickets
  const sourceTickets = useMemo(
    () => ticketsProp ?? (ticket ? [ticket] : []),
    [ticketsProp, ticket],
  )
  const sourceIds = useMemo(() => new Set(sourceTickets.map((t) => t.id)), [sourceTickets])
  const isMultiSource = sourceTickets.length > 1

  const [defaultLinkType, setDefaultLinkType] = useState<LinkType>('relates_to')
  const [searchQuery, setSearchQuery] = useState('')
  const [stagedTickets, setStagedTickets] = useState<StagedTicket[]>([])
  const [pasteErrors, setPasteErrors] = useState<PasteError[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { getColumns } = useBoardStore()
  const createLinks = useCreateTicketLinks()
  const { pushBulkLinkCreate } = useUndoStore()

  // Get all tickets from the board store
  const columns = getColumns(projectId)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

  // Build a map from ticket number to ticket for paste resolution
  const ticketsByNumber = useMemo(() => {
    const map = new Map<number, TicketWithRelations>()
    for (const t of allTickets) {
      map.set(t.number, t)
    }
    return map
  }, [allTickets])

  // Build a map of existing link info by ticket ID
  const existingLinkMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const link of existingLinks) {
      const displayType =
        link.direction === 'inward'
          ? LINK_TYPE_LABELS[INVERSE_LINK_TYPES[link.linkType]]
          : LINK_TYPE_LABELS[link.linkType]
      map.set(link.linkedTicket.id, displayType)
    }
    return map
  }, [existingLinks])

  // IDs of staged tickets for dedup
  const stagedIds = useMemo(() => new Set(stagedTickets.map((t) => t.id)), [stagedTickets])

  // Filter tickets for dropdown: exclude source tickets, already staged
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      if (sourceIds.has(t.id)) return false
      if (stagedIds.has(t.id)) return false

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const ticketKey = `${projectKey}-${t.number}`.toLowerCase()
        return t.title.toLowerCase().includes(query) || ticketKey.includes(query)
      }

      return true
    })
  }, [allTickets, sourceIds, stagedIds, searchQuery, projectKey])

  const addTicketToStaging = useCallback(
    (t: TicketWithRelations) => {
      if (sourceIds.has(t.id) || stagedIds.has(t.id)) return

      setStagedTickets((prev) => [
        ...prev,
        {
          id: t.id,
          number: t.number,
          title: t.title,
          type: t.type,
          linkType: defaultLinkType,
          existingLinkType: existingLinkMap.get(t.id),
        },
      ])
      setSearchQuery('')
      // Keep focus on search input for rapid multi-add
      searchInputRef.current?.focus()
    },
    [sourceIds, stagedIds, defaultLinkType, existingLinkMap],
  )

  const removeFromStaging = useCallback((ticketId: string) => {
    setStagedTickets((prev) => prev.filter((t) => t.id !== ticketId))
  }, [])

  const updateStagedLinkType = useCallback((ticketId: string, newLinkType: LinkType) => {
    setStagedTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, linkType: newLinkType } : t)),
    )
  }, [])

  const dismissPasteError = useCallback((key: string) => {
    setPasteErrors((prev) => prev.filter((e) => e.key !== key))
  }, [])

  // Handle paste of comma/space-separated ticket keys
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text/plain')
      if (!text) return

      // Extract ticket keys from pasted text: match patterns like "PUNT-123", "punt-5", or just numbers
      const keyPattern = new RegExp(`${projectKey}-(\\d+)`, 'gi')
      const matches = [...text.matchAll(keyPattern)]

      if (matches.length === 0) return

      // Prevent the paste from going into the input
      e.preventDefault()

      const newErrors: PasteError[] = []
      const newStaged: StagedTicket[] = []
      const currentStagedIds = new Set(stagedTickets.map((t) => t.id))

      for (const match of matches) {
        const num = Number.parseInt(match[1], 10)
        const key = `${projectKey}-${num}`
        const found = ticketsByNumber.get(num)

        if (!found) {
          newErrors.push({ key, message: 'Not found' })
          continue
        }
        if (sourceIds.has(found.id)) {
          newErrors.push({ key, message: 'Cannot link to self' })
          continue
        }
        if (currentStagedIds.has(found.id)) {
          // Already staged, skip silently
          continue
        }

        currentStagedIds.add(found.id)
        newStaged.push({
          id: found.id,
          number: found.number,
          title: found.title,
          type: found.type,
          linkType: defaultLinkType,
          existingLinkType: existingLinkMap.get(found.id),
        })
      }

      if (newStaged.length > 0) {
        setStagedTickets((prev) => [...prev, ...newStaged])
      }
      if (newErrors.length > 0) {
        setPasteErrors((prev) => [...prev, ...newErrors])
      }
      setSearchQuery('')
      searchInputRef.current?.focus()
    },
    [projectKey, sourceIds, stagedTickets, ticketsByNumber, defaultLinkType, existingLinkMap],
  )

  const handleCreateLinks = async () => {
    if (stagedTickets.length === 0 || sourceTickets.length === 0) return

    // Capture staged tickets before close clears them
    const staged = [...stagedTickets]
    const links = staged.map((t) => ({
      linkType: t.linkType,
      targetTicketId: t.id,
    }))

    // Create links from each source ticket to each staged target
    let totalSucceeded = 0
    const allLinkActions: Parameters<typeof pushBulkLinkCreate>[1] = []

    for (const source of sourceTickets) {
      const sourceKey = `${projectKey}-${source.number}`
      try {
        const result = await createLinks.mutateAsync({
          projectId,
          ticketId: source.id,
          links,
        })

        if (result.succeeded.length > 0) {
          totalSucceeded += result.succeeded.length
          for (const link of result.succeeded) {
            allLinkActions.push({
              projectId,
              ticketId: source.id,
              ticketKey: sourceKey,
              linkId: link.id,
              linkType: link.linkType,
              targetTicketId: link.linkedTicket.id,
              targetTicketKey: `${projectKey}-${link.linkedTicket.number}`,
              direction: 'outward' as const,
            })
          }
        }
      } catch {
        // Individual source failures are handled by the hook's onError
      }
    }

    if (allLinkActions.length > 0) {
      pushBulkLinkCreate(projectId, allLinkActions)
    }

    handleClose()
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchQuery('')
    setStagedTickets([])
    setPasteErrors([])
    setDefaultLinkType('relates_to')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Link Tickets
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {isMultiSource
              ? `Link one or more tickets to ${sourceTickets.length} selected tickets. Paste comma-separated keys or search to add.`
              : `Link one or more tickets to ${projectKey}-${sourceTickets[0]?.number}. Paste comma-separated keys or search to add.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 min-w-0">
          {/* Default Link Type Selection */}
          <div className="space-y-2">
            <Label className="text-zinc-400">Default Relation Type</Label>
            <Select
              value={defaultLinkType}
              onValueChange={(v) => setDefaultLinkType(v as LinkType)}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {LINK_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {LINK_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search / Paste Input */}
          <div className="space-y-2">
            <Label className="text-zinc-400">Search or paste ticket keys</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPaste={handlePaste}
                placeholder={`Search or paste keys (e.g. ${projectKey}-1, ${projectKey}-5)...`}
                className="pl-9 bg-zinc-900 border-zinc-700"
                autoFocus
              />
            </div>
          </div>

          {/* Search Results Dropdown */}
          {searchQuery.trim() && (
            <div className="max-h-48 overflow-y-auto overflow-x-hidden rounded border border-zinc-800 bg-zinc-900/50">
              {filteredTickets.length === 0 ? (
                <div className="p-3 text-center text-sm text-zinc-500">
                  No tickets match your search
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filteredTickets.slice(0, 30).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full min-w-0 flex items-center gap-2 p-2 text-left transition-colors hover:bg-zinc-800/50"
                      onClick={() => addTicketToStaging(t)}
                    >
                      <TypeBadge type={t.type} size="sm" />
                      <span className="font-mono text-xs text-zinc-500 shrink-0">
                        {projectKey}-{t.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                        <InlineCodeText text={t.title} />
                      </span>
                      {existingLinkMap.has(t.id) && (
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0 border-zinc-600 text-zinc-500"
                        >
                          Linked
                        </Badge>
                      )}
                    </button>
                  ))}
                  {filteredTickets.length > 30 && (
                    <div className="p-2 text-center text-xs text-zinc-500">
                      Showing first 30 results. Refine your search.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paste Errors */}
          {pasteErrors.length > 0 && (
            <div className="space-y-1">
              {pasteErrors.map((err) => (
                <div
                  key={err.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-950/30 border border-red-900/50 text-sm"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span className="text-red-300 font-mono text-xs">{err.key}</span>
                  <span className="text-red-400 text-xs">{err.message}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-auto text-red-500 hover:text-red-300"
                    onClick={() => dismissPasteError(err.key)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Staging Area */}
          {stagedTickets.length > 0 && (
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">
                Queued for linking ({stagedTickets.length})
              </Label>
              <div className="max-h-52 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800">
                {stagedTickets.map((staged) => (
                  <div
                    key={staged.id}
                    className="flex items-center gap-2 px-2 py-1.5 min-w-0 group"
                  >
                    <TypeBadge type={staged.type} size="sm" />
                    <span className="font-mono text-xs text-zinc-500 shrink-0">
                      {projectKey}-{staged.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                      <InlineCodeText text={staged.title} />
                    </span>
                    {staged.existingLinkType && (
                      <span className="text-[10px] text-zinc-600 shrink-0">
                        Currently: {staged.existingLinkType}
                      </span>
                    )}
                    {/* Per-ticket link type override via popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 text-[11px] px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer"
                        >
                          {LINK_TYPE_LABELS[staged.linkType]}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-44 p-1 bg-zinc-900 border-zinc-700"
                        align="end"
                        sideOffset={4}
                      >
                        {LINK_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                              staged.linkType === type
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                            }`}
                            onClick={() => updateStagedLinkType(staged.id, type)}
                          >
                            {LINK_TYPE_LABELS[type]}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 shrink-0"
                      onClick={() => removeFromStaging(staged.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no staged tickets and no search */}
          {stagedTickets.length === 0 && !searchQuery.trim() && (
            <div className="text-center py-6 text-sm text-zinc-500">
              Search for tickets or paste keys to add them here
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateLinks}
            disabled={stagedTickets.length === 0 || createLinks.isPending}
          >
            {createLinks.isPending
              ? 'Linking...'
              : stagedTickets.length === 0
                ? 'Link Tickets'
                : `Link ${stagedTickets.length} ticket${stagedTickets.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
