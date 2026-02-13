'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { useCreateTicketLink } from '@/hooks/queries/use-ticket-links'
import { useBoardStore } from '@/stores/board-store'
import type { LinkType, TicketLinkSummary, TicketWithRelations } from '@/types'
import { LINK_TYPE_LABELS, LINK_TYPES } from '@/types'
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

  // Get all tickets from the board store
  const columns = getColumns(projectId)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

  // Get IDs of already linked tickets
  const linkedTicketIds = useMemo(() => {
    const ids = new Set<string>()
    ids.add(ticket.id) // Exclude the current ticket

    for (const link of existingLinks) {
      ids.add(link.linkedTicket.id)
    }

    return ids
  }, [ticket.id, existingLinks])

  // Filter tickets based on search and exclude already linked
  const filteredTickets = useMemo(() => {
    return allTickets.filter((t) => {
      // Exclude current ticket and already linked tickets
      if (linkedTicketIds.has(t.id)) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const ticketKey = `${projectKey}-${t.number}`.toLowerCase()
        return t.title.toLowerCase().includes(query) || ticketKey.includes(query)
      }

      return true
    })
  }, [allTickets, linkedTicketIds, searchQuery, projectKey])

  const selectedTicket = filteredTickets.find((t) => t.id === selectedTicketId)

  const handleCreateLink = () => {
    if (!selectedTicketId) return

    createLink.mutate(
      {
        projectId,
        ticketId: ticket.id,
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
  }

  const handleClose = () => {
    onOpenChange(false)
    setSearchQuery('')
    setSelectedTicketId(null)
    setLinkType('relates_to')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Link Ticket</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a relationship between {projectKey}-{ticket.number} and another ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Link Type Selection */}
          <div className="space-y-2">
            <Label className="text-zinc-400">Link Type</Label>
            <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
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
          <div className="max-h-60 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/50">
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {searchQuery ? 'No tickets match your search' : 'No available tickets to link'}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredTickets.slice(0, 50).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`w-full flex items-center gap-2 p-2 text-left transition-colors ${
                      selectedTicketId === t.id
                        ? 'bg-amber-500/20 border-l-2 border-amber-500'
                        : 'hover:bg-zinc-800/50'
                    }`}
                    onClick={() => setSelectedTicketId(t.id)}
                  >
                    <TypeBadge type={t.type} size="sm" />
                    <span className="font-mono text-xs text-zinc-500 shrink-0">
                      {projectKey}-{t.number}
                    </span>
                    <InlineCodeText text={t.title} className="text-sm truncate text-zinc-300" />
                  </button>
                ))}
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
            <div className="p-3 rounded bg-zinc-800/50 border border-zinc-700">
              <div className="text-xs text-zinc-500 mb-1">Selected:</div>
              <div className="flex items-center gap-2">
                <TypeBadge type={selectedTicket.type} size="sm" />
                <span className="font-mono text-sm text-zinc-400">
                  {projectKey}-{selectedTicket.number}
                </span>
                <span className="text-sm text-zinc-200 truncate">{selectedTicket.title}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateLink}
            disabled={!selectedTicketId || createLink.isPending}
          >
            {createLink.isPending ? 'Creating...' : 'Create Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
