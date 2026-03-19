'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Check, Loader2, Pencil, Power, PowerOff, Trash2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { AgentIdenticon, PageHeader } from '@/components/common'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { apiFetch } from '@/lib/base-path'
import { showToast } from '@/lib/toast'
import { getAvatarColor, getInitials } from '@/lib/utils'

interface AgentOwner {
  id: string
  username: string
  name: string | null
  email: string | null
  avatar: string | null
  avatarColor: string | null
}

interface Agent {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  lastActiveAt: string | null
  owner: AgentOwner
  _count: { ticketsCreated: number }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function OwnerCell({ owner }: { owner: AgentOwner }) {
  const displayName = owner.name ?? owner.username
  const initials = getInitials(displayName)
  const avatarColor = owner.avatarColor ?? getAvatarColor(owner.username)

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        {owner.avatar && <AvatarImage src={owner.avatar} alt={displayName} />}
        <AvatarFallback
          className="text-[10px] text-white font-medium"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-zinc-300 text-sm">{owner.username}</span>
    </div>
  )
}

function InlineRenameCell({
  agent,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  agent: Agent
  isEditing: boolean
  onStartEdit: () => void
  onSave: (name: string) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [editName, setEditName] = useState(agent.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleStartEdit = useCallback(() => {
    setEditName(agent.name)
    onStartEdit()
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [agent.name, onStartEdit])

  const handleSave = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== agent.name) {
      onSave(trimmed)
    } else {
      onCancel()
    }
  }, [editName, agent.name, onSave, onCancel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave()
      } else if (e.key === 'Escape') {
        onCancel()
      }
    },
    [handleSave, onCancel],
  )

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          maxLength={50}
          className="h-7 text-sm bg-zinc-800 border-zinc-700 w-40"
          disabled={isSaving}
        />
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-green-500 hover:text-green-400"
              onClick={handleSave}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
              onMouseDown={(e) => {
                e.preventDefault()
                onCancel()
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      <AgentIdenticon identifier={agent.id} size={24} />
      <span className="text-zinc-100 font-medium">{agent.name}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300"
            onClick={handleStartEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Rename agent</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AgentList() {
  const queryClient = useQueryClient()
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)

  const {
    data: agents,
    isLoading,
    error,
  } = useQuery<Agent[]>({
    queryKey: ['admin', 'agents'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/agents')
      if (!res.ok) {
        throw new Error('Failed to fetch agents')
      }
      return res.json()
    },
  })

  const updateAgent = useMutation({
    mutationFn: async ({
      agentId,
      updates,
    }: {
      agentId: string
      updates: { name?: string; isActive?: boolean }
    }) => {
      const res = await apiFetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to update agent')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      setEditingAgentId(null)
      if (variables.updates.name) {
        showToast.success('Agent renamed')
      } else if (variables.updates.isActive !== undefined) {
        showToast.success(variables.updates.isActive ? 'Agent activated' : 'Agent deactivated')
      }
    },
    onError: (err: Error) => {
      showToast.error(err.message)
    },
  })

  const deleteAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiFetch(`/api/admin/agents/${agentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to delete agent')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      showToast.success('Agent deleted')
    },
    onError: (err: Error) => {
      showToast.error(err.message)
    },
  })

  const handleToggleActive = useCallback(
    (agent: Agent) => {
      updateAgent.mutate({
        agentId: agent.id,
        updates: { isActive: !agent.isActive },
      })
    },
    [updateAgent],
  )

  const handleRename = useCallback(
    (agentId: string, name: string) => {
      updateAgent.mutate({
        agentId,
        updates: { name },
      })
    },
    [updateAgent],
  )

  return (
    <>
      <PageHeader
        icon={Bot}
        category="Admin"
        title="Agents"
        description="Manage AI agent access across the system"
        variant="hero"
        accentColor="purple"
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 pb-6 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={`agent-skeleton-${i}`}
                  className="h-16 bg-zinc-800/50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400">
              Failed to load agents. Please try again.
            </div>
          )}

          {!isLoading && !error && agents && agents.length === 0 && (
            <div className="text-center py-16">
              <Bot className="h-12 w-12 mx-auto text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">No agents yet</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                Agents are created when users generate MCP API keys. Once an agent is linked to a
                key, it will appear here.
              </p>
            </div>
          )}

          {!isLoading && !error && agents && agents.length > 0 && (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto_auto] gap-4 px-4 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                <span>Agent</span>
                <span>Owner</span>
                <span className="w-20 text-center">Status</span>
                <span className="w-24">Created</span>
                <span className="w-24">Last Active</span>
                <span className="w-16 text-right">Tickets</span>
                <span className="w-20" />
              </div>

              {agents.map((agent) => (
                <Card
                  key={agent.id}
                  className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors"
                >
                  <CardContent className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center p-4">
                    <InlineRenameCell
                      agent={agent}
                      isEditing={editingAgentId === agent.id}
                      onStartEdit={() => setEditingAgentId(agent.id)}
                      onSave={(name) => handleRename(agent.id, name)}
                      onCancel={() => setEditingAgentId(null)}
                      isSaving={updateAgent.isPending && editingAgentId === agent.id}
                    />

                    <OwnerCell owner={agent.owner} />

                    <div className="w-20 flex justify-center">
                      {agent.isActive ? (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/10">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/10">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <span className="text-zinc-400 text-sm w-24">
                      {formatDate(agent.createdAt)}
                    </span>

                    <span className="text-zinc-400 text-sm w-24">
                      {formatDate(agent.lastActiveAt)}
                    </span>

                    <span className="text-zinc-400 text-sm w-16 text-right">
                      {agent._count.ticketsCreated}
                    </span>

                    <div className="w-10 flex justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              agent.isActive
                                ? 'h-8 w-8 p-0 text-zinc-500 hover:text-amber-400'
                                : 'h-8 w-8 p-0 text-zinc-500 hover:text-green-400'
                            }
                            onClick={() => handleToggleActive(agent)}
                            disabled={updateAgent.isPending}
                          >
                            {agent.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {agent.isActive ? 'Deactivate agent' : 'Activate agent'}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="w-10 flex justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400"
                            onClick={() => deleteAgent.mutate(agent.id)}
                            disabled={deleteAgent.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete agent</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
