/**
 * Tool executor for Claude Chat
 * Executes tool calls against PUNT's internal API
 */

import { db } from '@/lib/db'
import type { ChatToolName } from './tools'

// biome-ignore lint/suspicious/noExplicitAny: dynamic AI model input
type ToolInput = Record<string, any>

interface ToolResult {
  success: boolean
  result: string
}

/**
 * Execute a tool call and return the result
 */
export async function executeTool(
  toolName: ChatToolName,
  input: ToolInput,
  userId: string,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'list_tickets':
        return await listTickets(input, userId)
      case 'get_ticket':
        return await getTicket(input, userId)
      case 'create_ticket':
        return await createTicket(input, userId)
      case 'update_ticket':
        return await updateTicket(input, userId)
      case 'list_projects':
        return await listProjects(userId)
      case 'get_project':
        return await getProject(input, userId)
      case 'list_sprints':
        return await listSprints(input, userId)
      case 'list_labels':
        return await listLabels(input, userId)
      default:
        return { success: false, result: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    return {
      success: false,
      result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function listTickets(input: ToolInput, userId: string): Promise<ToolResult> {
  const {
    projectKey,
    column,
    type,
    priority,
    assignee,
    sprint,
    resolution,
    search,
    limit = 20,
  } = input

  // Verify user has access to project
  const project = await db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      members: { some: { userId } },
    },
  })

  if (!project) {
    return { success: false, result: `Project ${projectKey} not found or access denied` }
  }

  // Build where clause
  // biome-ignore lint/suspicious/noExplicitAny: dynamic Prisma where clause
  const where: any = { projectId: project.id }

  if (type) where.type = type
  if (priority) where.priority = priority
  if (resolution === 'resolved') {
    where.resolution = { not: null }
  } else if (resolution === 'unresolved') {
    where.resolution = null
  } else if (resolution) {
    where.resolution = resolution
  }

  let tickets = await db.ticket.findMany({
    where,
    include: {
      column: { select: { name: true } },
      assignee: { select: { name: true } },
      sprint: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Apply case-insensitive filters in memory
  if (column) {
    const columnLower = column.toLowerCase()
    tickets = tickets.filter((t) => t.column.name.toLowerCase().includes(columnLower))
  }
  if (assignee) {
    const assigneeLower = assignee.toLowerCase()
    tickets = tickets.filter((t) => t.assignee?.name.toLowerCase().includes(assigneeLower))
  }
  if (sprint) {
    const sprintLower = sprint.toLowerCase()
    tickets = tickets.filter((t) => t.sprint?.name.toLowerCase().includes(sprintLower))
  }
  if (search) {
    const searchLower = search.toLowerCase()
    tickets = tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower),
    )
  }

  // Apply limit after filtering
  tickets = tickets.slice(0, Math.min(limit, 100))

  if (tickets.length === 0) {
    return { success: true, result: 'No tickets found matching the criteria' }
  }

  const lines = tickets.map((t) => {
    const key = `${project.key}-${t.number}`
    const parts = [key, t.title, `[${t.column.name}]`, t.priority]
    if (t.assignee) parts.push(`→ ${t.assignee.name}`)
    if (t.storyPoints !== null) parts.push(`${t.storyPoints}pt`)
    return parts.join(' | ')
  })

  return {
    success: true,
    result: `Found ${tickets.length} ticket(s):\n${lines.join('\n')}`,
  }
}

async function getTicket(input: ToolInput, userId: string): Promise<ToolResult> {
  const { key } = input
  const match = key.match(/^([A-Z]+)-(\d+)$/i)
  if (!match) {
    return { success: false, result: 'Invalid ticket key format' }
  }

  const [, projectKey, numberStr] = match
  const number = parseInt(numberStr, 10)

  const ticket = await db.ticket.findFirst({
    where: {
      number,
      project: {
        key: projectKey.toUpperCase(),
        members: { some: { userId } },
      },
    },
    include: {
      project: { select: { key: true } },
      column: { select: { name: true } },
      assignee: { select: { name: true } },
      sprint: { select: { name: true } },
      labels: { select: { name: true } },
      parent: { select: { number: true, title: true } },
    },
  })

  if (!ticket) {
    return { success: false, result: `Ticket ${key} not found or access denied` }
  }

  const lines = [
    `**${ticket.project.key}-${ticket.number}**: ${ticket.title}`,
    `Type: ${ticket.type} | Priority: ${ticket.priority} | Status: ${ticket.column.name}`,
  ]

  if (ticket.assignee) lines.push(`Assignee: ${ticket.assignee.name}`)
  if (ticket.sprint) lines.push(`Sprint: ${ticket.sprint.name}`)
  if (ticket.storyPoints !== null) lines.push(`Story Points: ${ticket.storyPoints}`)
  if (ticket.labels.length > 0) lines.push(`Labels: ${ticket.labels.map((l) => l.name).join(', ')}`)
  if (ticket.resolution) lines.push(`Resolution: ${ticket.resolution}`)
  if (ticket.parent)
    lines.push(`Parent: ${ticket.project.key}-${ticket.parent.number} (${ticket.parent.title})`)
  if (ticket.description) lines.push(`\nDescription:\n${ticket.description}`)

  return { success: true, result: lines.join('\n') }
}

async function createTicket(input: ToolInput, userId: string): Promise<ToolResult> {
  const {
    projectKey,
    title,
    description,
    type = 'task',
    priority = 'medium',
    assignee,
    storyPoints,
    sprint,
    labels,
    parent,
  } = input

  // Get project and verify access
  const project = await db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      members: { some: { userId } },
    },
    include: {
      columns: { orderBy: { order: 'asc' }, take: 1 },
    },
  })

  if (!project) {
    return { success: false, result: `Project ${projectKey} not found or access denied` }
  }

  if (project.columns.length === 0) {
    return { success: false, result: 'Project has no columns configured' }
  }

  // Get next ticket number
  const maxTicket = await db.ticket.findFirst({
    where: { projectId: project.id },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const nextNumber = (maxTicket?.number ?? 0) + 1

  // Build create data
  // biome-ignore lint/suspicious/noExplicitAny: dynamic Prisma create data
  const data: any = {
    title,
    description,
    type,
    priority,
    number: nextNumber,
    order: Date.now(),
    project: { connect: { id: project.id } },
    column: { connect: { id: project.columns[0].id } },
    creator: { connect: { id: userId } },
  }

  if (storyPoints !== undefined) data.storyPoints = storyPoints

  // Handle assignee
  if (assignee) {
    const projectMembers = await db.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true } } },
    })
    const assigneeLower = assignee.toLowerCase()
    const assigneeUser = projectMembers.find((m) =>
      m.user.name.toLowerCase().includes(assigneeLower),
    )?.user
    if (assigneeUser) {
      data.assignee = { connect: { id: assigneeUser.id } }
    }
  }

  // Handle sprint
  if (sprint) {
    const sprints = await db.sprint.findMany({
      where: { projectId: project.id },
    })
    const sprintLower = sprint.toLowerCase()
    const sprintObj = sprints.find((s) => s.name.toLowerCase() === sprintLower)
    if (sprintObj) {
      data.sprint = { connect: { id: sprintObj.id } }
    }
  }

  // Handle labels
  if (labels && labels.length > 0) {
    const allLabels = await db.label.findMany({
      where: { projectId: project.id },
    })
    const labelsLower = labels.map((l: string) => l.toLowerCase())
    const labelObjs = allLabels.filter((l) => labelsLower.includes(l.name.toLowerCase()))
    if (labelObjs.length > 0) {
      data.labels = { connect: labelObjs.map((l) => ({ id: l.id })) }
    }
  }

  // Handle parent
  if (parent) {
    const parentMatch = parent.match(/^([A-Z]+)-(\d+)$/i)
    if (parentMatch) {
      const parentTicket = await db.ticket.findFirst({
        where: {
          number: parseInt(parentMatch[2], 10),
          project: { key: parentMatch[1].toUpperCase() },
        },
      })
      if (parentTicket) {
        data.parent = { connect: { id: parentTicket.id } }
      }
    }
  }

  const ticket = await db.ticket.create({ data })
  const key = `${project.key}-${ticket.number}`

  return { success: true, result: `Created ticket ${key}: ${title}` }
}

