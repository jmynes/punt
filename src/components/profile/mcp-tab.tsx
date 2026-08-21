'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Check, Copy, Eye, EyeOff, FileText, KeyRound, Plus, Terminal, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, LoadingButton } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch, basePath } from '@/lib/base-path'
import { showToast } from '@/lib/toast'
import { MyAgents } from './my-agents'
import { ReauthDialog } from './reauth-dialog'

interface MCPTabProps {
  isDemo: boolean
}

interface McpApiKeyData {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
}

/**
 * Displays a file path as a titlebar with copy button
 */
function PathDisplay({ path, onCopy }: { path: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      onCopy?.()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-t-lg">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
        <code className="text-[11px] font-mono text-amber-400 truncate">{path}</code>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
        aria-label={copied ? 'Copied' : 'Copy path'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

/**
 * Row for a single MCP API key
 */
function McpKeyRow({
  apiKey,
  onRevoke,
}: {
  apiKey: McpApiKeyData
  onRevoke: (keyId: string) => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-sm font-medium text-zinc-200 truncate">{apiKey.name}</span>
          <code className="text-xs font-mono text-zinc-500">{apiKey.keyPrefix}...</code>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-zinc-400 shrink-0">
        <div className="w-28 text-right" title="Last used">
          {apiKey.lastUsedAt
            ? formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })
            : 'Never used'}
        </div>
        <div className="w-28 text-right" title="Created">
          {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
          onClick={() => onRevoke(apiKey.id)}
          title="Revoke key"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Newly created key display with copy functionality
 */
function NewKeyDisplay({ apiKey, onDismiss }: { apiKey: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(true)
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
      showToast.success('API key copied to clipboard')
    } catch {
      showToast.error('Failed to copy to clipboard')
    }
  }, [apiKey])

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <KeyRound className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">Copy this key now. It will not be shown again.</p>
      </div>
      <div className="flex items-center gap-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg font-mono text-sm">
        <code className="flex-1 truncate text-zinc-200 select-all">
          {visible ? apiKey : '\u2022'.repeat(40)}
        </code>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-zinc-400 hover:text-zinc-200"
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </div>
  )
}

/**
 * Two-step dialog for creating a new API key:
 * Step 1: Enter key name
 * Step 2: Re-authenticate with password (+ 2FA if enabled)
 */
function CreateKeyDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (
    name: string,
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => Promise<void>
}) {
  const [step, setStep] = useState<'name' | 'auth'>('name')
  const [keyName, setKeyName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('name')
      setKeyName('')
      setNameError(null)
      setLoading(false)
    }
  }, [open])

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = keyName.trim()
    if (!trimmed) {
      setNameError('Key name is required')
      return
    }
    if (trimmed.length > 100) {
      setNameError('Key name must be 100 characters or less')
      return
    }
    setNameError(null)
    setStep('auth')
  }

  if (step === 'auth') {
    return (
      <ReauthDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            onOpenChange(false)
          }
        }}
        title={`Create key "${keyName.trim()}"`}
        description="Enter your password to create the API key."
        actionLabel="Create Key"
        onConfirm={async (password, totpCode, isRecoveryCode) => {
          await onConfirm(keyName.trim(), password, totpCode, isRecoveryCode)
        }}
      />
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="bg-zinc-900 border-zinc-800"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          setTimeout(() => {
            document.getElementById('create-key-name')?.focus()
          }, 0)
        }}
      >
        <form onSubmit={handleNameSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Create MCP API Key</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Give this key a descriptive name so you can identify it later.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-key-name" className="text-zinc-300">
                Key Name
              </Label>
              <Input
                id="create-key-name"
                type="text"
                value={keyName}
                onChange={(e) => {
                  setKeyName(e.target.value)
                  setNameError(null)
                }}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
                placeholder='e.g., "Work laptop", "CI server"'
                maxLength={100}
                autoFocus
                required
              />
              {nameError && <p className="text-sm text-red-400">{nameError}</p>}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              type="button"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={loading}
            >
              Cancel
            </AlertDialogCancel>
            <LoadingButton
              type="submit"
              loading={loading}
              disabled={!keyName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Next
            </LoadingButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function MCPTab({ isDemo }: MCPTabProps) {
  const queryClient = useQueryClient()
  const [mcpKeyLoading, setMcpKeyLoading] = useState(false)
  const [mcpNewKey, setMcpNewKey] = useState<string | null>(null)

  // Defer Radix Tabs to client to avoid hydration ID mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null)

  // Fetch keys from new multi-key endpoint
  const {
    data: mcpKeys,
    isLoading: keysLoading,
    refetch: refetchKeys,
  } = useQuery<McpApiKeyData[]>({
    queryKey: ['mcp-keys', 'me'],
    queryFn: async () => {
      if (isDemo) return []
      const res = await apiFetch('/api/me/mcp-keys')
      if (!res.ok) throw new Error('Failed to fetch MCP keys')
      return res.json()
    },
    enabled: !isDemo,
  })

  // Also check legacy key status for backwards compatibility display
  const { data: legacyKeyStatus } = useQuery<{ hasKey: boolean; keyHint: string | null }>({
    queryKey: ['mcp-key-legacy'],
    queryFn: async () => {
      if (isDemo) return { hasKey: false, keyHint: null }
      const res = await apiFetch('/api/me/mcp-key')
      if (!res.ok) return { hasKey: false, keyHint: null }
      return res.json()
    },
    enabled: !isDemo,
  })

  // Refetch when SSE notifies of key change
  useEffect(() => {
    const onKeyUpdated = () => {
      refetchKeys()
      queryClient.invalidateQueries({ queryKey: ['mcp-key-legacy'] })
    }
    window.addEventListener('punt:mcp-key-updated', onKeyUpdated)
    return () => window.removeEventListener('punt:mcp-key-updated', onKeyUpdated)
  }, [refetchKeys, queryClient])

  const handleCreateKey = async (
    name: string,
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    setMcpKeyLoading(true)
    try {
      const res = await apiFetch('/api/me/mcp-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, totpCode, isRecoveryCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.requires2fa) {
          throw new Error('2FA code required')
        }
        throw new Error(data.error || 'Failed to create API key')
      }
      setMcpNewKey(data.apiKey)
      setShowCreateDialog(false)
      refetchKeys()
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      showToast.success('MCP API key created')
    } finally {
      setMcpKeyLoading(false)
    }
  }

  const handleRevokeKey = async (password: string, totpCode?: string, isRecoveryCode?: boolean) => {
    if (!revokeKeyId) return
    setMcpKeyLoading(true)
    try {
      const res = await apiFetch(`/api/me/mcp-keys/${revokeKeyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, totpCode, isRecoveryCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.requires2fa) {
          throw new Error('2FA code required')
        }
        throw new Error(data.error || 'Failed to revoke API key')
      }
      setRevokeKeyId(null)
      refetchKeys()
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      showToast.success('MCP API key revoked')
    } finally {
      setMcpKeyLoading(false)
    }
  }

  if (isDemo) {
    return (
      <div className="space-y-6">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">MCP API Keys</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              API key management is not available in demo mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="px-4 py-6 text-center text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <p className="text-sm">
                Sign in to a real PUNT instance to generate and manage MCP API keys.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasKeys = (mcpKeys && mcpKeys.length > 0) ?? false
  const hasLegacyKey = legacyKeyStatus?.hasKey ?? false

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">MCP API Keys</CardTitle>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={mcpKeyLoading}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Key
            </Button>
          </div>
          <CardDescription className="text-zinc-500">
            Create and manage API keys to connect Claude Code to PUNT via MCP. Each key can be named
            for easy identification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Newly created key display */}
          {mcpNewKey && <NewKeyDisplay apiKey={mcpNewKey} onDismiss={() => setMcpNewKey(null)} />}

          {/* Legacy key notice */}
          {hasLegacyKey && (
            <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <KeyRound className="h-4 w-4 text-zinc-500 shrink-0" />
              <p className="text-xs text-zinc-400">
                You have a legacy API key
                {legacyKeyStatus?.keyHint ? (
                  <>
                    {' '}
                    ending in{' '}
                    <code className="text-amber-400 font-mono">...{legacyKeyStatus.keyHint}</code>
                  </>
                ) : null}
                . It still works, but consider creating named keys for better management.
              </p>
            </div>
          )}

          {/* Key list */}
          {keysLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-md bg-zinc-800/30 animate-pulse" />
              ))}
            </div>
          ) : hasKeys ? (
            <div className="rounded-lg border border-zinc-700/50 overflow-hidden bg-zinc-800/20">
              {/* Header */}
              <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-700/50 bg-zinc-800/50">
                <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Key
                </div>
                <div className="flex items-center gap-6 text-xs font-medium text-zinc-500 uppercase tracking-wider shrink-0">
                  <div className="w-28 text-right">Last Used</div>
                  <div className="w-28 text-right">Created</div>
                  <div className="w-7" />
                </div>
              </div>
              {mcpKeys?.map((key) => (
                <McpKeyRow key={key.id} apiKey={key} onRevoke={(id) => setRevokeKeyId(id)} />
              ))}
            </div>
          ) : !hasLegacyKey ? (
            <div className="px-4 py-6 text-center text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <p className="text-sm">
                No API keys yet. Create one to authenticate MCP requests from Claude Code.
              </p>
            </div>
          ) : null}

          {/* Create key dialog */}
          <CreateKeyDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onConfirm={handleCreateKey}
          />

          {/* Revoke key dialog */}
          <ReauthDialog
            open={revokeKeyId !== null}
            onOpenChange={(isOpen) => {
              if (!isOpen) setRevokeKeyId(null)
            }}
            title="Revoke MCP API Key?"
            description="This will immediately invalidate the key. Any MCP clients using it will stop working."
            actionLabel="Revoke Key"
            actionVariant="destructive"
            onConfirm={handleRevokeKey}
          />
        </CardContent>
      </Card>

      <MyAgents />

      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">MCP Configuration</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            How to configure Claude Code to use PUNT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-zinc-700/50 overflow-hidden">
            <div className="bg-gradient-to-r from-zinc-800/80 to-zinc-800/40 px-4 py-3 border-b border-zinc-700/50">
              <h4 className="text-sm font-semibold text-zinc-100">Setup Guide</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure MCP to use PUNT with Claude Code or Claude Desktop
              </p>
            </div>

            <div className="p-4 space-y-6 bg-zinc-900/30">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    1
                  </span>
                  <h5 className="text-sm font-medium text-zinc-200">
                    Add the PUNT MCP server to your client
                  </h5>
                </div>

                <div className="ml-9 space-y-3">
                  <p className="text-xs text-zinc-400">
                    Create a{' '}
                    <code className="text-amber-400 bg-zinc-800 px-1 rounded">.mcp.json</code> file
                    in your project root:
                  </p>

                  <div>
                    <PathDisplay
                      path=".mcp.json"
                      onCopy={() => showToast.success('Path copied to clipboard')}
                    />
                    <CodeBlock
                      language="json"
                      className="[&>div]:rounded-t-none [&>div]:border-t-0"
                      code={`{
  "mcpServers": {
    "punt": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"]
    }
  }
}`}
                      onCopy={() => showToast.success('Copied to clipboard')}
                    />
                  </div>

                  <p className="text-xs text-zinc-500">
                    Place this file in your PUNT project root. The relative path{' '}
                    <code className="text-amber-400 bg-zinc-800 px-1 rounded">mcp</code> works when
                    Claude Code runs from the project directory.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    2
                  </span>
                  <h5 className="text-sm font-medium text-zinc-200">Save your credentials</h5>
                </div>

                <div className="ml-9 space-y-3">
                  <p className="text-xs text-zinc-400">
                    Create a credentials file in your config directory:
                  </p>

                  {mounted ? (
                    <Tabs defaultValue="linux" className="w-full">
                      <TabsList className="bg-zinc-800/50 p-0.5 h-8">
                        <TabsTrigger
                          value="linux"
                          className="text-xs px-3 h-7 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
                        >
                          Linux
                        </TabsTrigger>
                        <TabsTrigger
                          value="macos"
                          className="text-xs px-3 h-7 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
                        >
                          macOS
                        </TabsTrigger>
                        <TabsTrigger
                          value="windows"
                          className="text-xs px-3 h-7 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
                        >
                          Windows
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="linux" className="mt-2">
                        <div>
                          <PathDisplay
                            path="~/.config/punt/credentials.json"
                            onCopy={() => showToast.success('Path copied to clipboard')}
                          />
                          <CodeBlock
                            language="json"
                            className="[&>div]:rounded-t-none [&>div]:border-t-0"
                            code={`{
  "servers": {
    "default": {
      "url": "${window.location.origin}${basePath}",
      "apiKey": "YOUR_API_KEY_HERE"
    }
  },
  "activeServer": "default"
}`}
                            onCopy={() => showToast.success('Copied to clipboard')}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="macos" className="mt-2">
                        <div>
                          <PathDisplay
                            path="~/Library/Application Support/punt/credentials.json"
                            onCopy={() => showToast.success('Path copied to clipboard')}
                          />
                          <CodeBlock
                            language="json"
                            className="[&>div]:rounded-t-none [&>div]:border-t-0"
                            code={`{
  "servers": {
    "default": {
      "url": "${window.location.origin}${basePath}",
      "apiKey": "YOUR_API_KEY_HERE"
    }
  },
  "activeServer": "default"
}`}
                            onCopy={() => showToast.success('Copied to clipboard')}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="windows" className="mt-2">
                        <div>
                          <PathDisplay
                            path="%APPDATA%\punt\credentials.json"
                            onCopy={() => showToast.success('Path copied to clipboard')}
                          />
                          <CodeBlock
                            language="json"
                            className="[&>div]:rounded-t-none [&>div]:border-t-0"
                            code={`{
  "servers": {
    "default": {
      "url": "${window.location.origin}${basePath}",
      "apiKey": "YOUR_API_KEY_HERE"
    }
  },
  "activeServer": "default"
}`}
                            onCopy={() => showToast.success('Copied to clipboard')}
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="h-20 rounded-md bg-zinc-800/30 animate-pulse" />
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    3
                  </span>
                  <h5 className="text-sm font-medium text-zinc-200">Restart your MCP client</h5>
                </div>

                <div className="ml-9">
                  <p className="text-xs text-zinc-400">
                    Changes to{' '}
                    <code className="text-amber-400 bg-zinc-800 px-1 rounded">.mcp.json</code>{' '}
                    require a restart. Credentials are hot-reloaded every 5 seconds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
