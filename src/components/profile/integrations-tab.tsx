'use client'

import { Bot, Check, Copy, Eye, EyeOff, KeyRound, Terminal, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
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

interface IntegrationsTabProps {
  isDemo: boolean
}

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
      toast.success('MCP API key generated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate API key')
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
      toast.success('MCP API key revoked')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke API key')
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
      toast.success('API key copied to clipboard')
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [mcpNewKey])

  const handleSaveAnthropicKey = async () => {
    if (!anthropicKeyInput.trim()) {
      toast.error('Please enter an API key')
      return
    }
    if (!anthropicKeyInput.startsWith('sk-ant-')) {
      toast.error('Invalid key format (should start with sk-ant-)')
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
      toast.success('Anthropic API key saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save API key')
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
      toast.success('Anthropic API key removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove API key')
    } finally {
      setAnthropicKeyLoading(false)
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

          <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-2">
            <p className="font-medium text-zinc-300">How to configure MCP</p>
            <p>
              Add the key to your <code className="text-amber-400">.mcp.json</code> file in the
              project root.
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
            Add your Anthropic API key to enable the embedded Claude chat for conversational ticket
            management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-2">
            <p className="font-medium text-zinc-300">About Claude Chat</p>
            <p>
              Open the chat panel with{' '}
              <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">Cmd+I</kbd> or the
              floating button. Claude can create tickets, manage sprints, and more.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
