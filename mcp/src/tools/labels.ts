import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db.js'
import { errorResponse, textResponse } from '../utils.js'

// Default colors for new labels
const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
]

export function registerLabelTools(server: McpServer) {
  // list_labels - List labels for a project
  server.tool(
    'list_labels',
    'List all labels for a project',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
    },
    async ({ projectKey }) => {
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          name: true,
          labels: {
            select: {
              id: true,
              name: true,
              color: true,
              _count: { select: { tickets: true } },
            },
            orderBy: { name: 'asc' },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const lines: string[] = []
      lines.push(`# Labels in ${project.key}: ${project.name}`)
      lines.push('')

      if (project.labels.length === 0) {
        lines.push('No labels defined.')
      } else {
        lines.push('| Name | Color | Tickets |')
        lines.push('|------|-------|---------|')
        for (const label of project.labels) {
          lines.push(`| ${label.name} | ${label.color} | ${label._count.tickets} |`)
        }
        lines.push('')
        lines.push(`Total: ${project.labels.length} label(s)`)
      }

      return textResponse(lines.join('\n'))
    },
  )

  // create_label - Create a new label
  server.tool(
    'create_label',
    'Create a new label in a project',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      name: z.string().min(1).describe('Label name'),
      color: z.string().optional().describe('Label color (hex, e.g., #3b82f6)'),
    },
    async ({ projectKey, name, color }) => {
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          _count: { select: { labels: true } },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Check for duplicate name
      const existing = await db.label.findFirst({
        where: { projectId: project.id, name },
        select: { id: true },
      })
      if (existing) {
        return errorResponse(`Label already exists: ${name}`)
      }

      // Pick a color if not specified (cycle through palette)
      const labelColor = color || LABEL_COLORS[project._count.labels % LABEL_COLORS.length]

      const label = await db.label.create({
        data: {
          name,
          color: labelColor,
          projectId: project.id,
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
      })

      return textResponse(`Created label "${label.name}" (${label.color}) in ${project.key}`)
    },
  )

  // update_label - Update a label
  server.tool(
    'update_label',
    'Update a label name or color',
    {
      projectKey: z.string().describe('Project key'),
      labelName: z.string().describe('Current label name'),
      name: z.string().optional().describe('New label name'),
      color: z.string().optional().describe('New color (hex)'),
    },
    async ({ projectKey, labelName, name, color }) => {
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const label = await db.label.findFirst({
        where: { projectId: project.id, name: { contains: labelName } },
        select: { id: true, name: true, color: true },
      })

      if (!label) {
        return errorResponse(`Label not found: ${labelName}`)
      }

      const data: Record<string, unknown> = {}
      if (name !== undefined) data.name = name
      if (color !== undefined) data.color = color

      if (Object.keys(data).length === 0) {
        return errorResponse('No changes specified')
      }

      // Check for name conflict if renaming
      if (name && name !== label.name) {
        const conflict = await db.label.findFirst({
          where: { projectId: project.id, name },
          select: { id: true },
        })
        if (conflict) {
          return errorResponse(`Label name already exists: ${name}`)
        }
      }

      const updated = await db.label.update({
        where: { id: label.id },
        data,
        select: { id: true, name: true, color: true },
      })

      return textResponse(`Updated label: "${label.name}" → "${updated.name}" (${updated.color})`)
    },
  )

  // delete_label - Delete a label
  server.tool(
    'delete_label',
    'Delete a label from a project',
    {
      projectKey: z.string().describe('Project key'),
      labelName: z.string().describe('Label name to delete'),
    },
    async ({ projectKey, labelName }) => {
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const label = await db.label.findFirst({
        where: { projectId: project.id, name: { contains: labelName } },
        select: { id: true, name: true, _count: { select: { tickets: true } } },
      })

      if (!label) {
        return errorResponse(`Label not found: ${labelName}`)
      }

      await db.label.delete({ where: { id: label.id } })

      return textResponse(
        `Deleted label "${label.name}" (was on ${label._count.tickets} ticket(s))`,
      )
    },
  )

  // add_label_to_ticket - Add a label to a ticket
  server.tool(
    'add_label_to_ticket',
    'Add a label to a ticket',
    {
      ticketKey: z.string().describe('Ticket key (e.g., PUNT-42)'),
      labelName: z.string().describe('Label name to add'),
    },
    async ({ ticketKey, labelName }) => {
      // Parse ticket key
      const match = ticketKey.match(/^([A-Za-z]+)-(\d+)$/)
      if (!match) {
        return errorResponse(`Invalid ticket key format: ${ticketKey}`)
      }
      const [, projectKey, numberStr] = match
      const number = parseInt(numberStr, 10)

      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const ticket = await db.ticket.findFirst({
        where: { projectId: project.id, number },
        select: { id: true, number: true, labels: { select: { id: true } } },
      })

      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      const label = await db.label.findFirst({
        where: { projectId: project.id, name: { contains: labelName } },
        select: { id: true, name: true },
      })

      if (!label) {
        return errorResponse(`Label not found: ${labelName}`)
      }

      // Check if already has label
      if (ticket.labels.some((l) => l.id === label.id)) {
        return errorResponse(
          `Ticket ${project.key}-${ticket.number} already has label "${label.name}"`,
        )
      }

      await db.ticket.update({
        where: { id: ticket.id },
        data: { labels: { connect: { id: label.id } } },
      })

      return textResponse(`Added label "${label.name}" to ${project.key}-${ticket.number}`)
    },
  )

  // remove_label_from_ticket - Remove a label from a ticket
  server.tool(
    'remove_label_from_ticket',
    'Remove a label from a ticket',
    {
      ticketKey: z.string().describe('Ticket key (e.g., PUNT-42)'),
      labelName: z.string().describe('Label name to remove'),
    },
    async ({ ticketKey, labelName }) => {
      // Parse ticket key
      const match = ticketKey.match(/^([A-Za-z]+)-(\d+)$/)
      if (!match) {
        return errorResponse(`Invalid ticket key format: ${ticketKey}`)
      }
      const [, projectKey, numberStr] = match
      const number = parseInt(numberStr, 10)

      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const ticket = await db.ticket.findFirst({
        where: { projectId: project.id, number },
        select: { id: true, number: true, labels: { select: { id: true, name: true } } },
      })

      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      const label = ticket.labels.find((l) =>
        l.name.toLowerCase().includes(labelName.toLowerCase()),
      )

      if (!label) {
        return errorResponse(
          `Ticket ${project.key}-${ticket.number} does not have label "${labelName}"`,
        )
      }

      await db.ticket.update({
        where: { id: ticket.id },
        data: { labels: { disconnect: { id: label.id } } },
      })

      return textResponse(`Removed label "${label.name}" from ${project.key}-${ticket.number}`)
    },
  )
}
