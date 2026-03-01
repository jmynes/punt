import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMe, unwrapData } from '../api-client.js'
import { resolveApiUrl } from '../credentials.js'
import { db } from '../db.js'
import { errorResponse, escapeMarkdown, safeTableCell, textResponse } from '../utils.js'

export function registerWhoamiTools(server: McpServer) {
  server.tool(
    'whoami',
    'Get the current authenticated user context (display name, username, email, admin status, project memberships, avatar)',
    {},
    async () => {
      // Fetch current user via the /api/me endpoint (uses MCP API key auth)
      const meResult = await getMe()
      if (meResult.error) {
        return errorResponse(meResult.error)
      }

      const me = unwrapData(meResult)

      // Fetch project memberships with roles from the database
      const memberships = await db.projectMember.findMany({
        where: { userId: me.id },
        select: {
          project: { select: { key: true, name: true } },
          role: { select: { name: true } },
        },
        orderBy: { project: { name: 'asc' } },
      })

      const lines: string[] = []
      lines.push(`# ${escapeMarkdown(me.name)}`)
      lines.push('')

      // Profile details
      lines.push(`**Email:** ${me.email ? escapeMarkdown(me.email) : '-'}  `)
      lines.push(`**System Admin:** ${me.isSystemAdmin ? 'Yes' : 'No'}  `)

      if (me.avatar) {
        const baseUrl = resolveApiUrl()
        const avatarUrl = me.avatar.startsWith('http') ? me.avatar : `${baseUrl}${me.avatar}`
        lines.push(`**Avatar:** ${avatarUrl}  `)
      }

      // Project memberships
      lines.push('')
      if (memberships.length === 0) {
        lines.push('**Projects:** None')
      } else {
        lines.push('## Project Memberships')
        lines.push('')
        lines.push('| Project | Key | Role |')
        lines.push('|---------|-----|------|')
        for (const m of memberships) {
          const name = safeTableCell(m.project.name, 30)
          const role = safeTableCell(m.role.name, 20)
          lines.push(`| ${name} | ${m.project.key} | ${role} |`)
        }
        lines.push('')
        lines.push(`Total: ${memberships.length} project(s)`)
      }

      return textResponse(lines.join('\n'))
    },
  )
}
