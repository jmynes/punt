import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '../db.js'
import { errorResponse, textResponse } from '../utils.js'

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
      lines.push(`# Columns in ${project.key}: ${project.name}`)
      lines.push('')

      if (project.columns.length === 0) {
        lines.push('No columns defined.')
      } else {
        lines.push('| # | Name | Tickets |')
        lines.push('|---|------|---------|')
        for (const col of project.columns) {
          lines.push(`| ${col.order + 1} | ${col.name} | ${col._count.tickets} |`)
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          columns: {
            select: { id: true, name: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Check for duplicate name
      if (project.columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return errorResponse(`Column already exists: ${name}`)
      }

      const columnCount = project.columns.length
      // Convert 1-based position to 0-based order
      const targetOrder = position ? Math.max(0, Math.min(position - 1, columnCount)) : columnCount

      // Shift columns at or after target position
      await db.$transaction(async (tx) => {
        if (targetOrder < columnCount) {
          // Shift columns down
          for (const col of project.columns) {
            if (col.order >= targetOrder) {
              await tx.column.update({
                where: { id: col.id },
                data: { order: col.order + 1 },
              })
            }
          }
        }

        await tx.column.create({
          data: {
            name,
            order: targetOrder,
            projectId: project.id,
          },
        })
      })

      return textResponse(
        `Created column "${name}" at position ${targetOrder + 1} in ${project.key}`,
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          columns: { select: { id: true, name: true } },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const column = project.columns.find((c) =>
        c.name.toLowerCase().includes(columnName.toLowerCase()),
      )

      if (!column) {
        return errorResponse(`Column not found: ${columnName}`)
      }

      // Check for name conflict
      if (
        project.columns.some(
          (c) => c.id !== column.id && c.name.toLowerCase() === newName.toLowerCase(),
        )
      ) {
        return errorResponse(`Column name already exists: ${newName}`)
      }

      await db.column.update({
        where: { id: column.id },
        data: { name: newName },
      })

      return textResponse(`Renamed column: "${column.name}" → "${newName}"`)
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          columns: {
            select: { id: true, name: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const column = project.columns.find((c) =>
        c.name.toLowerCase().includes(columnName.toLowerCase()),
      )

      if (!column) {
        return errorResponse(`Column not found: ${columnName}`)
      }

      const currentOrder = column.order
      const targetOrder = Math.max(0, Math.min(position - 1, project.columns.length - 1))

      if (currentOrder === targetOrder) {
        return textResponse(`Column "${column.name}" is already at position ${position}`)
      }

      await db.$transaction(async (tx) => {
        if (targetOrder > currentOrder) {
          // Moving down: shift columns between current and target up
          for (const col of project.columns) {
            if (col.order > currentOrder && col.order <= targetOrder) {
              await tx.column.update({
                where: { id: col.id },
                data: { order: col.order - 1 },
              })
            }
          }
        } else {
          // Moving up: shift columns between target and current down
          for (const col of project.columns) {
            if (col.order >= targetOrder && col.order < currentOrder) {
              await tx.column.update({
                where: { id: col.id },
                data: { order: col.order + 1 },
              })
            }
          }
        }

        await tx.column.update({
          where: { id: column.id },
          data: { order: targetOrder },
        })
      })

      return textResponse(
        `Moved column "${column.name}" from position ${currentOrder + 1} to ${targetOrder + 1}`,
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
      const project = await db.project.findUnique({
        where: { key: projectKey.toUpperCase() },
        select: {
          id: true,
          key: true,
          columns: {
            select: { id: true, name: true, order: true, _count: { select: { tickets: true } } },
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      if (project.columns.length <= 1) {
        return errorResponse('Cannot delete the last column')
      }

      const column = project.columns.find((c) =>
        c.name.toLowerCase().includes(columnName.toLowerCase()),
      )

      if (!column) {
        return errorResponse(`Column not found: ${columnName}`)
      }

      const targetColumn = project.columns.find(
        (c) => c.id !== column.id && c.name.toLowerCase().includes(moveTicketsTo.toLowerCase()),
      )

      if (!targetColumn) {
        return errorResponse(`Target column not found: ${moveTicketsTo}`)
      }

      const ticketCount = column._count.tickets

      await db.$transaction(async (tx) => {
        // Move tickets
        if (ticketCount > 0) {
          await tx.ticket.updateMany({
            where: { columnId: column.id },
            data: { columnId: targetColumn.id },
          })
        }

        // Delete the column
        await tx.column.delete({ where: { id: column.id } })

        // Reorder remaining columns
        for (const col of project.columns) {
          if (col.order > column.order) {
            await tx.column.update({
              where: { id: col.id },
              data: { order: col.order - 1 },
            })
          }
        }
      })

      return textResponse(
        `Deleted column "${column.name}" (${ticketCount} ticket(s) moved to "${targetColumn.name}")`,
      )
    },
  )
}
