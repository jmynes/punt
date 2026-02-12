import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  createColumn as apiCreateColumn,
  deleteColumn as apiDeleteColumn,
  listColumns as apiListColumns,
  updateColumn as apiUpdateColumn,
} from '../api-client.js'
import { db } from '../db.js'
import { errorResponse, escapeMarkdown, safeTableCell, textResponse } from '../utils.js'

export function registerColumnTools(server: McpServer) {
  // list_columns - List columns for a project
  server.tool(
    'list_columns',
    'List all columns (board statuses) for a project',
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
          columns: {
            select: {
              id: true,
              name: true,
              order: true,
              _count: { select: { tickets: true } },
            },
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const lines: string[] = []
      // Escape user-controlled project name
      lines.push(`# Columns in ${project.key}: ${escapeMarkdown(project.name)}`)
      lines.push('')

      if (project.columns.length === 0) {
        lines.push('No columns defined.')
      } else {
        lines.push('| # | Name | Tickets |')
        lines.push('|---|------|---------|')
        for (const col of project.columns) {
          // Escape user-controlled column name for safe table rendering
          lines.push(
            `| ${col.order + 1} | ${safeTableCell(col.name, 30)} | ${col._count.tickets} |`,
          )
        }
        lines.push('')
        lines.push(`Total: ${project.columns.length} column(s)`)
      }

      return textResponse(lines.join('\n'))
    },
  )

  // create_column - Create a new column
  server.tool(
    'create_column',
    'Create a new column in a project board',
    {
      projectKey: z.string().describe('Project key (e.g., PUNT)'),
      name: z.string().min(1).describe('Column name'),
      position: z.number().optional().describe('Position (1-based). Defaults to end.'),
    },
    async ({ projectKey, name, position }) => {
      const upperKey = projectKey.toUpperCase()

      // Get current columns to calculate order
      const columnsResult = await apiListColumns(upperKey)
      if (columnsResult.error) {
        return errorResponse(columnsResult.error)
      }

      const columns = columnsResult.data || []
      const columnCount = columns.length
      // Convert 1-based position to 0-based order
      const targetOrder = position ? Math.max(0, Math.min(position - 1, columnCount)) : columnCount

      // Use the API to create the column (enforces authorization)
      const result = await apiCreateColumn(upperKey, { name, order: targetOrder })

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled column name
      return textResponse(
        `Created column **"${escapeMarkdown(name)}"** at position ${targetOrder + 1} in ${upperKey}`,
      )
    },
  )

  // rename_column - Rename a column
  server.tool(
    'rename_column',
    'Rename a column',
    {
      projectKey: z.string().describe('Project key'),
      columnName: z.string().describe('Current column name'),
      newName: z.string().min(1).describe('New column name'),
    },
    async ({ projectKey, columnName, newName }) => {
      const upperKey = projectKey.toUpperCase()

      // Get columns to find the one to rename
      const columnsResult = await apiListColumns(upperKey)
      if (columnsResult.error) {
        return errorResponse(columnsResult.error)
      }

      const columns = columnsResult.data || []
      const column = columns.find((c) => c.name.toLowerCase().includes(columnName.toLowerCase()))

      if (!column) {
        return errorResponse(`Column not found: ${columnName}`)
      }

      // Use the API to update the column (enforces authorization)
      const result = await apiUpdateColumn(upperKey, column.id, { name: newName })

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled column names
      return textResponse(
        `Renamed column **"${escapeMarkdown(column.name)}"** -> **"${escapeMarkdown(newName)}"**`,
      )
    },
  )

  // reorder_column - Move a column to a new position
  server.tool(
    'reorder_column',
    'Move a column to a new position',
    {
      projectKey: z.string().describe('Project key'),
      columnName: z.string().describe('Column name to move'),
      position: z.number().min(1).describe('New position (1-based)'),
    },
    async ({ projectKey, columnName, position }) => {
      const upperKey = projectKey.toUpperCase()

      // Get columns to find the one to move
      const columnsResult = await apiListColumns(upperKey)
      if (columnsResult.error) {
        return errorResponse(columnsResult.error)
      }

      const columns = columnsResult.data || []
      const column = columns.find((c) => c.name.toLowerCase().includes(columnName.toLowerCase()))

      if (!column) {
        return errorResponse(`Column not found: ${columnName}`)
      }

      const currentOrder = column.order
      const targetOrder = Math.max(0, Math.min(position - 1, columns.length - 1))

      if (currentOrder === targetOrder) {
        // Escape user-controlled column name
        return textResponse(
          `Column **"${escapeMarkdown(column.name)}"** is already at position ${position}`,
        )
      }

      // Use the API to update the column order (enforces authorization)
      const result = await apiUpdateColumn(upperKey, column.id, { order: targetOrder })

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled column name
      return textResponse(
        `Moved column **"${escapeMarkdown(column.name)}"** from position ${currentOrder + 1} to ${targetOrder + 1}`,
      )
    },
  )

  // delete_column - Delete a column
  server.tool(
    'delete_column',
    'Delete a column (moves tickets to another column)',
    {
      projectKey: z.string().describe('Project key'),
      columnName: z.string().describe('Column name to delete'),
      moveTicketsTo: z.string().describe('Column to move tickets to'),
    },
    async ({ projectKey, columnName, moveTicketsTo }) => {
      const upperKey = projectKey.toUpperCase()

      // Get columns to find source and target
      const columnsResult = await apiListColumns(upperKey)
      if (columnsResult.error) {
        return errorResponse(columnsResult.error)
      }

      const columns = columnsResult.data || []

      if (columns.length <= 1) {
        return errorResponse('Cannot delete the last column')
      }

      const column = columns.find((c) => c.name.toLowerCase().includes(columnName.toLowerCase()))

      if (!column) {
        return errorResponse(`Column not found: ${columnName}`)
      }

      const targetColumn = columns.find(
        (c) => c.id !== column.id && c.name.toLowerCase().includes(moveTicketsTo.toLowerCase()),
      )

      if (!targetColumn) {
        return errorResponse(`Target column not found: ${moveTicketsTo}`)
      }

      // Use the API to delete the column (enforces authorization)
      const result = await apiDeleteColumn(upperKey, column.id, targetColumn.id)

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled column names
      return textResponse(
        `Deleted column **"${escapeMarkdown(column.name)}"** (tickets moved to "${escapeMarkdown(targetColumn.name)}")`,
      )
    },
  )
}
