'use client'

import { FolderOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjects } from '@/hooks/queries/use-projects'
import { getTabId } from '@/hooks/use-realtime'
import { useBoardStore } from '@/stores/board-store'
import type { TicketWithRelations } from '@/types'

interface MoveToProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: TicketWithRelations
  projectKey: string
  projectId: string
}

export function MoveToProjectDialog({
  open,
  onOpenChange,
  ticket,
  projectKey,
  projectId,
}: MoveToProjectDialogProps) {
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  const { data: projects = [] } = useProjects()
  const { removeTicket } = useBoardStore()

  // Filter out the current project
  const availableProjects = useMemo(() => {
    return projects.filter((p) => p.id !== projectId)
  }, [projects, projectId])

  const selectedProject = availableProjects.find((p) => p.key === selectedProjectKey)

  const handleMove = async () => {
    if (!selectedProjectKey) return

    setIsMoving(true)
    try {
      const tabId = getTabId()
      const res = await fetch(`/api/projects/${projectKey}/tickets/${ticket.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tabId ? { 'X-Tab-Id': tabId } : {}),
        },
        body: JSON.stringify({ targetProjectId: selectedProjectKey }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to move ticket' }))
        throw new Error(error.error || 'Failed to move ticket')
      }

      const data = await res.json()

      // Remove ticket from current project's board
      removeTicket(projectId, ticket.id, ticket.columnId)

      toast.success('Ticket moved', {
        description: `${projectKey}-${ticket.number} moved to ${selectedProjectKey}-${data.ticket.number}`,
        duration: 5000,
      })

      onOpenChange(false)
      setSelectedProjectKey(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to move ticket')
    } finally {
      setIsMoving(false)
    }
  }

  const handleClose = () => {
    if (isMoving) return
    onOpenChange(false)
    setSelectedProjectKey(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Move Ticket to Another Project</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Move {projectKey}-{ticket.number} to a different project. The ticket will get a new
            number in the target project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning about what will be cleared */}
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
            <p className="font-medium mb-1">The following will be cleared:</p>
            <ul className="list-disc list-inside text-amber-300/80 space-y-0.5">
              <li>Sprint assignment</li>
              <li>Labels (project-specific)</li>
              <li>Parent/subtask relationship</li>
              <li>Ticket links</li>
              {ticket.assignee && <li>Assignee (if not a member of target project)</li>}
            </ul>
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <span className="text-sm text-zinc-400">Select Target Project</span>
            <div className="max-h-60 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/50">
              {availableProjects.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">
                  No other projects available
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {availableProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                        selectedProjectKey === p.key
                          ? 'bg-amber-500/20 border-l-2 border-amber-500'
                          : 'hover:bg-zinc-800/50'
                      }`}
                      onClick={() => setSelectedProjectKey(p.key)}
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.key.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-500">{p.key}</span>
                          <span className="text-sm text-zinc-200 truncate">{p.name}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Project Preview */}
          {selectedProject && (
            <div className="p-3 rounded bg-zinc-800/50 border border-zinc-700">
              <div className="text-xs text-zinc-500 mb-1">Moving to:</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: selectedProject.color }}
                >
                  {selectedProject.key.charAt(0)}
                </div>
                <span className="font-mono text-sm text-zinc-400">{selectedProject.key}</span>
                <span className="text-sm text-zinc-200">{selectedProject.name}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleMove} disabled={!selectedProjectKey || isMoving}>
            <FolderOpen className="h-4 w-4 mr-2" />
            {isMoving ? 'Moving...' : 'Move Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