async function updateTicket(input: ToolInput, userId: string): Promise<ToolResult> {
  const { key, ...updates } = input
  const match = key.match(/^([A-Z]+)-(\d+)$/i)
  if (!match) {
    return { success: false, result: 'Invalid ticket key format' }
  }

  const [, projectKey, numberStr] = match
  const number = parseInt(numberStr, 10)

  const ticket = await db.ticket.findFirst({
    where: {
      number,
      project: {
        key: projectKey.toUpperCase(),
        members: { some: { userId } },
      },
    },
    include: { project: true },
  })

  if (!ticket) {
    return { success: false, result: `Ticket ${key} not found or access denied` }
  }

  // biome-ignore lint/suspicious/noExplicitAny: dynamic Prisma update data
  const data: any = {}
  const changes: string[] = []

  if (updates.title) {
    data.title = updates.title
    changes.push(`title → "${updates.title}"`)
  }
  if (updates.description !== undefined) {
    data.description = updates.description
    changes.push('description updated')
  }
  if (updates.type) {
    data.type = updates.type
    changes.push(`type → ${updates.type}`)
  }
  if (updates.priority) {
    data.priority = updates.priority
    changes.push(`priority → ${updates.priority}`)
  }
  if (updates.storyPoints !== undefined) {
    data.storyPoints = updates.storyPoints
    changes.push(`points → ${updates.storyPoints ?? 'none'}`)
  }
  if (updates.resolution !== undefined) {
    data.resolution = updates.resolution
    if (updates.resolution) {
      data.resolvedAt = new Date()
    } else {
      data.resolvedAt = null
    }
    changes.push(`resolution → ${updates.resolution ?? 'none'}`)
  }

  // Handle column
  if (updates.column) {
    const columns = await db.column.findMany({
      where: { projectId: ticket.projectId },
    })
    const columnLower = updates.column.toLowerCase()
    const column = columns.find((c) => c.name.toLowerCase() === columnLower)
    if (column) {
      data.column = { connect: { id: column.id } }
      changes.push(`status → ${column.name}`)
    }
  }

  // Handle assignee
  if (updates.assignee !== undefined) {
    if (updates.assignee === null) {
      data.assignee = { disconnect: true }
      changes.push('assignee → none')
    } else {
      const projectMembers = await db.projectMember.findMany({
        where: { projectId: ticket.projectId },
        include: { user: { select: { id: true, name: true } } },
      })
      const assigneeLower = updates.assignee.toLowerCase()
      const assigneeUser = projectMembers.find((m) =>
        m.user.name.toLowerCase().includes(assigneeLower),
      )?.user
      if (assigneeUser) {
        data.assignee = { connect: { id: assigneeUser.id } }
        changes.push(`assignee → ${assigneeUser.name}`)
      }
    }
  }

  // Handle sprint
  if (updates.sprint !== undefined) {
    if (updates.sprint === null) {
      data.sprint = { disconnect: true }
      changes.push('sprint → backlog')
    } else {
      const sprints = await db.sprint.findMany({
        where: { projectId: ticket.projectId },
      })
      const sprintLower = updates.sprint.toLowerCase()
      const sprintObj = sprints.find((s) => s.name.toLowerCase() === sprintLower)
      if (sprintObj) {
        data.sprint = { connect: { id: sprintObj.id } }
        changes.push(`sprint → ${sprintObj.name}`)
      }
    }
  }

  // Handle labels
  if (updates.labels) {
    const allLabels = await db.label.findMany({
      where: { projectId: ticket.projectId },
    })
    const labelsLower = updates.labels.map((l: string) => l.toLowerCase())
    const labelObjs = allLabels.filter((l) => labelsLower.includes(l.name.toLowerCase()))
    data.labels = { set: labelObjs.map((l) => ({ id: l.id })) }
    changes.push(`labels → ${labelObjs.map((l) => l.name).join(', ') || 'none'}`)
  }

  if (Object.keys(data).length === 0) {
    return { success: true, result: 'No changes to apply' }
  }

  await db.ticket.update({ where: { id: ticket.id }, data })

  return { success: true, result: `Updated ${key}: ${changes.join(', ')}` }
}

