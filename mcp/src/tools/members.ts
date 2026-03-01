import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  addMember as apiAddMember,
  removeMember as apiRemoveMember,
  updateMemberRole as apiUpdateMemberRole,
} from '../api-client.js'
import { db } from '../db.js'
import { resolveUser } from '../resolve-user.js'
import { errorResponse, escapeMarkdown, safeTableCell, textResponse } from '../utils.js'

export function registerMemberTools(server: McpServer) {
  // list_members - List project members
  server.tool(
    'list_members',
    'List members of a project',
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
          members: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
              role: { select: { name: true, color: true } },
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      const lines: string[] = []
      // Escape user-controlled project name
      lines.push(`# Members of ${project.key}: ${escapeMarkdown(project.name)}`)
      lines.push('')

      if (project.members.length === 0) {
        lines.push('No members.')
      } else {
        lines.push('| Name | Email | Role |')
        lines.push('|------|-------|------|')
        for (const m of project.members) {
          // Escape user-controlled fields for safe table rendering
          const name = safeTableCell(m.user.name, 30)
          const email = m.user.email ? safeTableCell(m.user.email, 40) : '-'
          const role = safeTableCell(m.role.name, 20)
          lines.push(`| ${name} | ${email} | ${role} |`)
        }
        lines.push('')
        lines.push(`Total: ${project.members.length} member(s)`)
      }

      return textResponse(lines.join('\n'))
    },
  )

  // add_member - Add a member to a project
  server.tool(
    'add_member',
    'Add a user to a project',
    {
      projectKey: z.string().describe('Project key'),
      userName: z.string().describe('User identifier (name, username, or email)'),
      role: z.string().default('Member').describe('Role name (e.g., Owner, Admin, Member)'),
    },
    async ({ projectKey, userName, role }) => {
      const upperKey = projectKey.toUpperCase()

      const project = await db.project.findUnique({
        where: { key: upperKey },
        select: {
          id: true,
          key: true,
          roles: { select: { id: true, name: true } },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Find user
      const resolved = await resolveUser(userName)
      if (resolved.error) return resolved.error
      const user = resolved.user

      // Find role
      const foundRole = project.roles.find((r) => r.name.toLowerCase() === role.toLowerCase())

      if (!foundRole) {
        const availableRoles = project.roles.map((r) => r.name).join(', ')
        return errorResponse(`Role not found: ${role}. Available: ${availableRoles}`)
      }

      // Use the API to add the member (enforces authorization)
      const result = await apiAddMember(upperKey, { userId: user.id, roleId: foundRole.id })

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled user and role names
      return textResponse(
        `Added **${escapeMarkdown(user.name)}** to ${project.key} as ${escapeMarkdown(foundRole.name)}`,
      )
    },
  )

  // remove_member - Remove a member from a project
  server.tool(
    'remove_member',
    'Remove a user from a project',
    {
      projectKey: z.string().describe('Project key'),
      userName: z.string().describe('User identifier (name, username, or email)'),
    },
    async ({ projectKey, userName }) => {
      const upperKey = projectKey.toUpperCase()

      const project = await db.project.findUnique({
        where: { key: upperKey },
        select: { id: true, key: true },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Find user
      const resolved = await resolveUser(userName)
      if (resolved.error) return resolved.error
      const user = resolved.user

      // Find membership
      const member = await db.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: project.id } },
        select: { id: true },
      })

      if (!member) {
        return errorResponse(`${user.name} is not a member of ${project.key}`)
      }

      // Use the API to remove the member (enforces authorization)
      const result = await apiRemoveMember(upperKey, member.id)

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled user name
      return textResponse(`Removed **${escapeMarkdown(user.name)}** from ${project.key}`)
    },
  )

  // change_member_role - Change a member's role
  server.tool(
    'change_member_role',
    "Change a project member's role",
    {
      projectKey: z.string().describe('Project key'),
      userName: z.string().describe('User identifier (name, username, or email)'),
      role: z.string().describe('New role name'),
    },
    async ({ projectKey, userName, role }) => {
      const upperKey = projectKey.toUpperCase()

      // Get project with roles
      const project = await db.project.findUnique({
        where: { key: upperKey },
        select: {
          id: true,
          key: true,
          roles: { select: { id: true, name: true } },
        },
      })

      if (!project) {
        return errorResponse(`Project not found: ${projectKey}`)
      }

      // Find user
      const resolved = await resolveUser(userName)
      if (resolved.error) return resolved.error
      const user = resolved.user

      // Find membership
      const member = await db.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: project.id } },
        select: { id: true, role: { select: { name: true } } },
      })

      if (!member) {
        return errorResponse(`${user.name} is not a member of ${project.key}`)
      }

      // Find new role
      const newRole = project.roles.find((r) => r.name.toLowerCase() === role.toLowerCase())

      if (!newRole) {
        const availableRoles = project.roles.map((r) => r.name).join(', ')
        return errorResponse(`Role not found: ${role}. Available: ${availableRoles}`)
      }

      const previousRoleName = member.role.name

      // Use the API to update the member role (enforces authorization)
      const result = await apiUpdateMemberRole(upperKey, member.id, newRole.id)

      if (result.error) {
        return errorResponse(result.error)
      }

      // Escape user-controlled user and role names
      return textResponse(
        `Changed **${escapeMarkdown(user.name)}**'s role in ${project.key}: ${escapeMarkdown(previousRoleName)} -> ${escapeMarkdown(newRole.name)}`,
      )
    },
  )

  // list_users - List all users in the system
  server.tool(
    'list_users',
    'List all users in the system',
    {
      limit: z.number().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ limit }) => {
      const users = await db.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          isSystemAdmin: true,
          _count: { select: { projects: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
      })

      const lines: string[] = []
      lines.push('# Users')
      lines.push('')
      lines.push('| Name | Username | Email | Admin | Projects |')
      lines.push('|------|----------|-------|-------|----------|')
      for (const u of users) {
        // Escape user-controlled fields for safe table rendering
        const name = safeTableCell(u.name, 30)
        const username = safeTableCell(u.username, 20)
        const email = u.email ? safeTableCell(u.email, 40) : '-'
        lines.push(
          `| ${name} | ${username} | ${email} | ${u.isSystemAdmin ? 'Yes' : '-'} | ${u._count.projects} |`,
        )
      }
      lines.push('')
      lines.push(`Total: ${users.length} user(s)`)

      return textResponse(lines.join('\n'))
    },
  )
}
