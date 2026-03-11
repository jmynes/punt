'use client'

import { Link2, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateTicketLink, useUpdateTicketLink } from '@/hooks/queries/use-ticket-links'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useUndoStore } from '@/stores/undo-store'
import type { LinkType, TicketLinkSummary, TicketWithRelations } from '@/types'
import { INVERSE_LINK_TYPES, LINK_TYPE_LABELS, LINK_TYPES } from '@/types'
import { InlineCodeText } from '../common/inline-code'
import { TypeBadge } from '../common/type-badge'

interface LinkTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: TicketWithRelations
  projectKey: string
  projectId: string
  existingLinks: TicketLinkSummary[]
}

/**
 * Get the display link type for an existing link from the perspective of the source ticket.
 */
function getDisplayLinkType(link: TicketLinkSummary): LinkType {
  if (link.direction === 'inward') {
    return INVERSE_LINK_TYPES[link.linkType]
  }
  return link.linkType
}

export function LinkTicketDialog({
  open,
  onOpenChange,
  ticket,
  projectKey,
  projectId,
  existingLinks,
}: LinkTicketDialogProps) {
  const [linkType, setLinkType] = useState<LinkType>('relates_to')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  const { getColumns } = useBoardStore()
  const createLink = useCreateTicketLink()
  const updateLink = useUpdateTicketLink()
  const { pushLinkCreate } = useUndoStore()

  // Get all tickets from the board store
  const columns = getColumns(projectId)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

  // Build a map of linked ticket IDs to their existing link info
  const existingLinkMap = useMemo(() => {
    const map = new Map<string, TicketLinkSummary>()
    for (const link of existingLinks) {
      map.set(link.linkedTicket.id, link)
    }
    return map
  }, [existingLinks])

  // Find the existing link for the currently selected ticket, if any
  const existingLinkForSelected = selectedTicketId
    ? (existingLinkMap.get(selectedTicketId) ?? null)
    : null

  // Filter tickets based on search — include already-linked tickets so users can change their type
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      // Always exclude the current ticket
      if (t.id === ticket.id) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const ticketKey = `${projectKey}-${t.number}`.toLowerCase()
        return t.title.toLowerCase().includes(query) || ticketKey.includes(query)
      }

      return true
    })
  }, [allTickets, ticket.id, searchQuery, projectKey])

  const selectedTicket = filteredTickets.find((t) => t.id === selectedTicketId)

  // When selecting an already-linked ticket, pre-populate the link type
  const handleSelectTicket = useCallback(
    (ticketId: string) => {
      setSelectedTicketId(ticketId)
      const existingLink = existingLinkMap.get(ticketId)
      if (existingLink) {
        setLinkType(getDisplayLinkType(existingLink))
      }
    },
    [existingLinkMap],
  )

  const handleSubmit = () => {
    if (!selectedTicketId || !selectedTicket) return

    const targetTicketKey = `${projectKey}-${selectedTicket.number}`
    const sourceTicketKey = `${projectKey}-${ticket.number}`

    if (existingLinkForSelected) {
      // Update existing link type
      updateLink.mutate(
        {
          projectId,
          ticketId: ticket.id,
          linkId: existingLinkForSelected.id,
          linkType,
          targetTicketId: selectedTicketId,
        },
        {
          onSuccess: () => {
            onOpenChange(false)
            setSearchQuery('')
            setSelectedTicketId(null)
            setLinkType('relates_to')
          },
        },
      )
    } else {
      // Create new link
      createLink.mutate(
        {
          projectId,
          ticketId: ticket.id,
          linkType,
          targetTicketId: selectedTicketId,
        },
        {
          onSuccess: (data) => {
            pushLinkCreate(projectId, {
              projectId,
              ticketId: ticket.id,
              ticketKey: sourceTicketKey,
              linkId: data.id,
              linkType,
              targetTicketId: selectedTicketId,
              targetTicketKey,
              direction: 'outward',
            })

            showUndoRedoToast('success', {
              title: 'Link created',
              description: `${sourceTicketKey} ${LINK_TYPE_LABELS[linkType].toLowerCase()} ${targetTicketKey}`,
            })

            onOpenChange(false)
            setSearchQuery('')
            setSelectedTicketId(null)
            setLinkType('relates_to')
          },
        },
      )
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchQuery('')
    setSelectedTicketId(null)
    setLinkType('relates_to')
  }

  const isPending = createLink.isPending || updateLink.isPending
  const isUpdating = !!existingLinkForSelected
  // Disable submit if updating but link type hasn't changed
  const existingDisplayType = existingLinkForSelected
    ? getDisplayLinkType(existingLinkForSelected)
    : null
  const isUnchanged = isUpdating && linkType === existingDisplayType

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Link Ticket</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a relationship between {projectKey}-{ticket.number} and another ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 min-w-0">
          {/* Link Type Selection */}
          <div className="space-y-2">
            <Label className="text-zinc-400">Link Type</Label>
            <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {LINK_TYPES.map((type) => {
                  const isCurrentType = existingDisplayType === type
                  return (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        {LINK_TYPE_LABELS[type]}
                        {isCurrentType && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-amber-600 text-amber-400"
                          >
                            Current
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Ticket Search */}
          <div className="space-y-2">
            <Label className="text-zinc-400">Target Ticket</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket key or title..."
                className="pl-9 bg-zinc-900 border-zinc-700"
              />
            </div>
          </div>

          {/* Ticket List */}
          <div className="max-h-60 overflow-y-auto overflow-x-hidden rounded border border-zinc-800 bg-zinc-900/50">
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {searchQuery ? 'No tickets match your search' : 'No available tickets to link'}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredTickets.slice(0, 50).map((t) => {
                  const existingLink = existingLinkMap.get(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`w-full min-w-0 flex items-center gap-2 p-2 text-left transition-colors ${
                        selectedTicketId === t.id
                          ? 'bg-amber-500/20 border-l-2 border-amber-500'
                          : 'hover:bg-zinc-800/50'
                      }`}
                      onClick={() => handleSelectTicket(t.id)}
                    >
                      <TypeBadge type={t.type} size="sm" />
                      <span className="font-mono text-xs text-zinc-500 shrink-0">
                        {projectKey}-{t.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                        <InlineCodeText text={t.title} />
                      </span>
                      {existingLink && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 shrink-0 border-zinc-600 text-zinc-400 flex items-center gap-1"
                        >
                          <Link2 className="h-2.5 w-2.5" />
                          {LINK_TYPE_LABELS[getDisplayLinkType(existingLink)]}
                        </Badge>
                      )}
                    </button>
                  )
                })}
                {filteredTickets.length > 50 && (
                  <div className="p-2 text-center text-xs text-zinc-500">
                    Showing first 50 results. Refine your search for more specific results.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Ticket Preview */}
          {selectedTicket && (
            <div className="p-3 rounded bg-zinc-800/50 border border-zinc-700 min-w-0">
              <div className="text-xs text-zinc-500 mb-1">
                {isUpdating ? 'Update existing link:' : 'Selected:'}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <TypeBadge type={selectedTicket.type} size="sm" />
                <span className="font-mono text-sm text-zinc-400 shrink-0">
                  {projectKey}-{selectedTicket.number}
                </span>
                <span className="text-sm text-zinc-200 truncate min-w-0 flex-1">
                  {selectedTicket.title}
                </span>
              </div>
              {isUpdating && existingDisplayType && (
                <div className="mt-1.5 text-xs text-zinc-500">
                  Currently:{' '}
                  <span className="text-amber-400">{LINK_TYPE_LABELS[existingDisplayType]}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedTicketId || isPending || isUnchanged}
          >
            {isPending
              ? isUpdating
                ? 'Updating...'
                : 'Creating...'
              : isUpdating
                ? 'Update Link'
                : 'Create Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