async function listProjects(userId: string): Promise<ToolResult> {
  const projects = await db.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      _count: { select: { tickets: true, members: true } },
    },
    orderBy: { name: 'asc' },
  })

  if (projects.length === 0) {
    return { success: true, result: 'No projects found' }
  }

  const lines = projects.map(
    (p) => `${p.key} - ${p.name} (${p._count.tickets} tickets, ${p._count.members} members)`,
  )

  return { success: true, result: `Found ${projects.length} project(s):\n${lines.join('\n')}` }
}

async function getProject(input: ToolInput, userId: string): Promise<ToolResult> {
  const { key } = input

  const project = await db.project.findFirst({
    where: {
      key: key.toUpperCase(),
      members: { some: { userId } },
    },
    include: {
      columns: { orderBy: { order: 'asc' }, select: { name: true } },
      labels: { select: { name: true } },
      sprints: {
        where: { status: { in: ['active', 'planning'] } },
        select: { name: true, status: true },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { tickets: true, members: true } },
    },
  })

  if (!project) {
    return { success: false, result: `Project ${key} not found or access denied` }
  }

  const lines = [
    `**${project.key}**: ${project.name}`,
    project.description || 'No description',
    `Columns: ${project.columns.map((c) => c.name).join(' → ')}`,
    `Labels: ${project.labels.map((l) => l.name).join(', ') || 'none'}`,
    `Sprints: ${project.sprints.map((s) => `${s.name} (${s.status})`).join(', ') || 'none'}`,
    `${project._count.tickets} tickets, ${project._count.members} members`,
  ]

  return { success: true, result: lines.join('\n') }
}

