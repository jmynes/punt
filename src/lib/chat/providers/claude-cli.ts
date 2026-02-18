/**
 * Claude Code CLI chat provider (Experimental)
 * Spawns Claude CLI with sandboxing to use user's Max subscription
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type ClaudeCredentials,
  decryptSession,
  validateSessionCredentials,
} from '@/lib/chat/encryption'
import { db } from '@/lib/db'
import type { ChatProvider, ChatProviderParams, StreamEvent } from './types'

// Tools to disable for security
const DISALLOWED_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'Read',
  'Glob',
  'Grep',
  'LS',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
  'NotebookRead',
  'Task',
  'MultiEdit',
  'TodoWrite',
  'EnterPlanMode',
  'ExitPlanMode',
  'AskUserQuestion',
].join(',')

// Maximum agentic turns before stopping
const MAX_TURNS = 20

// Timeout in milliseconds (3 minutes to allow for MCP server startup)
const TIMEOUT_MS = 180000

interface StreamJsonEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'system' | 'assistant' | 'result'
  subtype?: string
  text?: string
  // For assistant messages
  message?: {
    content?: Array<{
      type: string
      text?: string
      name?: string
      input?: unknown
    }>
  }
  // For result events
  num_turns?: number
  tool?: {
    name: string
    input?: Record<string, unknown>
  }
  result?: string
  success?: boolean
  error?: string
}

export class ClaudeCliProvider implements ChatProvider {
  readonly id = 'claude-cli' as const
  readonly name = 'Claude CLI (Experimental)'
  readonly experimental = true

  async isConfigured(userId: string): Promise<boolean> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { claudeSessionEncrypted: true },
    })
    return !!user?.claudeSessionEncrypted
  }

  async sendMessage(params: ChatProviderParams): Promise<void> {
    const { messages, userId, systemPrompt, onEvent } = params

    // Get user's encrypted session and MCP key
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { claudeSessionEncrypted: true, mcpApiKeyEncrypted: true },
    })

    if (!user?.claudeSessionEncrypted) {
      onEvent({
        type: 'error',
        error: 'No Claude session configured. Upload your credentials in Profile > Integrations.',
      })
      return
    }

    // Decrypt session credentials
    let credentials: unknown
    try {
      const decrypted = decryptSession(user.claudeSessionEncrypted)
      credentials = JSON.parse(decrypted)
    } catch {
      onEvent({
        type: 'error',
        error: 'Failed to decrypt session credentials. Please re-upload your credentials.',
      })
      return
    }

    if (!validateSessionCredentials(credentials)) {
      onEvent({
        type: 'error',
        error: 'Invalid session credentials format. Please re-upload your credentials.',
      })
      return
    }

    // Decrypt MCP API key if available (for PUNT MCP server access)
    let mcpApiKey: string | null = null
    if (user.mcpApiKeyEncrypted) {
      try {
        mcpApiKey = decryptSession(user.mcpApiKeyEncrypted)
      } catch {
        // MCP key decryption failed - chat will work but without PUNT tools
        console.warn('[Claude CLI] Failed to decrypt MCP API key')
      }
    }

    // Create temporary directory for this session
    const sessionId = randomUUID()
    const tempDir = join(tmpdir(), `punt-chat-${sessionId}`)

    try {
      await this.runClaude({
        tempDir,
        credentials,
        messages,
        systemPrompt,
        mcpApiKey,
        onEvent,
      })
    } finally {
      // Clean up temp directory
      try {
        await rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async runClaude(params: {
    tempDir: string
    credentials: ClaudeCredentials
    messages: Array<{ role: string; content: string }>
    systemPrompt: string
    mcpApiKey: string | null
    onEvent: (event: StreamEvent) => void
  }): Promise<void> {
    const { tempDir, credentials, messages, systemPrompt, mcpApiKey, onEvent } = params

    // Set up temp directory with credentials (restrictive permissions for security)
    const claudeDir = join(tempDir, '.claude')
    await mkdir(claudeDir, { recursive: true, mode: 0o700 })

    // Write credentials file (note: Claude CLI uses .credentials.json with leading dot)
    // Use restrictive permissions (owner read/write only) since this contains auth tokens
    const credentialsPath = join(claudeDir, '.credentials.json')
    await writeFile(credentialsPath, JSON.stringify(credentials), { mode: 0o600 })

    // Write MCP config (PUNT server only)
    const mcpConfig = {
      mcpServers: mcpApiKey
        ? {
            punt: {
              type: 'stdio',
              command: 'pnpm',
              args: ['--dir', join(process.cwd(), 'mcp'), 'exec', 'tsx', 'src/index.ts'],
              env: {
                MCP_API_KEY: mcpApiKey,
                PUNT_API_URL: process.env.PUNT_API_URL || 'http://localhost:3000',
              },
            },
          }
        : {},
    }
    // Write MCP config with restrictive permissions (contains API key)
    const mcpConfigPath = join(tempDir, '.mcp.json')
    await writeFile(mcpConfigPath, JSON.stringify(mcpConfig), { mode: 0o600 })

    // Build the prompt with system context and conversation history
    const fullPrompt = this.buildPrompt(messages, systemPrompt)

    // Spawn Claude CLI with restrictions
    const claudeConfigDir = join(tempDir, '.claude')

    const proc = spawn(
      'claude',
      [
        '-p',
        fullPrompt,
        '--output-format',
        'stream-json',
        '--verbose', // Required for stream-json with --print
        '--disallowedTools',
        DISALLOWED_TOOLS,
        '--mcp-config',
        mcpConfigPath, // Absolute path to MCP config
        '--strict-mcp-config',
        '--max-turns',
        String(MAX_TURNS),
        '--dangerously-skip-permissions', // Safe because tools are disabled
      ],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: claudeConfigDir,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )

    // Close stdin to signal no more input (required for Claude CLI to proceed)
    proc.stdin?.end()

    // Handle process with timeout
    await this.processOutput(proc, onEvent)
  }

  private buildPrompt(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
  ): string {
    // Build a combined prompt from conversation history
    let prompt = `System context:\n${systemPrompt}\n\n`

    // Add conversation history
    if (messages.length > 1) {
      prompt += 'Previous conversation:\n'
      for (const msg of messages.slice(0, -1)) {
        const role = msg.role === 'user' ? 'User' : 'Assistant'
        prompt += `${role}: ${msg.content}\n`
      }
      prompt += '\n'
    }

    // Add the current user message
    const lastMessage = messages[messages.length - 1]
    if (lastMessage) {
      prompt += `Current request: ${lastMessage.content}`
    }

    return prompt
  }

  private processOutput(proc: ChildProcess, onEvent: (event: StreamEvent) => void): Promise<void> {
    return new Promise((resolve) => {
      let buffer = ''
      let timeoutHandle: NodeJS.Timeout

      // Set up timeout
      timeoutHandle = setTimeout(() => {
        proc.kill('SIGKILL')
        onEvent({ type: 'error', error: 'Request timed out after 3 minutes' })
        resolve()
      }, TIMEOUT_MS)

      // Handle stdout (streaming JSON)
      if (proc.stdout) {
        proc.stdout.setEncoding('utf8')
      }

      proc.stdout?.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString()
        buffer += chunkStr

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const event = JSON.parse(line) as StreamJsonEvent
            this.handleStreamEvent(event, onEvent)
          } catch {
            // Non-JSON line, ignore
          }
        }
      })

      // Handle stderr (errors/warnings)
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim()
        // Only surface meaningful errors to the user
        if (text && !text.includes('[DEBUG]')) {
          console.error('[Claude CLI stderr]:', text)
        }
      })

      // Handle process exit
      proc.on('close', (code) => {
        clearTimeout(timeoutHandle)

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer) as StreamJsonEvent
            this.handleStreamEvent(event, onEvent)
          } catch {
            // Ignore
          }
        }

        if (code !== 0 && code !== null) {
          onEvent({ type: 'error', error: `Claude CLI exited with code ${code}` })
        }

        onEvent({ type: 'done' })
        resolve()
      })

      proc.on('error', (err) => {
        clearTimeout(timeoutHandle)
        onEvent({ type: 'error', error: `Failed to start Claude CLI: ${err.message}` })
        resolve()
      })
    })
  }

  private handleStreamEvent(event: StreamJsonEvent, onEvent: (event: StreamEvent) => void): void {
    switch (event.type) {
      case 'system':
        // Initialization event - ignore
        break

      case 'assistant':
        // Extract text from assistant message content
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              onEvent({ type: 'text', content: block.text })
            } else if (block.type === 'tool_use') {
              onEvent({
                type: 'tool_start',
                name: block.name,
                input: block.input as Record<string, unknown> | undefined,
              })
            }
          }
        }
        break

      case 'result':
        // Final result - ignore
        break

      case 'text':
        if (event.text) {
          onEvent({ type: 'text', content: event.text })
        }
        break

      case 'tool_use':
        if (event.tool) {
          onEvent({
            type: 'tool_start',
            name: event.tool.name,
            input: event.tool.input,
          })
        }
        break

      case 'tool_result':
        if (event.tool) {
          onEvent({
            type: 'tool_end',
            name: event.tool.name,
            result: event.result,
            success: event.success ?? true,
          })
        }
        break

      case 'error':
        onEvent({ type: 'error', error: event.error || 'Unknown error' })
        break

      case 'done':
        // Will be sent by processOutput
        break
    }
  }
}
