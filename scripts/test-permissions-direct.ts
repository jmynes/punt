/**
 * Direct Permission Testing Script
 *
 * Tests that permissions are correctly enforced using the seeded database.
 * Run with: pnpm tsx scripts/test-permissions-direct.ts
 */

import {
  requireAttachmentPermission,
  requireCommentPermission,
  requireTicketPermission,
} from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  canAssignRole,
  canManageMember,
  getEffectivePermissions,
  hasPermission,
  isMember,
} from '@/lib/permissions'
import { PERMISSIONS } from '@/lib/permissions/constants'

interface TestResult {
  test: string
  expected: boolean
  actual: boolean
  passed: boolean
}

const results: TestResult[] = []

function test(name: string, expected: boolean, actual: boolean) {
  results.push({ test: name, expected, actual, passed: expected === actual })
  const icon = expected === actual ? '✓' : '✗'
  const color = expected === actual ? '\x1b[32m' : '\x1b[31m'
  console.log(`${color}${icon}\x1b[0m ${name}`)
}

async function main() {
  console.log('\n🔐 Direct Permission Tests\n')
  console.log('='.repeat(60))

  // Get test users
  const owner = await db.user.findUnique({ where: { username: 'admin' } })
  const admin = await db.user.findUnique({ where: { username: 'marcus' } })
  const member = await db.user.findUnique({ where: { username: 'emily' } })
  const systemAdmin = await db.user.findUnique({ where: { username: 'sarah' } })

  if (!owner || !admin || !member || !systemAdmin) {
    console.error('❌ Test users not found. Run seed first.')
    process.exit(1)
  }

  console.log(`\nTest users:`)
  console.log(`  Owner: ${owner.username} (isSystemAdmin: ${owner.isSystemAdmin})`)
  console.log(`  Admin: ${admin.username} (isSystemAdmin: ${admin.isSystemAdmin})`)
  console.log(`  Member: ${member.username} (isSystemAdmin: ${member.isSystemAdmin})`)
  console.log(
    `  SystemAdmin: ${systemAdmin.username} (isSystemAdmin: ${systemAdmin.isSystemAdmin})`,
  )

  // Get PUNT project
  const project = await db.project.findFirst({ where: { key: 'PUNT' } })
  if (!project) {
    console.error('❌ PUNT project not found. Run seed first.')
    process.exit(1)
  }

  const projectId = project.id
  console.log(`\nTest project: ${project.name} (${project.key})\n`)

  // ================================
  console.log('='.repeat(60))
  console.log('1. MEMBERSHIP TESTS')
  console.log('='.repeat(60))
  // ================================

  test('Owner is member', true, await isMember(owner.id, projectId))
  test('Admin is member', true, await isMember(admin.id, projectId))
  test('Member is member', true, await isMember(member.id, projectId))
  test('Non-member is not member', false, await isMember('non-existent-user-id', projectId))

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('2. PROJECT SETTINGS PERMISSION')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has project.settings',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.PROJECT_SETTINGS),
  )
  test(
    'Admin has project.settings',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.PROJECT_SETTINGS),
  )
  test(
    'Member lacks project.settings',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.PROJECT_SETTINGS),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('3. PROJECT DELETE PERMISSION')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has project.delete',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.PROJECT_DELETE),
  )
  test(
    'Admin lacks project.delete',
    false,
    await hasPermission(admin.id, projectId, PERMISSIONS.PROJECT_DELETE),
  )
  test(
    'Member lacks project.delete',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.PROJECT_DELETE),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('4. TICKET PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has tickets.create',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.TICKETS_CREATE),
  )
  test(
    'Admin has tickets.create',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.TICKETS_CREATE),
  )
  test(
    'Member has tickets.create',
    true,
    await hasPermission(member.id, projectId, PERMISSIONS.TICKETS_CREATE),
  )

  test(
    'Member has tickets.manage_own',
    true,
    await hasPermission(member.id, projectId, PERMISSIONS.TICKETS_MANAGE_OWN),
  )
  test(
    'Member lacks tickets.manage_any',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.TICKETS_MANAGE_ANY),
  )
  test(
    'Admin has tickets.manage_any',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.TICKETS_MANAGE_ANY),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('5. SPRINT PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has sprints.manage',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.SPRINTS_MANAGE),
  )
  test(
    'Admin has sprints.manage',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.SPRINTS_MANAGE),
  )
  test(
    'Member lacks sprints.manage',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.SPRINTS_MANAGE),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('6. LABEL PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has labels.manage',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.LABELS_MANAGE),
  )
  test(
    'Admin has labels.manage',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.LABELS_MANAGE),
  )
  test(
    'Member lacks labels.manage',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.LABELS_MANAGE),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('7. BOARD PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has board.manage',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.BOARD_MANAGE),
  )
  test(
    'Admin has board.manage',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.BOARD_MANAGE),
  )
  test(
    'Member lacks board.manage',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.BOARD_MANAGE),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('8. MEMBER PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has members.invite',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.MEMBERS_INVITE),
  )
  test(
    'Admin has members.invite',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.MEMBERS_INVITE),
  )
  test(
    'Member lacks members.invite',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.MEMBERS_INVITE),
  )

  test(
    'Owner has members.manage',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.MEMBERS_MANAGE),
  )
  test(
    'Admin has members.manage',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.MEMBERS_MANAGE),
  )
  test(
    'Member lacks members.manage',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.MEMBERS_MANAGE),
  )

  test(
    'Owner has members.admin',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.MEMBERS_ADMIN),
  )
  test(
    'Admin lacks members.admin',
    false,
    await hasPermission(admin.id, projectId, PERMISSIONS.MEMBERS_ADMIN),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('9. MODERATION PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  test(
    'Owner has comments.manage_any',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.COMMENTS_MANAGE_ANY),
  )
  test(
    'Admin has comments.manage_any',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.COMMENTS_MANAGE_ANY),
  )
  test(
    'Member lacks comments.manage_any',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.COMMENTS_MANAGE_ANY),
  )

  test(
    'Owner has attachments.manage_any',
    true,
    await hasPermission(owner.id, projectId, PERMISSIONS.ATTACHMENTS_MANAGE_ANY),
  )
  test(
    'Admin has attachments.manage_any',
    true,
    await hasPermission(admin.id, projectId, PERMISSIONS.ATTACHMENTS_MANAGE_ANY),
  )
  test(
    'Member lacks attachments.manage_any',
    false,
    await hasPermission(member.id, projectId, PERMISSIONS.ATTACHMENTS_MANAGE_ANY),
  )

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('10. SYSTEM ADMIN BYPASS')
  console.log('='.repeat(60))
  // ================================

  // Sarah is system admin + Admin role, should have ALL permissions
  test(
    'System admin (sarah) has project.delete despite Admin role',
    true,
    await hasPermission(systemAdmin.id, projectId, PERMISSIONS.PROJECT_DELETE),
  )
  test(
    'System admin (sarah) has members.admin despite Admin role',
    true,
    await hasPermission(systemAdmin.id, projectId, PERMISSIONS.MEMBERS_ADMIN),
  )

  // System admin on a project they're NOT a member of
  const tempProject = await db.project.create({
    data: { name: 'Temp Test Project', key: `TMP${Date.now()}` },
  })

  test(
    'System admin is virtual member of any project',
    true,
    await isMember(systemAdmin.id, tempProject.id),
  )
  test(
    'System admin has permissions on projects without membership',
    true,
    await hasPermission(systemAdmin.id, tempProject.id, PERMISSIONS.PROJECT_DELETE),
  )

  // Cleanup temp project
  await db.project.delete({ where: { id: tempProject.id } })

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('11. EFFECTIVE PERMISSIONS COUNT')
  console.log('='.repeat(60))
  // ================================

  const memberPermsResult = await getEffectivePermissions(member.id, projectId)
  const memberPerms = memberPermsResult.permissions
  test('Member has exactly 2 permissions', true, memberPerms.size === 2)
  test('Member has tickets.create', true, memberPerms.has(PERMISSIONS.TICKETS_CREATE))
  test('Member has tickets.manage_own', true, memberPerms.has(PERMISSIONS.TICKETS_MANAGE_OWN))

  const adminPermsResult = await getEffectivePermissions(admin.id, projectId)
  const adminPerms = adminPermsResult.permissions
  test('Admin has 11 permissions', true, adminPerms.size === 11)
  test('Admin has project.settings', true, adminPerms.has(PERMISSIONS.PROJECT_SETTINGS))
  test('Admin lacks project.delete', true, !adminPerms.has(PERMISSIONS.PROJECT_DELETE))

  const ownerPermsResult = await getEffectivePermissions(owner.id, projectId)
  const ownerPerms = ownerPermsResult.permissions
  test('Owner has 13 permissions (all)', true, ownerPerms.size === 13)

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('12. MEMBER MANAGEMENT HIERARCHY')
  console.log('='.repeat(60))
  // ================================

  // Get project members
  const ownerMember = await db.projectMember.findFirst({
    where: { projectId, userId: owner.id },
    include: { role: true },
  })
  const adminMember = await db.projectMember.findFirst({
    where: { projectId, userId: admin.id },
    include: { role: true },
  })
  const memberMember = await db.projectMember.findFirst({
    where: { projectId, userId: member.id },
    include: { role: true },
  })

  if (ownerMember && adminMember && memberMember) {
    // canManageMember tests - signature is (actorUserId, targetUserId, projectId)
    test('Owner can manage Admin', true, await canManageMember(owner.id, admin.id, projectId))
    test('Owner can manage Member', true, await canManageMember(owner.id, member.id, projectId))
    test('Admin can manage Member', true, await canManageMember(admin.id, member.id, projectId))
    test('Admin cannot manage Owner', false, await canManageMember(admin.id, owner.id, projectId))
    test('Member cannot manage Admin', false, await canManageMember(member.id, admin.id, projectId))
    test('Owner cannot manage self', false, await canManageMember(owner.id, owner.id, projectId))

    // canAssignRole tests
    if (adminMember.role && memberMember.role && ownerMember.role) {
      test(
        'Owner can assign Admin role',
        true,
        await canAssignRole(owner.id, projectId, adminMember.roleId),
      )
      test(
        'Owner can assign Member role',
        true,
        await canAssignRole(owner.id, projectId, memberMember.roleId),
      )
      test(
        'Admin cannot assign Owner role',
        false,
        await canAssignRole(admin.id, projectId, ownerMember.roleId),
      )
      test(
        'Admin can assign Member role',
        true,
        await canAssignRole(admin.id, projectId, memberMember.roleId),
      )
      test(
        'Member cannot assign any role',
        false,
        await canAssignRole(member.id, projectId, memberMember.roleId),
      )
    }
  }

  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('13. OWNERSHIP-BASED PERMISSIONS')
  console.log('='.repeat(60))
  // ================================

  // Test attachment permissions
  // Member can delete own attachment
  let attachmentTestPassed = false
  try {
    await requireAttachmentPermission(member.id, projectId, member.id, 'delete')
    attachmentTestPassed = true
  } catch {
    attachmentTestPassed = false
  }
  test('Member can delete own attachment', true, attachmentTestPassed)

  // Member cannot delete another's attachment
  attachmentTestPassed = false
  try {
    await requireAttachmentPermission(member.id, projectId, admin.id, 'delete')
    attachmentTestPassed = true
  } catch {
    attachmentTestPassed = false
  }
  test("Member cannot delete other's attachment", false, attachmentTestPassed)

  // Admin can delete any attachment (has attachments.manage_any)
  attachmentTestPassed = false
  try {
    await requireAttachmentPermission(admin.id, projectId, member.id, 'delete')
    attachmentTestPassed = true
  } catch {
    attachmentTestPassed = false
  }
  test('Admin can delete any attachment', true, attachmentTestPassed)

  // Test ticket permissions
  // Member can edit own ticket
  let ticketTestPassed = false
  try {
    await requireTicketPermission(member.id, projectId, member.id, 'edit')
    ticketTestPassed = true
  } catch {
    ticketTestPassed = false
  }
  test('Member can edit own ticket', true, ticketTestPassed)

  // Member cannot edit other's ticket
  ticketTestPassed = false
  try {
    await requireTicketPermission(member.id, projectId, admin.id, 'edit')
    ticketTestPassed = true
  } catch {
    ticketTestPassed = false
  }
  test("Member cannot edit other's ticket", false, ticketTestPassed)

  // Admin can edit any ticket (has tickets.manage_any)
  ticketTestPassed = false
  try {
    await requireTicketPermission(admin.id, projectId, member.id, 'edit')
    ticketTestPassed = true
  } catch {
    ticketTestPassed = false
  }
  test('Admin can edit any ticket', true, ticketTestPassed)

  // Test comment permissions
  // Member can always delete own comment
  let commentTestPassed = false
  try {
    await requireCommentPermission(member.id, projectId, member.id, 'delete')
    commentTestPassed = true
  } catch {
    commentTestPassed = false
  }
  test('Member can delete own comment', true, commentTestPassed)

  // Member cannot delete other's comment
  commentTestPassed = false
  try {
    await requireCommentPermission(member.id, projectId, admin.id, 'delete')
    commentTestPassed = true
  } catch {
    commentTestPassed = false
  }
  test("Member cannot delete other's comment", false, commentTestPassed)

  // Admin can delete any comment (has comments.manage_any)
  commentTestPassed = false
  try {
    await requireCommentPermission(admin.id, projectId, member.id, 'delete')
    commentTestPassed = true
  } catch {
    commentTestPassed = false
  }
  test('Admin can delete any comment', true, commentTestPassed)

  // ================================
  // SUMMARY
  // ================================
  console.log(`\n${'='.repeat(60)}`)
  console.log('SUMMARY')
  console.log('='.repeat(60))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log(`\nTotal: ${results.length} tests`)
  console.log(`\x1b[32mPassed: ${passed}\x1b[0m`)
  console.log(`\x1b[31mFailed: ${failed}\x1b[0m`)

  if (failed > 0) {
    console.log('\n❌ Failed tests:')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.test} (expected: ${r.expected}, got: ${r.actual})`)
      })
    process.exit(1)
  }

  console.log('\n✅ All permission tests passed!\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error running tests:', err)
  process.exit(1)
})
