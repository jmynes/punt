'use client'

import {
  AlertTriangle,
  Bot,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Plug,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ReauthDialog } from '@/components/profile/reauth-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { showToast } from '@/lib/toast'

interface ClaudeChatTabProps {
  isDemo: boolean
}

type ChatProvider = 'anthropic' | 'claude-cli'

export function ClaudeChatTab({ isDemo }: ClaudeChatTabProps) {
  // Anthropic API key state
  const [anthropicKeyLoading] = useState(false)
  const [anthropicHasKey, setAnthropicHasKey] = useState(false)
  const [anthropicKeyHint, setAnthropicKeyHint] = useState<string | null>(null)
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('')
  const [anthropicKeyVisible, setAnthropicKeyVisible] = useState(false)
  const [anthropicKeyFetched, setAnthropicKeyFetched] = useState(false)

  // Chat provider state
  const [chatProvider, setChatProvider] = useState<ChatProvider>('anthropic')
  const [providerFetched, setProviderFetched] = useState(false)
  const [providerLoading, setProviderLoading] = useState(false)

  // Claude CLI session state
  const [hasClaudeSession, setHasClaudeSession] = useState(false)
  const [sessionInput, setSessionInput] = useState('')
  // ReauthDialog state
  const [showSaveKeyReauth, setShowSaveKeyReauth] = useState(false)
  const [showRemoveKeyReauth, setShowRemoveKeyReauth] = useState(false)
  const [showUploadSessionReauth, setShowUploadSessionReauth] = useState(false)
  const [showRemoveSessionReauth, setShowRemoveSessionReauth] = useState(false)

  // MCP servers state
  const [availableMcpServers, setAvailableMcpServers] = useState<string[]>([])
  const [enabledMcpServers, setEnabledMcpServers] = useState<string[]>([])
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isDemo || anthropicKeyFetched) return
    const fetchAnthropicKeyStatus = async () => {
      try {
        const res = await fetch('/api/me/anthropic-key')
        if (res.ok) {
          const data = await res.json()
          setAnthropicHasKey(data.hasKey)
          setAnthropicKeyHint(data.keyHint)
          setAnthropicKeyFetched(true)
        }
      } catch {
        // Silently fail
      }
    }
    fetchAnthropicKeyStatus()
  }, [isDemo, anthropicKeyFetched])

  // Fetch chat provider preference and MCP servers
  useEffect(() => {
    if (isDemo || providerFetched) return
    const fetchProvider = async () => {
      try {
        const res = await fetch('/api/me/claude-session')
        if (res.ok) {
          const data = await res.json()
          setChatProvider(data.provider || 'anthropic')
          setHasClaudeSession(data.hasSession)
          setAvailableMcpServers(data.availableMcpServers || [])
          setEnabledMcpServers(data.enabledMcpServers || [])
          setProviderFetched(true)
        }
      } catch {
        // Silently fail
      }
    }
    fetchProvider()
  }, [isDemo, providerFetched])

  const handleSaveAnthropicKey = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    const res = await fetch('/api/me/anthropic-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: anthropicKeyInput, password, totpCode, isRecoveryCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save API key')
    setAnthropicHasKey(true)
    setAnthropicKeyHint(data.keyHint)
    setAnthropicKeyInput('')
    setAnthropicKeyVisible(false)
    showToast.success('Anthropic API key saved')
  }

  const handleRemoveAnthropicKey = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    const res = await fetch('/api/me/anthropic-key', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, totpCode, isRecoveryCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to remove API key')
    setAnthropicHasKey(false)
    setAnthropicKeyHint(null)
    showToast.success('Anthropic API key removed')
  }

  const handleProviderChange = async (value: ChatProvider) => {
    // When switching to claude-cli, just update local state to show the upload form
    // The actual provider is set when credentials are uploaded (POST) or if already has session
    if (value === 'claude-cli') {
      if (hasClaudeSession) {
        // Already has session, update provider on server
        setProviderLoading(true)
        try {
          const res = await fetch('/api/me/claude-session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: value }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Failed to update provider')
          setChatProvider(value)
          showToast.success('Chat provider set to Claude CLI')
        } catch (error) {
          showToast.error(error instanceof Error ? error.message : 'Failed to update provider')
        } finally {
          setProviderLoading(false)
        }
      } else {
        // No session yet - just show the upload form (local state only)
        setChatProvider(value)
      }
      return
    }

    // Switching to anthropic - always update server
    setProviderLoading(true)
    try {
      const res = await fetch('/api/me/claude-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update provider')
      setChatProvider(value)
      showToast.success('Chat provider set to Anthropic API')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to update provider')
    } finally {
      setProviderLoading(false)
    }
  }

  const handleUploadSession = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    const res = await fetch('/api/me/claude-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: sessionInput, password, totpCode, isRecoveryCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to upload session')
    setHasClaudeSession(true)
    setChatProvider('claude-cli')
    setSessionInput('')
    setAvailableMcpServers(data.availableMcpServers || [])
    setEnabledMcpServers(data.enabledMcpServers || [])
    showToast.success('Claude session configured')
  }

  const handleRemoveSession = async (
    password: string,
    totpCode?: string,
    isRecoveryCode?: boolean,
  ) => {
    const res = await fetch('/api/me/claude-session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, totpCode, isRecoveryCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to remove session')
    setHasClaudeSession(false)
    setChatProvider('anthropic')
    setAvailableMcpServers([])
    setEnabledMcpServers([])
    showToast.success('Claude session removed')
  }

  const handleToggleMcpServer = useCallback(
    async (serverName: string, enabled: boolean) => {
      setPendingToggles((prev) => new Set(prev).add(serverName))
      try {
        const newEnabled = enabled
          ? [...enabledMcpServers, serverName]
          : enabledMcpServers.filter((s) => s !== serverName)

        const res = await fetch('/api/me/claude-session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledMcpServers: newEnabled }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update MCP servers')

        setEnabledMcpServers(newEnabled)
        showToast.success(`${serverName} ${enabled ? 'enabled' : 'disabled'}`)
      } catch (error) {
        showToast.error(error instanceof Error ? error.message : 'Failed to update MCP servers')
      } finally {
        setPendingToggles((prev) => {
          const next = new Set(prev)
          next.delete(serverName)
          return next
        })
      }
    },
    [enabledMcpServers],
  )

  if (isDemo) {
    return (
      <div className="space-y-6">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              <CardTitle className="text-zinc-100">Claude Chat</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              Chat configuration is not available in demo mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="px-4 py-6 text-center text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <p className="text-sm">Sign in to a real PUNT instance to configure Claude Chat.</p>
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
            <Bot className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-zinc-100">Claude Chat</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Configure how Claude Chat connects to Claude for conversational ticket management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-zinc-300">Chat Provider</Label>
            <RadioGroup
              value={chatProvider}
              onValueChange={(value) => handleProviderChange(value as ChatProvider)}
              disabled={providerLoading}
              className="space-y-3"
            >
              <label
                htmlFor="anthropic"
                className="flex items-start space-x-3 p-3 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <RadioGroupItem value="anthropic" id="anthropic" className="mt-0.5" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-zinc-200">Anthropic API</span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Use your own Anthropic API key (pay-per-use)
                  </p>
                </div>
                {anthropicHasKey && (
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                    Configured
                  </span>
                )}
              </label>

              <label
                htmlFor="claude-cli"
                className="flex items-start space-x-3 p-3 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <RadioGroupItem value="claude-cli" id="claude-cli" className="mt-0.5" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                    Claude CLI
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                      Experimental
                    </span>
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Use your Claude Max subscription (requires session upload)
                  </p>
                </div>
                {hasClaudeSession && (
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                    Configured
                  </span>
                )}
              </label>
            </RadioGroup>
          </div>

          {/* Anthropic API Key Section */}
          {chatProvider === 'anthropic' && (
            <div className="space-y-4 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium text-zinc-300">Anthropic API Key</span>
              </div>

              {anthropicHasKey ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                    <KeyRound className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-sm text-zinc-300">
                      Active key ending in{' '}
                      <code className="text-violet-400 font-mono">...{anthropicKeyHint}</code>
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-red-400"
                    disabled={anthropicKeyLoading}
                    onClick={() => setShowRemoveKeyReauth(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Key
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type={anthropicKeyVisible ? 'text' : 'password'}
                        value={anthropicKeyInput}
                        onChange={(e) => setAnthropicKeyInput(e.target.value)}
                        placeholder="sk-ant-..."
                        className="bg-zinc-900 border-zinc-700 font-mono text-sm pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
                        onClick={() => setAnthropicKeyVisible(!anthropicKeyVisible)}
                      >
                        {anthropicKeyVisible ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <Button
                      onClick={() => {
                        if (!anthropicKeyInput.trim()) {
                          showToast.error('Please enter an API key')
                          return
                        }
                        if (!anthropicKeyInput.startsWith('sk-ant-')) {
                          showToast.error('Invalid key format (should start with sk-ant-)')
                          return
                        }
                        setShowSaveKeyReauth(true)
                      }}
                      disabled={anthropicKeyLoading || !anthropicKeyInput.trim()}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      Save Key
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Get your API key from{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Claude CLI Session Section */}
          {chatProvider === 'claude-cli' && (
            <div className="space-y-4 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-zinc-300">
                  Claude Session Credentials
                </span>
              </div>

              {/* Experimental Warning */}
              <div className="flex items-start gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-400">
                  <p className="font-medium">Experimental Feature</p>
                  <p className="text-amber-400/80 mt-0.5">
                    This uses your Claude session tokens which may be revoked by Anthropic at any
                    time. Your credentials are encrypted and stored securely.
                  </p>
                </div>
              </div>

              {hasClaudeSession ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-sm text-zinc-300">Session credentials configured</p>
                  </div>

                  {/* Enabled MCP Servers Section */}
                  {availableMcpServers.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Plug className="h-4 w-4 text-cyan-500" />
                        <span className="text-sm font-medium text-zinc-300">
                          External MCP Servers
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Your credentials include OAuth tokens for the following MCP servers. Enable
                        the ones you want available during Claude Chat sessions.
                      </p>
                      <div className="space-y-2">
                        {availableMcpServers.map((serverName) => {
                          const isEnabled = enabledMcpServers.includes(serverName)
                          return (
                            <label
                              key={serverName}
                              htmlFor={`mcp-server-${serverName}`}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                            >
                              <Checkbox
                                id={`mcp-server-${serverName}`}
                                checked={isEnabled}
                                onCheckedChange={(checked) =>
                                  handleToggleMcpServer(serverName, checked === true)
                                }
                                disabled={pendingToggles.has(serverName)}
                                className="border-zinc-600 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-zinc-200 font-mono">
                                  {serverName}
                                </span>
                              </div>
                              {isEnabled && (
                                <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded shrink-0">
                                  Enabled
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-700/50 bg-zinc-800/20">
                        <Plug className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs text-zinc-400">
                          <span className="font-mono text-amber-400">punt</span> — always enabled
                          (built-in)
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-red-400"
                    onClick={() => setShowRemoveSessionReauth(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Session
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    value={sessionInput}
                    onChange={(e) => setSessionInput(e.target.value)}
                    placeholder="Paste the contents of ~/.claude/.credentials.json here..."
                    className="bg-zinc-900 border-zinc-700 font-mono text-xs min-h-[100px]"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        if (!sessionInput.trim()) {
                          showToast.error('Please paste your credentials')
                          return
                        }
                        setShowUploadSessionReauth(true)
                      }}
                      disabled={!sessionInput.trim()}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Session
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Find your credentials at{' '}
                    <code className="text-amber-400">~/.claude/.credentials.json</code>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-2">
            <p className="font-medium text-zinc-300">About Claude Chat</p>
            <p>
              Open the chat panel with{' '}
              <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">Ctrl/Cmd+I</kbd> or
              the floating button. Claude can create tickets, manage sprints, and more.
            </p>
          </div>
        </CardContent>
      </Card>

      <ReauthDialog
        open={showSaveKeyReauth}
        onOpenChange={setShowSaveKeyReauth}
        title="Save Anthropic API Key"
        description="Enter your credentials to save your API key."
        actionLabel="Save Key"
        onConfirm={handleSaveAnthropicKey}
      />

      <ReauthDialog
        open={showRemoveKeyReauth}
        onOpenChange={setShowRemoveKeyReauth}
        title="Remove Anthropic API Key?"
        description="This will disable Claude Chat until you add a new key."
        actionLabel="Remove Key"
        actionVariant="destructive"
        onConfirm={handleRemoveAnthropicKey}
      />

      <ReauthDialog
        open={showUploadSessionReauth}
        onOpenChange={setShowUploadSessionReauth}
        title="Upload Claude Session"
        description="Enter your credentials to upload your session."
        actionLabel="Upload Session"
        onConfirm={handleUploadSession}
      />

      <ReauthDialog
        open={showRemoveSessionReauth}
        onOpenChange={setShowRemoveSessionReauth}
        title="Remove Claude Session?"
        description="This will switch back to Anthropic API and remove your stored credentials."
        actionLabel="Remove Session"
        actionVariant="destructive"
        onConfirm={handleRemoveSession}
      />
    </div>
  )
}
