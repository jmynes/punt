/**
 * Slash commands for the chat panel
 */

export interface SlashCommand {
  name: string
  description: string
  icon?: string
  requiresArg?: boolean
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'new',
    description: 'Start a new conversation',
  },
  {
    name: 'clear',
    description: 'Clear current conversation',
  },
  {
    name: 'rename',
    description: 'Rename current conversation',
    requiresArg: true,
  },
  {
    name: 'delete',
    description: 'Delete current conversation',
  },
  {
    name: 'help',
    description: 'Show available commands',
  },
]

export interface ParsedCommand {
  isCommand: boolean
  command?: SlashCommand
  args?: string
  partial?: string // For autocomplete: the partial command being typed
}

/**
 * Parse input to check for slash command
 */
export function parseSlashCommand(input: string): ParsedCommand {
  if (!input.startsWith('/')) {
    return { isCommand: false }
  }

  const trimmed = input.slice(1).trim()
  const [cmdName, ...argParts] = trimmed.split(' ')
  const args = argParts.join(' ').trim()

  // Find exact match
  const command = SLASH_COMMANDS.find((c) => c.name === cmdName.toLowerCase())

  if (command) {
    return {
      isCommand: true,
      command,
      args: args || undefined,
    }
  }

  // Check if user is typing a command (partial match)
  if (cmdName && !args) {
    return {
      isCommand: true,
      partial: cmdName.toLowerCase(),
    }
  }

  return { isCommand: true }
}

/**
 * Filter commands by partial match
 */
export function filterCommands(partial: string): SlashCommand[] {
  if (!partial) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(partial.toLowerCase()))
}

/**
 * Generate help text for commands
 */
export function getHelpText(): string {
  const lines = ['**Available commands:**', '']
  for (const cmd of SLASH_COMMANDS) {
    const arg = cmd.requiresArg ? ' <name>' : ''
    lines.push(`\`/${cmd.name}${arg}\` - ${cmd.description}`)
  }
  return lines.join('\n')
}
