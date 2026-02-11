/**
 * Parse a ticket key like "PUNT-2" into project key and number
 */
export function parseTicketKey(key: string): { projectKey: string; number: number } | null {
  const match = key.match(/^([A-Z][A-Z0-9]*)-(\d+)$/i)
  if (!match) return null
  return {
    projectKey: match[1].toUpperCase(),
    number: parseInt(match[2], 10),
  }
}

/**
 * Format a date for display (YYYY-MM-DD)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

/**
 * Format a ticket for full detail display (get_ticket).
 * Organized into sections with compact key-value layout.
 */
export function formatTicket(ticket: {
  number: number
  title: string
  description?: string | null
  type: string
  priority: string
  storyPoints?: number | null
  estimate?: string | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  resolution?: string | null
  environment?: string | null
  affectedVersion?: string | null
  fixVersion?: string | null
  column?: { name: string } | null
  sprint?: { name: string; status: string } | null
  assignee?: { name: string; email?: string | null } | null
  creator?: { name: string } | null
  labels?: { name: string; color: string }[]
  createdAt?: Date | string
  updatedAt?: Date | string
  project?: { key: string; name: string }
}): string {
  const projectKey = ticket.project?.key ?? 'UNKNOWN'
  const lines: string[] = []

  lines.push(`## ${projectKey}-${ticket.number}: ${ticket.title}`)
  lines.push('')

  // Core fields
  lines.push(`**Type:** ${ticket.type}  `)
  lines.push(`**Priority:** ${ticket.priority}  `)
  if (ticket.column) lines.push(`**Status:** ${ticket.column.name}  `)
  if (ticket.resolution) lines.push(`**Resolution:** ${ticket.resolution}  `)

  // People
  if (ticket.assignee || ticket.creator) {
    lines.push('')
    if (ticket.assignee) lines.push(`**Assignee:** ${ticket.assignee.name}  `)
    if (ticket.creator) lines.push(`**Reporter:** ${ticket.creator.name}  `)
  }

  // Planning
  const planningFields: string[] = []
  if (ticket.sprint)
    planningFields.push(`**Sprint:** ${ticket.sprint.name} (${ticket.sprint.status})`)
  if (ticket.storyPoints != null) planningFields.push(`**Points:** ${ticket.storyPoints}`)
  if (ticket.estimate) planningFields.push(`**Estimate:** ${ticket.estimate}`)
  if (planningFields.length > 0) {
    lines.push('')
    for (const f of planningFields) lines.push(`${f}  `)
  }

  // Dates
  const dateFields: string[] = []
  if (ticket.startDate) dateFields.push(`**Start:** ${formatDate(ticket.startDate)}`)
  if (ticket.dueDate) dateFields.push(`**Due:** ${formatDate(ticket.dueDate)}`)
  if (dateFields.length > 0) {
    lines.push('')
    for (const f of dateFields) lines.push(`${f}  `)
  }

  // Metadata
  const metaFields: string[] = []
  if (ticket.labels && ticket.labels.length > 0) {
    metaFields.push(`**Labels:** ${ticket.labels.map((l) => l.name).join(', ')}`)
  }
  if (ticket.environment) metaFields.push(`**Environment:** ${ticket.environment}`)
  if (ticket.affectedVersion) metaFields.push(`**Affected Version:** ${ticket.affectedVersion}`)
  if (ticket.fixVersion) metaFields.push(`**Fix Version:** ${ticket.fixVersion}`)
  if (metaFields.length > 0) {
    lines.push('')
    for (const f of metaFields) lines.push(`${f}  `)
  }

  // Description
  if (ticket.description) {
    lines.push('')
    lines.push('**Description:**')
    lines.push(ticket.description)
  }

  return lines.join('\n')
}

/**
 * Format a list of tickets as a markdown table
 */
export function formatTicketList(
  tickets: Array<{
    number: number
    title: string
    type: string
    priority: string
    column?: { name: string } | null
    sprint?: { name: string } | null
    assignee?: { name: string } | null
    storyPoints?: number | null
    project?: { key: string }
  }>,
  projectKey?: string,
): string {
  if (tickets.length === 0) {
    return 'No tickets found.'
  }

  const lines: string[] = []
  lines.push('| Key | Title | Type | Priority | Status | Sprint | Assignee | Points |')
  lines.push('|-----|-------|------|----------|--------|--------|----------|--------|')

  for (const ticket of tickets) {
    const key = `${projectKey ?? ticket.project?.key ?? 'UNKNOWN'}-${ticket.number}`
    const title = ticket.title.length > 50 ? `${ticket.title.substring(0, 47)}...` : ticket.title
    const status = ticket.column?.name ?? '-'
    const sprint = ticket.sprint?.name ?? '-'
    const assignee = ticket.assignee?.name ?? '-'
    const points = ticket.storyPoints ?? '-'

    lines.push(
      `| ${key} | ${title} | ${ticket.type} | ${ticket.priority} | ${status} | ${sprint} | ${assignee} | ${points} |`,
    )
  }

  lines.push('')
  lines.push(`Total: ${tickets.length} ticket(s)`)

  return lines.join('\n')
}

