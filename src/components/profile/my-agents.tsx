'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bot, Check, Pencil, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { showToast } from '@/lib/toast'

interface AgentData {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  lastActiveAt: string | null
  _count: {
    ticketsCreated: number
  }
}

function AgentRow({ agent }: { agent: AgentData }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(agent.name)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === agent.name) {
      setIsEditing(false)
      setEditName(agent.name)
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/me/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update agent name')
      }

      await queryClient.invalidateQueries({ queryKey: ['agents', 'me'] })
      setIsEditing(false)
      showToast.success('Agent name updated')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to update agent name')
    } finally {
      setIsSaving(false)
    }
  }, [agent.id, agent.name, editName, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
        setEditName(agent.name)
      }
    },
    [handleSave, agent.name],
  )

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 last:border-b-0">
      {/* Name + status */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={50}
              disabled={isSaving}
              className="h-7 text-sm bg-zinc-800 border-zinc-600 text-zinc-100 w-48"
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-300"
              onClick={() => {
                setIsEditing(false)
                setEditName(agent.name)
              }}
              disabled={isSaving}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 truncate">{agent.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                setEditName(agent.name)
                setIsEditing(true)
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Badge
              variant={agent.isActive ? 'default' : 'secondary'}
              className={
                agent.isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15'
                  : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50 hover:bg-zinc-700/50'
              }
            >
              {agent.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-xs text-zinc-400 shrink-0">
        <div className="w-24 text-right" title="Tickets created">
          {agent._count.ticketsCreated} ticket{agent._count.ticketsCreated === 1 ? '' : 's'}
        </div>
        <div className="w-28 text-right" title="Last active">
          {agent.lastActiveAt
            ? formatDistanceToNow(new Date(agent.lastActiveAt), { addSuffix: true })
            : 'Never'}
        </div>
        <div className="w-28 text-right" title="Created">
          {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}
        </div>
      </div>
    </div>
  )
}

export function MyAgents() {
  const { data: agents, isLoading } = useQuery<AgentData[]>({
    queryKey: ['agents', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/me/agents')
      if (!res.ok) throw new Error('Failed to fetch agents')
      return res.json()
    },
  })

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-zinc-100">My Agents</CardTitle>
        </div>
        <CardDescription className="text-zinc-500">
          AI agents created through MCP API key generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-md bg-zinc-800/30 animate-pulse" />
            ))}
          </div>
        ) : agents && agents.length > 0 ? (
          <div className="rounded-lg border border-zinc-700/50 overflow-hidden bg-zinc-800/20">
            {/* Header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-700/50 bg-zinc-800/50">
              <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Agent
              </div>
              <div className="flex items-center gap-6 text-xs font-medium text-zinc-500 uppercase tracking-wider shrink-0">
                <div className="w-24 text-right">Tickets</div>
                <div className="w-28 text-right">Last Active</div>
                <div className="w-28 text-right">Created</div>
              </div>
            </div>
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
            <p className="text-sm">No agents yet. Generate an MCP API key to create one.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
