import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  createLabel,
  deleteLabel,
  type LabelData,
  listLabels,
  listTickets,
  updateTicket,
} from '../api-client.js'
import { errorResponse, textResponse } from '../utils.js'

/**
 * Format a list of labels for display
 */
function formatLabelList(labels: LabelData[], projectKey: string): string {
  if (labels.length === 0) {
    return `No labels defined in ${projectKey}.`
  }

  const lines: string[] = []
  lines.push(`# Labels in ${projectKey}`)
  lines.push('')
  lines.push('| Name | Color |')
  lines.push('|------|-------|')
  for (const label of labels) {
    lines.push(`| ${label.name} | ${label.color} |`)
  }
  lines.push('')
  lines.push(`Total: ${labels.length} label(s)`)

  return lines.join('\n')
}

export function registerLabelTools(server: McpServer) {
  // list_labels - List labels for a project
  server.tool(
    'list_labels',
    'List all labels for a project',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
    },
    async ({ projectKey }) => {
      const result = await listLabels(projectKey)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(formatLabelList(result.data || [], projectKey.toUpperCase()))
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
      const result = await createLabel(projectKey, { name, color })
      if (result.error) {
        return errorResponse(result.error)
      }

      const label = result.data
      if (!label) {
        return errorResponse('Failed to create label: no data returned')
      }
      return textResponse(
        `Created label "${label.name}" (${label.color}) in ${projectKey.toUpperCase()}`,
      )
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
      // List labels to find the one to update
      const listResult = await listLabels(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const label = listResult.data?.find((l) =>
        l.name.toLowerCase().includes(labelName.toLowerCase()),
      )

      if (!label) {
        return errorResponse(`Label not found: ${labelName}`)
      }

      if (name === undefined && color === undefined) {
        return errorResponse('No changes specified')
      }

      // Note: Label update API doesn't exist yet - this would need to be added
      // For now, we can delete and recreate with new values
      const newName = name ?? label.name
      const newColor = color ?? label.color

      // Delete old label
      const deleteResult = await deleteLabel(projectKey, label.id)
      if (deleteResult.error) {
        return errorResponse(deleteResult.error)
      }

      // Create new label with updated values
      const createResult = await createLabel(projectKey, { name: newName, color: newColor })
      if (createResult.error) {
        return errorResponse(createResult.error)
      }

      return textResponse(`Updated label: "${label.name}" → "${newName}" (${newColor})`)
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
      // List labels to find the one to delete
      const listResult = await listLabels(projectKey)
      if (listResult.error) {
        return errorResponse(listResult.error)
      }

      const label = listResult.data?.find((l) =>
        l.name.toLowerCase().includes(labelName.toLowerCase()),
      )

      if (!label) {
        return errorResponse(`Label not found: ${labelName}`)
      }

      const result = await deleteLabel(projectKey, label.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(`Deleted label "${label.name}"`)
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

      // Get labels for the project
      const labelsResult = await listLabels(projectKey)
      if (labelsResult.error) {
        return errorResponse(labelsResult.error)
      }

      const label = labelsResult.data?.find((l) =>
        l.name.toLowerCase().includes(labelName.toLowerCase()),
      )

      if (!label) {
        return errorResponse(`Label not found: ${labelName}`)
      }

      // Get the ticket
      const ticketsResult = await listTickets(projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      // Check if already has label
      if (ticket.labels.some((l) => l.id === label.id)) {
        return errorResponse(
          `Ticket ${projectKey.toUpperCase()}-${number} already has label "${label.name}"`,
        )
      }

      // Add the label by updating ticket with new labelIds
      const newLabelIds = [...ticket.labels.map((l) => l.id), label.id]
      const updateResult = await updateTicket(projectKey, ticket.id, { labelIds: newLabelIds })
      if (updateResult.error) {
        return errorResponse(updateResult.error)
      }

      return textResponse(`Added label "${label.name}" to ${projectKey.toUpperCase()}-${number}`)
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

      // Get the ticket
      const ticketsResult = await listTickets(projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      // Find the label on the ticket
      const label = ticket.labels.find((l) =>
        l.name.toLowerCase().includes(labelName.toLowerCase()),
      )

      if (!label) {
        return errorResponse(
          `Ticket ${projectKey.toUpperCase()}-${number} does not have label "${labelName}"`,
        )
      }

      // Remove the label by updating ticket with filtered labelIds
      const newLabelIds = ticket.labels.filter((l) => l.id !== label.id).map((l) => l.id)
      const updateResult = await updateTicket(projectKey, ticket.id, { labelIds: newLabelIds })
      if (updateResult.error) {
        return errorResponse(updateResult.error)
      }

      return textResponse(
        `Removed label "${label.name}" from ${projectKey.toUpperCase()}-${number}`,
      )
    },
  )
}
