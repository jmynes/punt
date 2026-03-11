'use client'

import { ArrowRightLeft, Ban, Link2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  useDeleteTicketLink,
  useTicketLinks,
  useUpdateTicketLink,
} from '@/hooks/queries/use-ticket-links'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { getAvatarColor, getInitials } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { LinkType, TicketLinkSummary, TicketWithRelations } from '@/types'
import { INVERSE_LINK_TYPES, LINK_TYPE_LABELS, LINK_TYPES } from '@/types'
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
  const updateLink = useUpdateTicketLink()
  const { pushLinkDelete } = useUndoStore()

  // Fetch links from API (or use ticket.links if available)
  const { data: fetchedLinks } = useTicketLinks(projectId, ticket.id, {
    enabled: !ticket.links, // Only fetch if not already included
  })

  const links = ticket.links ?? fetchedLinks ?? []
  const groupedLinks = groupLinksByType(links)

  const handleDeleteLink = (link: TicketLinkSummary) => {
    const sourceTicketKey = `${projectKey}-${ticket.number}`
    const targetTicketKey = `${projectKey}-${link.linkedTicket.number}`
    const displayType = getDisplayLinkType(link)

    deleteLink.mutate(
      {
        projectId,
        ticketId: ticket.id,
        linkId: link.id,
        targetTicketId: link.linkedTicket.id,
      },
      {
        onSuccess: () => {
          pushLinkDelete(projectId, {
            projectId,
            ticketId: ticket.id,
            ticketKey: sourceTicketKey,
            linkId: link.id,
            linkType: link.linkType,
            targetTicketId: link.linkedTicket.id,
            targetTicketKey,
            direction: link.direction,
          })

          showUndoRedoToast('error', {
            title: 'Link removed',
            description: `${sourceTicketKey} ${LINK_TYPE_LABELS[displayType].toLowerCase()} ${targetTicketKey}`,
          })
        },
      },
    )
  }

  const handleChangeRelation = (link: TicketLinkSummary, newDisplayType: LinkType) => {
    updateLink.mutate({
      projectId,
      ticketId: ticket.id,
      linkId: link.id,
      linkType: newDisplayType,
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
                {typeLinks.map((link) => {
                  const currentDisplayType = getDisplayLinkType(link)
                  return (
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
                      {link.linkedTicket.storyPoints != null && (
                        <span className="text-xs text-zinc-500 shrink-0">
                          {link.linkedTicket.storyPoints}p
                        </span>
                      )}
                      {link.linkedTicket.assignee && (
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={link.linkedTicket.assignee.avatar || undefined} />
                          <AvatarFallback
                            className="text-[10px] text-white font-medium"
                            style={{
                              backgroundColor:
                                link.linkedTicket.assignee.avatarColor ||
                                getAvatarColor(
                                  link.linkedTicket.assignee.id || link.linkedTicket.assignee.name,
                                ),
                            }}
                          >
                            {getInitials(link.linkedTicket.assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {link.linkedTicket.resolution && (
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0 border-green-600 text-green-400"
                        >
                          Resolved
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-zinc-900 border-zinc-700 min-w-[180px]"
                        >
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                              Change relation
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="bg-zinc-900 border-zinc-700">
                              <DropdownMenuLabel className="text-zinc-500 text-xs">
                                Link type
                              </DropdownMenuLabel>
                              {LINK_TYPES.map((type) => {
                                const isCurrent = type === currentDisplayType
                                return (
                                  <DropdownMenuItem
                                    key={type}
                                    disabled={isCurrent || updateLink.isPending}
                                    onClick={() => handleChangeRelation(link, type)}
                                    className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                                  >
                                    <span className="flex items-center gap-2 w-full">
                                      {LINK_TYPE_LABELS[type]}
                                      {isCurrent && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 ml-auto border-amber-600 text-amber-400"
                                        >
                                          Current
                                        </Badge>
                                      )}
                                    </span>
                                  </DropdownMenuItem>
                                )
                              })}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator className="bg-zinc-700" />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDeleteLink(link)}
                            disabled={deleteLink.isPending}
                            className="focus:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove link
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
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
