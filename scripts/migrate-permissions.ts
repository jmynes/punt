/**
 * Permission System Migration Script
 *
 * This script migrates existing ProjectMember records from the old
 * string-based role system to the new Role model with granular permissions.
 *
 * Run with: npx tsx scripts/migrate-permissions.ts
 */

import { PrismaClient } from '../src/generated/prisma'
import { getDefaultRoleConfigs, mapLegacyRoleToDefaultName } from '../src/lib/permissions/presets'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting permission system migration...\n')

  // Get all projects
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      key: true,
    },
  })

  console.log(`Found ${projects.length} project(s) to migrate.\n`)

  const defaultRoleConfigs = getDefaultRoleConfigs()

  for (const project of projects) {
    console.log(`\nMigrating project: ${project.key} (${project.name})`)

    // Check if roles already exist for this project
    const existingRoles = await prisma.role.findMany({
      where: { projectId: project.id },
    })

    if (existingRoles.length > 0) {
      console.log(`  - Roles already exist (${existingRoles.length}), skipping role creation`)
    } else {
      // Create default roles for the project
      console.log('  - Creating default roles...')
      for (const config of defaultRoleConfigs) {
        await prisma.role.create({
          data: {
            name: config.name,
            color: config.color,
            description: config.description,
            permissions: config.permissions,
            isDefault: config.isDefault,
            position: config.position,
            projectId: project.id,
          },
        })
        console.log(`    - Created role: ${config.name}`)
      }
    }

    // Get all roles for the project (including newly created ones)
    const roles = await prisma.role.findMany({
      where: { projectId: project.id },
    })

    // Create a map of role name to role id
    const roleMap = new Map(roles.map((r) => [r.name, r.id]))

    // Get all members for the project that need migration
    // We need to check if they have a valid roleId or not
    // Since the schema changed, we need to handle this carefully
    const members = await prisma.$queryRaw<
      Array<{
        id: string
        role: string | null
        roleId: string | null
        userId: string
      }>
    >`
      SELECT "id", "role", "roleId", "userId" FROM "ProjectMember" WHERE "projectId" = ${project.id}
    `

    console.log(`  - Found ${members.length} member(s)`)

    // Migrate each member
    for (const member of members) {
      // Skip if already has a valid roleId
      if (member.roleId) {
        const roleExists = roles.some((r) => r.id === member.roleId)
        if (roleExists) {
          console.log(`    - Member ${member.id} already migrated`)
          continue
        }
      }

      // Map legacy role to default role name
      const legacyRole = (member.role as string) || 'member'
      const targetRoleName = mapLegacyRoleToDefaultName(legacyRole)
      const targetRoleId = roleMap.get(targetRoleName)

      if (!targetRoleId) {
        console.error(
          `    - ERROR: Could not find role "${targetRoleName}" for member ${member.id}`,
        )
        continue
      }

      // Update member with new roleId
      await prisma.$executeRaw`
        UPDATE "ProjectMember" SET "roleId" = ${targetRoleId} WHERE "id" = ${member.id}
      `
      console.log(`    - Migrated member ${member.id}: "${legacyRole}" -> "${targetRoleName}"`)
    }
  }

  console.log('\n\nMigration completed successfully!')
  console.log('\nNext steps:')
  console.log('1. Run `pnpm db:generate` to regenerate the Prisma client')
  console.log('2. Restart your development server')
  console.log('3. Test the application to ensure all permissions work correctly')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Migration failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
