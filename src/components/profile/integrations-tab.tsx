'use client'

import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { showToast } from '@/lib/toast'

interface IntegrationsTabProps {
  isDemo: boolean
}

type ChatProvider = 'anthropic' | 'claude-cli'

export function IntegrationsTab({ isDemo }: IntegrationsTabProps) {
  const [mcpKeyLoading, setMcpKeyLoading] = useState(false)
  const [mcpHasKey, setMcpHasKey] = useState(false)
  const [mcpKeyHint, setMcpKeyHint] = useState<string | null>(null)
  const [mcpNewKey, setMcpNewKey] = useState<string | null>(null)
  const [mcpKeyVisible, setMcpKeyVisible] = useState(false)
  const [mcpKeyFetched, setMcpKeyFetched] = useState(false)
  const [mcpKeyCopied, setMcpKeyCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Anthropic API key state
  const [anthropicKeyLoading, setAnthropicKeyLoading] = useState(false)
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
  const [sessionLoading, setSessionLoading] = useState(false)

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

  // Fetch chat provider preference
  useEffect(() => {
    if (isDemo || providerFetched) return
    const fetchProvider = async () => {
      try {
        const res = await fetch('/api/me/claude-session')
        if (res.ok) {
          const data = await res.json()
          setChatProvider(data.provider || 'anthropic')
          setHasClaudeSession(data.hasSession)
          setProviderFetched(true)
        }
      } catch {
        // Silently fail
      }
    }
    fetchProvider()
  }, [isDemo, providerFetched])

  const handleGenerateMcpKey = async () => {
    setMcpKeyLoading(true)
    try {
      const res = await fetch('/api/me/mcp-key', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate API key')
      setMcpNewKey(data.apiKey)
      setMcpKeyVisible(true)
      setMcpHasKey(true)
      setMcpKeyHint(data.apiKey.slice(-4))
      showToast.success('MCP API key generated')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to generate API key')
    } finally {
      setMcpKeyLoading(false)
    }
  }

  const handleRevokeMcpKey = async () => {
    setMcpKeyLoading(true)
    try {
      const res = await fetch('/api/me/mcp-key', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to revoke API key')
      setMcpHasKey(false)
      setMcpKeyHint(null)
      setMcpNewKey(null)
      setMcpKeyVisible(false)
      showToast.success('MCP API key revoked')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to revoke API key')
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

  const handleSaveAnthropicKey = async () => {
    if (!anthropicKeyInput.trim()) {
      showToast.error('Please enter an API key')
      return
    }
    if (!anthropicKeyInput.startsWith('sk-ant-')) {
      showToast.error('Invalid key format (should start with sk-ant-)')
      return
    }
    setAnthropicKeyLoading(true)
    try {
      const res = await fetch('/api/me/anthropic-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: anthropicKeyInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save API key')
      setAnthropicHasKey(true)
      setAnthropicKeyHint(data.keyHint)
      setAnthropicKeyInput('')
      setAnthropicKeyVisible(false)
      showToast.success('Anthropic API key saved')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to save API key')
    } finally {
      setAnthropicKeyLoading(false)
    }
  }

  const handleRemoveAnthropicKey = async () => {
    setAnthropicKeyLoading(true)
    try {
      const res = await fetch('/api/me/anthropic-key', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove API key')
      setAnthropicHasKey(false)
      setAnthropicKeyHint(null)
      showToast.success('Anthropic API key removed')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to remove API key')
    } finally {
      setAnthropicKeyLoading(false)
    }
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

  const handleUploadSession = async () => {
    if (!sessionInput.trim()) {
      showToast.error('Please paste your credentials')
      return
    }
    setSessionLoading(true)
    try {
      const res = await fetch('/api/me/claude-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: sessionInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to upload session')
      setHasClaudeSession(true)
      setChatProvider('claude-cli')
      setSessionInput('')
      showToast.success('Claude session configured')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to upload session')
    } finally {
      setSessionLoading(false)
    }
  }

  const handleRemoveSession = async () => {
    setSessionLoading(true)
    try {
      const res = await fetch('/api/me/claude-session', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove session')
      setHasClaudeSession(false)
      setChatProvider('anthropic')
      showToast.success('Claude session removed')
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Failed to remove session')
    } finally {
      setSessionLoading(false)
    }
  }

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
              <Terminal className="h-12 w-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-sm">
                MCP API keys are only available when running the full PUNT application.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              <CardTitle className="text-zinc-100">Claude Chat</CardTitle>
            </div>
            <CardDescription className="text-zinc-500">
              AI chat is not available in demo mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="px-4 py-6 text-center text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <Bot className="h-12 w-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-sm">
                Claude Chat requires an Anthropic API key and is only available when running the
                full PUNT application.
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
            Generate an API key to use with the MCP server for AI-assisted ticket management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mcpHasKey && !mcpNewKey && (
            <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <KeyRound className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-zinc-300">
                Active key ending in{' '}
                <code className="text-amber-400 font-mono">...{mcpKeyHint}</code>
              </p>
            </div>
          )}

          {mcpNewKey && (
            <div className="space-y-3">
              <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400 font-medium mb-1">
                  Save this key now -- it will not be shown again
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    readOnly
                    value={mcpKeyVisible ? mcpNewKey : mcpNewKey.replace(/./g, '\u2022')}
                    className="bg-zinc-900 border-zinc-700 font-mono text-sm pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
                      onClick={() => setMcpKeyVisible(!mcpKeyVisible)}
                    >
                      {mcpKeyVisible ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
                      onClick={handleCopyMcpKey}
                    >
                      {mcpKeyCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 hover:bg-zinc-800 hover:border-amber-500/50"
                  disabled={mcpKeyLoading}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {mcpHasKey ? 'Regenerate Key' : 'Generate Key'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-zinc-100">
                    {mcpHasKey ? 'Regenerate MCP API Key?' : 'Generate MCP API Key?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    {mcpHasKey
                      ? 'This will invalidate your current API key.'
                      : 'A new API key will be generated. Save it securely.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleGenerateMcpKey}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {mcpHasKey ? 'Regenerate' : 'Generate'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {mcpHasKey && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-red-400"
                    disabled={mcpKeyLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke Key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-zinc-100">
                      Revoke MCP API Key?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This will permanently delete your API key.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRevokeMcpKey}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Revoke Key
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-3">
            <p className="font-medium text-zinc-300">How to configure MCP</p>
            <p>Save your credentials to a file in your user config directory:</p>
            <ul className="space-y-1 list-disc list-inside text-zinc-500">
              <li>
                <span className="text-zinc-400">Linux:</span>{' '}
                <code className="text-amber-400">~/.config/punt/credentials.json</code>
              </li>
              <li>
                <span className="text-zinc-400">macOS:</span>{' '}
                <code className="text-amber-400">
                  ~/Library/Application Support/punt/credentials.json
                </code>
              </li>
              <li>
                <span className="text-zinc-400">Windows:</span>{' '}
                <code className="text-amber-400">%APPDATA%\punt\credentials.json</code>
              </li>
            </ul>
            <p className="text-zinc-500">Example file:</p>
            <pre className="bg-zinc-900 rounded p-2 overflow-x-auto text-[11px] text-zinc-300">
              {`{
  "servers": {
    "default": {
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-punt-server.com'}",
      "apiKey": "YOUR_API_KEY_HERE"
    }
  },
  "activeServer": "default"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

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

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-400 hover:text-red-400"
                        disabled={anthropicKeyLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Key
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">
                          Remove Anthropic API Key?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          This will disable Claude Chat until you add a new key.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRemoveAnthropicKey}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Remove Key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                      onClick={handleSaveAnthropicKey}
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

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-400 hover:text-red-400"
                        disabled={sessionLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Session
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">
                          Remove Claude Session?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          This will switch back to Anthropic API and remove your stored credentials.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRemoveSession}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Remove Session
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                      onClick={handleUploadSession}
                      disabled={sessionLoading || !sessionInput.trim()}
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
    </div>
  )
}