async function listSprints(input: ToolInput, userId: string): Promise<ToolResult> {
  const { projectKey, status } = input

  const project = await db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      members: { some: { userId } },
    },
  })

  if (!project) {
    return { success: false, result: `Project ${projectKey} not found or access denied` }
  }

  // biome-ignore lint/suspicious/noExplicitAny: dynamic Prisma where clause
  const where: any = { projectId: project.id }
  if (status) where.status = status

  const sprints = await db.sprint.findMany({
    where,
    include: {
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (sprints.length === 0) {
    return { success: true, result: 'No sprints found' }
  }

  const lines = sprints.map((s) => {
    const parts = [`${s.name} [${s.status}]`, `${s._count.tickets} tickets`]
    if (s.goal) parts.push(`Goal: ${s.goal}`)
    return parts.join(' | ')
  })

  return { success: true, result: `Found ${sprints.length} sprint(s):\n${lines.join('\n')}` }
}

async function listLabels(input: ToolInput, userId: string): Promise<ToolResult> {
  const { projectKey } = input

  const project = await db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      members: { some: { userId } },
    },
  })

  if (!project) {
    return { success: false, result: `Project ${projectKey} not found or access denied` }
  }

  const labels = await db.label.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })

  if (labels.length === 0) {
    return { success: true, result: 'No labels found' }
  }

  return {
    success: true,
    result: `Labels: ${labels.map((l) => l.name).join(', ')}`,
  }
}
