'use client'

import { Ban, Link2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useDeleteTicketLink, useTicketLinks } from '@/hooks/queries/use-ticket-links'
import { useUIStore } from '@/stores/ui-store'
import type { LinkType, TicketLinkSummary, TicketWithRelations } from '@/types'
import { INVERSE_LINK_TYPES, LINK_TYPE_LABELS } from '@/types'
import { InlineCodeText } from '../common/inline-code'
import { TypeBadge } from '../common/type-badge'
import { LinkTicketDialog } from './link-ticket-dialog'

interface TicketLinkSectionProps {
  ticket: TicketWithRelations
  projectKey: string
  projectId: string
}

/**
 * Get the display link type based on direction.
 * For inward links, we show the inverse link type.
 */
function getDisplayLinkType(link: TicketLinkSummary): LinkType {
  if (link.direction === 'inward') {
    return INVERSE_LINK_TYPES[link.linkType]
  }
  return link.linkType
}

/**
 * Group links by their display type for organized rendering.
 */
function groupLinksByType(links: TicketLinkSummary[]): Map<LinkType, TicketLinkSummary[]> {
  const grouped = new Map<LinkType, TicketLinkSummary[]>()

  for (const link of links) {
    const displayType = getDisplayLinkType(link)
    if (!grouped.has(displayType)) {
      grouped.set(displayType, [])
    }
    grouped.get(displayType)?.push(link)
  }

  return grouped
}

export function TicketLinkSection({ ticket, projectKey, projectId }: TicketLinkSectionProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const { setActiveTicketId } = useUIStore()
  const deleteLink = useDeleteTicketLink()

  // Fetch links from API (or use ticket.links if available)
  const { data: fetchedLinks } = useTicketLinks(projectId, ticket.id, {
    enabled: !ticket.links, // Only fetch if not already included
  })

  const links = ticket.links ?? fetchedLinks ?? []
  const groupedLinks = groupLinksByType(links)

  const handleDeleteLink = (link: TicketLinkSummary) => {
    deleteLink.mutate({
      projectId,
      ticketId: ticket.id,
      linkId: link.id,
      targetTicketId: link.linkedTicket.id,
    })
  }

  const handleTicketClick = (ticketId: string) => {
    setActiveTicketId(ticketId)
  }

  // Check if this ticket is blocked by any unresolved tickets
  const blockedBy = links.filter(
    (link) => getDisplayLinkType(link) === 'is_blocked_by' && !link.linkedTicket.resolution,
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-zinc-400 flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Links
          {blockedBy.length > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs">
              <Ban className="h-3 w-3 mr-1" />
              Blocked
            </Badge>
          )}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
          onClick={() => setShowLinkDialog(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Link
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-sm text-zinc-500 italic py-2">No linked tickets</div>
      ) : (
        <div className="space-y-3">
          {Array.from(groupedLinks.entries()).map(([linkType, typeLinks]) => (
            <div key={linkType} className="space-y-1">
              <div className="text-xs text-zinc-500 font-medium">{LINK_TYPE_LABELS[linkType]}</div>
              <div className="space-y-1">
                {typeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50 hover:bg-zinc-800/50"
                  >
                    <TypeBadge type={link.linkedTicket.type} size="sm" />
                    <button
                      type="button"
                      className="flex-1 flex items-center gap-2 text-left hover:text-amber-400 transition-colors min-w-0"
                      onClick={() => handleTicketClick(link.linkedTicket.id)}
                    >
                      <span className="font-mono text-zinc-500 text-xs shrink-0">
                        {projectKey}-{link.linkedTicket.number}
                      </span>
                      <InlineCodeText
                        text={link.linkedTicket.title}
                        className="text-sm truncate text-zinc-300"
                      />
                    </button>
                    {link.linkedTicket.resolution && (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 border-green-600 text-green-400"
                      >
                        Resolved
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                      onClick={() => handleDeleteLink(link)}
                      disabled={deleteLink.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <LinkTicketDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        ticket={ticket}
        projectKey={projectKey}
        projectId={projectId}
        existingLinks={links}
      />
    </div>
  )
}
