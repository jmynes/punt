'use client'

import { Check, Copy, Eye, EyeOff, FileText, KeyRound, Terminal, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/ui/code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { showToast } from '@/lib/toast'
import { ReauthDialog } from './reauth-dialog'

interface MCPTabProps {
  isDemo: boolean
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

export function MCPTab({ isDemo }: MCPTabProps) {
  const [mcpKeyLoading, setMcpKeyLoading] = useState(false)
  const [mcpHasKey, setMcpHasKey] = useState(false)
  const [mcpKeyHint, setMcpKeyHint] = useState<string | null>(null)
  const [mcpNewKey, setMcpNewKey] = useState<string | null>(null)
  const [mcpKeyVisible, setMcpKeyVisible] = useState(false)
  const [mcpKeyFetched, setMcpKeyFetched] = useState(false)
  const [mcpKeyCopied, setMcpKeyCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reauth dialog state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (isDemo || mcpKeyFetched) return
    const fetchMcpKeyStatus = async () => {
      try {
        const res = await fetch('/api/me/mcp-key')
        if (res.ok) {
          const data = await res.json()
          setMcpHasKey(data.hasKey)
          setMcpKeyHint(data.keyHint)
          setMcpKeyFetched(true)
        }
      } catch {
        // Silently fail
      }
    }
    fetchMcpKeyStatus()
  }, [isDemo, mcpKeyFetched])

  const handleGenerateMcpKey = async (
    password?: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    setMcpKeyLoading(true)
    try {
      const res = await fetch('/api/me/mcp-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, totpCode, isRecoveryCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Check if 2FA is required
        if (data.requires2fa) {
          throw new Error('2FA code required')
        }
        throw new Error(data.error || 'Failed to generate API key')
      }
      setMcpNewKey(data.apiKey)
      setMcpKeyVisible(true)
      setMcpHasKey(true)
      setMcpKeyHint(data.apiKey.slice(-4))
      showToast.success('MCP API key generated')
    } finally {
      setMcpKeyLoading(false)
    }
  }

  const handleRevokeMcpKey = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    setMcpKeyLoading(true)
    try {
      const res = await fetch('/api/me/mcp-key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, totpCode, isRecoveryCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Check if 2FA is required
        if (data.requires2fa) {
          throw new Error('2FA code required')
        }
        throw new Error(data.error || 'Failed to revoke API key')
      }
      setMcpHasKey(false)
      setMcpKeyHint(null)
      setMcpNewKey(null)
      setMcpKeyVisible(false)
      showToast.success('MCP API key revoked')
    } finally {
      setMcpKeyLoading(false)
    }
  }

  const handleCopyMcpKey = useCallback(async () => {
    if (!mcpNewKey) return
    try {
      await navigator.clipboard.writeText(mcpNewKey)
      setMcpKeyCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setMcpKeyCopied(false), 2000)
      showToast.success('API key copied to clipboard')
    } catch {
      showToast.error('Failed to copy to clipboard')
    }
  }, [mcpNewKey])

  if (isDemo) {
    return (
      <div className="space-y-6">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-zinc-100">MCP API Key</CardTitle>
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

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-zinc-100">MCP API Key</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Generate an API key to connect Claude Code to PUNT via MCP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mcpHasKey ? (
            <>
              {mcpNewKey ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <KeyRound className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      Copy this key now. It won't be shown again.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg font-mono text-sm">
                    <code className="flex-1 truncate text-zinc-200 select-all">
                      {mcpKeyVisible ? mcpNewKey : '•'.repeat(40)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                      onClick={() => setMcpKeyVisible(!mcpKeyVisible)}
                    >
                      {mcpKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                      onClick={handleCopyMcpKey}
                    >
                      {mcpKeyCopied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                  <KeyRound className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-sm text-zinc-300">
                    Active key ending in{' '}
                    <code className="text-amber-400 font-mono">...{mcpKeyHint}</code>
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mcpKeyLoading}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => setShowRegenerateDialog(true)}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Regenerate Key
                </Button>
                <ReauthDialog
                  open={showRegenerateDialog}
                  onOpenChange={setShowRegenerateDialog}
                  title="Regenerate MCP API Key?"
                  description="This will immediately invalidate the current API key. Any MCP clients using this key will stop working. You will need to update your credentials file with the new key."
                  actionLabel="Regenerate Key"
                  onConfirm={handleGenerateMcpKey}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-red-400"
                  disabled={mcpKeyLoading}
                  onClick={() => setShowRevokeDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revoke Key
                </Button>
                <ReauthDialog
                  open={showRevokeDialog}
                  onOpenChange={setShowRevokeDialog}
                  title="Revoke MCP API Key?"
                  description="This will immediately invalidate the current API key. Any MCP clients using this key will stop working."
                  actionLabel="Revoke Key"
                  actionVariant="destructive"
                  onConfirm={handleRevokeMcpKey}
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Generate an API key to authenticate MCP requests from Claude Code.
              </p>
              <Button
                onClick={() => setShowGenerateDialog(true)}
                disabled={mcpKeyLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Generate API Key
              </Button>
              <ReauthDialog
                open={showGenerateDialog}
                onOpenChange={setShowGenerateDialog}
                title="Generate MCP API Key"
                description="Enter your password to generate a new API key for MCP access."
                actionLabel="Generate Key"
                onConfirm={handleGenerateMcpKey}
              />
            </div>
          )}
        </CardContent>
      </Card>

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
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-punt-server.com'}",
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
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-punt-server.com'}",
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
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-punt-server.com'}",
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
