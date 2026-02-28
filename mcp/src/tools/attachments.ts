import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  deleteAttachment,
  linkAttachments,
  listAttachments,
  listTickets,
  uploadFiles,
} from '../api-client.js'
import {
  errorResponse,
  escapeMarkdown,
  formatAttachmentList,
  formatFileSize,
  parseTicketKey,
  textResponse,
} from '../utils.js'

/**
 * Map of file extensions to MIME types.
 * Matches the allowed types in the PUNT upload route.
 * The server performs magic-byte validation, so this is a best-effort hint.
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
}

/**
 * Detect MIME type from file extension.
 * Returns null if the extension is not in the allowed list.
 */
function detectMimeType(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase()
  return EXTENSION_TO_MIME[ext] ?? null
}

export function registerAttachmentTools(server: McpServer) {
  server.tool(
    'add_attachment',
    'Upload a file from a local path and attach it to a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-42)'),
      filePath: z.string().describe('Absolute path to the local file to upload'),
    },
    async ({ key, filePath }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}. Expected format: PROJECT-123`)
      }

      // Detect MIME type from extension
      const mimeType = detectMimeType(filePath)
      if (!mimeType) {
        const ext = extname(filePath).toLowerCase()
        const supportedExts = Object.keys(EXTENSION_TO_MIME).join(', ')
        return errorResponse(
          `Unsupported file type: ${ext || '(no extension)'}. Supported: ${supportedExts}`,
        )
      }

      // Read the file
      let fileBuffer: Uint8Array
      let fileSize: number
      try {
        const fileStat = await stat(filePath)
        if (!fileStat.isFile()) {
          return errorResponse(`Not a file: ${filePath}`)
        }
        fileSize = fileStat.size
        fileBuffer = new Uint8Array(await readFile(filePath))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return errorResponse(`Cannot read file: ${message}`)
      }

      // Resolve ticket ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      // Step 1: Upload the file via multipart/form-data
      const fileName = basename(filePath)
      const blob = new Blob([fileBuffer.buffer as ArrayBuffer], { type: mimeType })
      const file = new File([blob], fileName, { type: mimeType })
      const formData = new FormData()
      formData.append('files', file)

      const uploadResult = await uploadFiles(formData)
      if (uploadResult.error) {
        return errorResponse(`Upload failed: ${uploadResult.error}`)
      }

      const uploadedFiles = uploadResult.data?.files
      if (!uploadedFiles || uploadedFiles.length === 0) {
        return errorResponse('Upload succeeded but no file data was returned')
      }

      const uploaded = uploadedFiles[0]

      // Step 2: Link the uploaded file to the ticket
      const linkResult = await linkAttachments(parsed.projectKey, ticket.id, {
        attachments: [
          {
            filename: uploaded.filename,
            originalName: uploaded.originalName,
            mimeType: uploaded.mimetype,
            size: uploaded.size,
            url: uploaded.url,
          },
        ],
      })

      if (linkResult.error) {
        return errorResponse(`Failed to link attachment to ticket: ${linkResult.error}`)
      }

      const ticketKey = `${parsed.projectKey.toUpperCase()}-${parsed.number}`
      return textResponse(
        `Attached **${escapeMarkdown(fileName)}** (${formatFileSize(fileSize)}, ${mimeType}) to **${ticketKey}**`,
      )
    },
  )

  server.tool(
    'list_attachments',
    'List all attachments for a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-42)'),
    },
    async ({ key }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}. Expected format: PROJECT-123`)
      }

      // Resolve ticket ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      const result = await listAttachments(parsed.projectKey, ticket.id)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticketKey = `${parsed.projectKey.toUpperCase()}-${parsed.number}`
      return textResponse(formatAttachmentList(result.data ?? [], ticketKey))
    },
  )

  server.tool(
    'remove_attachment',
    'Remove an attachment from a ticket',
    {
      key: z.string().describe('Ticket key (e.g., PUNT-42)'),
      attachmentId: z
        .string()
        .optional()
        .describe('Attachment ID to remove (from list_attachments)'),
      filename: z
        .string()
        .optional()
        .describe('Filename to search for (if attachmentId not provided)'),
    },
    async ({ key, attachmentId, filename }) => {
      const parsed = parseTicketKey(key)
      if (!parsed) {
        return errorResponse(`Invalid ticket key format: ${key}. Expected format: PROJECT-123`)
      }

      if (!attachmentId && !filename) {
        return errorResponse('Either attachmentId or filename must be provided')
      }

      // Resolve ticket ID
      const ticketsResult = await listTickets(parsed.projectKey)
      if (ticketsResult.error) {
        return errorResponse(ticketsResult.error)
      }

      const ticket = ticketsResult.data?.find((t) => t.number === parsed.number)
      if (!ticket) {
        return errorResponse(`Ticket not found: ${key}`)
      }

      // If filename provided instead of ID, look up the attachment
      let targetId = attachmentId
      let targetFilename = filename

      if (!targetId) {
        const listResult = await listAttachments(parsed.projectKey, ticket.id)
        if (listResult.error) {
          return errorResponse(listResult.error)
        }

        const attachments = listResult.data ?? []
        const searchTerm = filename?.toLowerCase() ?? ''
        const match = attachments.find((a) => a.filename.toLowerCase().includes(searchTerm))

        if (!match) {
          return errorResponse(`No attachment found matching filename: ${filename}`)
        }

        targetId = match.id
        targetFilename = match.filename
      }

      const result = await deleteAttachment(parsed.projectKey, ticket.id, targetId as string)
      if (result.error) {
        return errorResponse(result.error)
      }

      const ticketKey = `${parsed.projectKey.toUpperCase()}-${parsed.number}`
      const displayName = targetFilename ? escapeMarkdown(targetFilename) : targetId
      return textResponse(`Removed attachment **${displayName}** from **${ticketKey}**`)
    },
  )
}
