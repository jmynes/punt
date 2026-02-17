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

// Timeout in milliseconds
const TIMEOUT_MS = 60000

interface StreamJsonEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'system'
  text?: string
  tool?: {
    name: string
    input?: Record<string, unknown>
  }
  result?: string
  success?: boolean
  error?: string
  message?: string
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

    // Get user's encrypted session
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { claudeSessionEncrypted: true, mcpApiKey: true },
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

    // Create temporary directory for this session
    const sessionId = randomUUID()
    const tempDir = join(tmpdir(), `punt-chat-${sessionId}`)

    try {
      await this.runClaude({
        tempDir,
        credentials,
        messages,
        systemPrompt,
        mcpApiKey: user.mcpApiKey,
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

    // Set up temp directory with credentials
    const claudeDir = join(tempDir, '.claude')
    await mkdir(claudeDir, { recursive: true })

    // Write credentials file (note: Claude CLI uses .credentials.json with leading dot)
    const credentialsPath = join(claudeDir, '.credentials.json')
    await writeFile(credentialsPath, JSON.stringify(credentials))
    console.log('[Claude CLI] Wrote credentials to:', credentialsPath)

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
                MCP_BASE_URL: process.env.MCP_BASE_URL || 'http://localhost:3000',
              },
            },
          }
        : {},
    }
    await writeFile(join(tempDir, '.mcp.json'), JSON.stringify(mcpConfig))

    // Build the prompt with system context and conversation history
    const fullPrompt = this.buildPrompt(messages, systemPrompt)

    // Spawn Claude CLI with restrictions
    const claudeConfigDir = join(tempDir, '.claude')
    console.log('[Claude CLI] Spawning with tempDir:', tempDir)
    console.log('[Claude CLI] CLAUDE_CONFIG_DIR:', claudeConfigDir)
    console.log('[Claude CLI] Prompt length:', fullPrompt.length)

    const proc = spawn(
      'claude',
      [
        '-p',
        fullPrompt,
        '--output-format',
        'stream-json',
        '--disallowedTools',
        DISALLOWED_TOOLS,
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

    console.log('[Claude CLI] Process spawned, PID:', proc.pid)
    console.log(
      '[Claude CLI] Full command: claude',
      [
        '-p',
        `"${fullPrompt.substring(0, 50)}..."`,
        '--output-format',
        'stream-json',
        '--disallowedTools',
        DISALLOWED_TOOLS,
        '--strict-mcp-config',
        '--max-turns',
        String(MAX_TURNS),
        '--dangerously-skip-permissions',
      ].join(' '),
    )

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
        onEvent({ type: 'error', error: 'Request timed out after 60 seconds' })
        resolve()
      }, TIMEOUT_MS)

      // Handle stdout (streaming JSON)
      proc.stdout?.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString()
        console.log('[Claude CLI stdout] Received chunk:', chunkStr.substring(0, 200))
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
            // Non-JSON line, log it
            console.log('[Claude CLI stdout] Non-JSON line:', line)
          }
        }
      })

      // Handle stderr (errors/warnings)
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        console.error('[Claude CLI stderr]:', text)
        // Surface any stderr output to help debug
        onEvent({ type: 'text', content: `[stderr] ${text.trim()}\n` })
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
        onEvent({ type: 'error', error: event.error || event.message || 'Unknown error' })
        break

      case 'done':
        // Will be sent by processOutput
        break
    }
  }
}
