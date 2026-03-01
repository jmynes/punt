import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  type AttachmentData,
  deleteAttachment,
  getUploadConfig,
  listAttachments,
  listTickets,
  uploadAndAttachFile,
} from '../api-client.js'
import {
  errorResponse,
  escapeMarkdown,
  formatDateTime,
  parseTicketKey,
  safeTableCell,
  textResponse,
} from '../utils.js'

/**
 * Format file size into a human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format a list of attachments as a markdown table
 */
function formatAttachmentList(attachments: AttachmentData[], ticketKey: string): string {
  if (attachments.length === 0) {
    return `No attachments on ${ticketKey}.`
  }

  const lines: string[] = []
  lines.push(`# Attachments on ${ticketKey}`)
  lines.push('')
  lines.push('| ID | Filename | Type | Size | Uploaded |')
  lines.push('|----|----------|------|------|----------|')

  for (const att of attachments) {
    const filename = safeTableCell(att.filename, 40)
    const mimeType = safeTableCell(att.mimeType, 30)
    const size = formatFileSize(att.size)
    const uploaded = formatDateTime(att.createdAt)
    lines.push(`| ${att.id} | ${filename} | ${mimeType} | ${size} | ${uploaded} |`)
  }

  lines.push('')
  lines.push(`Total: ${attachments.length} attachment(s)`)

  return lines.join('\n')
}

export function registerAttachmentTools(server: McpServer) {
  // list_attachments - List all attachments on a ticket
  server.tool(
    'list_attachments',
    'List all attachments on a ticket',
    {
      ticketKey: z.string().describe('Ticket key (e.g., PUNT-42)'),
    },
    async ({ ticketKey }) => {
      const parsed = parseTicketKey(ticketKey)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${ticketKey}`)
      }

      const { projectKey, number } = parsed

      // Resolve ticket ID from ticket number
      const ticketsResult = await listTickets(projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      const result = await listAttachments(projectKey, ticket.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(
        formatAttachmentList(result.data ?? [], `${projectKey.toUpperCase()}-${number}`),
      )
    },
  )

  // add_attachment - Upload a file attachment to a ticket
  server.tool(
    'add_attachment',
    'Upload a file attachment to a ticket (base64-encoded content)',
    {
      ticketKey: z.string().describe('Ticket key (e.g., PUNT-42)'),
      filename: z.string().min(1).describe('Original filename (e.g., screenshot.png)'),
      contentType: z.string().min(1).describe('MIME type (e.g., image/png, application/pdf)'),
      content: z.string().min(1).describe('Base64-encoded file content'),
    },
    async ({ ticketKey, filename, contentType, content }) => {
      const parsed = parseTicketKey(ticketKey)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${ticketKey}`)
      }

      const { projectKey, number } = parsed

      // Block SVG uploads (XSS risk)
      if (contentType === 'image/svg+xml' || contentType === 'image/svg') {
        return errorResponse('SVG files are not allowed due to security risks (embedded scripts).')
      }

      // Fetch upload config to validate file type and size
      const configResult = await getUploadConfig()
      if (configResult.error) {
        return errorResponse(`Failed to fetch upload config: ${configResult.error}`)
      }

      const config = configResult.data
      if (!config) {
        return errorResponse('Failed to fetch upload configuration')
      }

      // Validate content type against allowed types
      if (!config.allowedTypes.includes(contentType)) {
        return errorResponse(
          `File type not allowed: ${contentType}. Allowed types: ${config.allowedTypes.join(', ')}`,
        )
      }

      // Decode base64 content
      let fileBuffer: Buffer
      try {
        fileBuffer = Buffer.from(content, 'base64')
      } catch {
        return errorResponse('Invalid base64 content')
      }

      // Validate file size against limits
      const fileSize = fileBuffer.length
      let maxSize: number
      if (contentType.startsWith('image/')) {
        maxSize = config.maxSizes.image
      } else if (contentType.startsWith('video/')) {
        maxSize = config.maxSizes.video
      } else {
        maxSize = config.maxSizes.document
      }

      if (fileSize > maxSize) {
        return errorResponse(
          `File too large: ${formatFileSize(fileSize)}. Maximum size for this type is ${formatFileSize(maxSize)}.`,
        )
      }

      // Resolve ticket ID from ticket number
      const ticketsResult = await listTickets(projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      // Upload and attach the file
      const result = await uploadAndAttachFile(
        projectKey,
        ticket.id,
        filename,
        contentType,
        fileBuffer,
      )
      if (result.error) {
        return errorResponse(result.error)
      }

      const attachments = result.data
      if (!attachments || attachments.length === 0) {
        return errorResponse('Upload succeeded but no attachment records were created')
      }

      const att = attachments[0]
      return textResponse(
        `Attached **${escapeMarkdown(filename)}** (${contentType}, ${formatFileSize(fileSize)}) to **${projectKey.toUpperCase()}-${number}**\nAttachment ID: ${att.id}`,
      )
    },
  )

  // delete_attachment - Remove an attachment from a ticket
  server.tool(
    'delete_attachment',
    'Remove an attachment from a ticket',
    {
      ticketKey: z.string().describe('Ticket key (e.g., PUNT-42)'),
      attachmentId: z.string().describe('Attachment ID to delete'),
    },
    async ({ ticketKey, attachmentId }) => {
      const parsed = parseTicketKey(ticketKey)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${ticketKey}`)
      }

      const { projectKey, number } = parsed

      // Resolve ticket ID from ticket number
      const ticketsResult = await listTickets(projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${ticketKey}`)
      }

      const result = await deleteAttachment(projectKey, ticket.id, attachmentId)
      if (result.error) {
        return errorResponse(result.error)
      }

      return textResponse(
        `Deleted attachment **${attachmentId}** from **${projectKey.toUpperCase()}-${number}**`,
      )
    },
  )
}