/**
 * Format a project for display
 */
export function formatProject(project: {
  key: string
  name: string
  description?: string | null
  color: string
  columns?: { name: string; order: number }[]
  _count?: { tickets: number; members?: number }
}): string {
  const lines: string[] = []

  lines.push(`# ${project.key}: ${project.name}`)
  lines.push('')

  if (project.description) {
    lines.push(project.description)
    lines.push('')
  }

  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Color | ${project.color} |`)
  if (project._count?.tickets != null) lines.push(`| Tickets | ${project._count.tickets} |`)
  if (project._count?.members != null) lines.push(`| Members | ${project._count.members} |`)

  if (project.columns && project.columns.length > 0) {
    lines.push('')
    lines.push('## Columns')
    lines.push('')
    for (const col of project.columns.sort((a, b) => a.order - b.order)) {
      lines.push(`- ${col.name}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format a list of projects as markdown
 */
export function formatProjectList(
  projects: Array<{
    key: string
    name: string
    description?: string | null
    _count?: { tickets: number }
  }>,
): string {
  if (projects.length === 0) {
    return 'No projects found.'
  }

  const lines: string[] = []
  lines.push('| Key | Name | Description | Tickets |')
  lines.push('|-----|------|-------------|---------|')

  for (const project of projects) {
    const desc = project.description
      ? project.description.length > 40
        ? `${project.description.substring(0, 37)}...`
        : project.description
      : '-'
    const tickets = project._count?.tickets ?? '-'
    lines.push(`| ${project.key} | ${project.name} | ${desc} | ${tickets} |`)
  }

  lines.push('')
  lines.push(`Total: ${projects.length} project(s)`)

  return lines.join('\n')
}

/**
 * Format a sprint for display
 */
export function formatSprint(sprint: {
  name: string
  status: string
  goal?: string | null
  startDate?: Date | null
  endDate?: Date | null
  budget?: number | null
  tickets?: Array<{
    number: number
    title: string
    type: string
    priority: string
    column?: { name: string } | null
    storyPoints?: number | null
  }>
  project?: { key: string }
}): string {
  const lines: string[] = []

  lines.push(`# Sprint: ${sprint.name}`)
  lines.push('')

  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Status | ${sprint.status} |`)
  if (sprint.goal) lines.push(`| Goal | ${sprint.goal} |`)
  if (sprint.startDate) lines.push(`| Start | ${formatDate(sprint.startDate)} |`)
  if (sprint.endDate) lines.push(`| End | ${formatDate(sprint.endDate)} |`)
  if (sprint.budget != null) lines.push(`| Capacity | ${sprint.budget} points |`)

  if (sprint.tickets && sprint.tickets.length > 0) {
    lines.push('')
    lines.push('## Tickets')
    lines.push('')
    lines.push(formatTicketList(sprint.tickets, sprint.project?.key))
  }

  return lines.join('\n')
}

/**
 * Format a list of sprints as markdown
 */
export function formatSprintList(
  sprints: Array<{
    name: string
    status: string
    goal?: string | null
    startDate?: Date | null
    endDate?: Date | null
  }>,
): string {
  if (sprints.length === 0) {
    return 'No sprints found.'
  }

  const lines: string[] = []
  lines.push('| Name | Status | Goal | Start | End |')
  lines.push('|------|--------|------|-------|-----|')

  for (const sprint of sprints) {
    const goal = sprint.goal
      ? sprint.goal.length > 30
        ? `${sprint.goal.substring(0, 27)}...`
        : sprint.goal
      : '-'
    const start = sprint.startDate ? formatDate(sprint.startDate) : '-'
    const end = sprint.endDate ? formatDate(sprint.endDate) : '-'
    lines.push(`| ${sprint.name} | ${sprint.status} | ${goal} | ${start} | ${end} |`)
  }

  lines.push('')
  lines.push(`Total: ${sprints.length} sprint(s)`)

  return lines.join('\n')
}

/**
 * Create a text response for MCP
 */
export function textResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

/**
 * Create an error response for MCP
 */
export function errorResponse(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}
