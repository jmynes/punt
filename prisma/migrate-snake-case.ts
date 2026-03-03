/**
 * Idempotent migration: rename PascalCase/camelCase PostgreSQL identifiers to snake_case.
 *
 * Prisma generates PascalCase table names and camelCase column names by default.
 * This script renames them so `psql` sessions and raw SQL don't require double-quoting.
 *
 * Safe to run multiple times — checks for the old "User" table and skips if not found.
 * All renames happen inside a single transaction (atomic, all-or-nothing).
 *
 * Run with: pnpm db:migrate-names
 * Or automatically via: pnpm db:push (chained before prisma db push)
 */

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Table renames: [oldPascalCase, newSnakeCase]
// ---------------------------------------------------------------------------
const TABLE_RENAMES: [string, string][] = [
  ['User', 'users'],
  ['Account', 'accounts'],
  ['Session', 'sessions'],
  ['RateLimit', 'rate_limits'],
  ['Invitation', 'invitations'],
  ['Project', 'projects'],
  ['ProjectMember', 'project_members'],
  ['Role', 'roles'],
  ['Sprint', 'sprints'],
  ['Column', 'columns'],
  ['Ticket', 'tickets'],
  ['TicketWatcher', 'ticket_watchers'],
  ['TicketLink', 'ticket_links'],
  ['TicketEdit', 'ticket_edits'],
  ['TicketActivity', 'ticket_activities'],
  ['Label', 'labels'],
  ['Comment', 'comments'],
  ['Attachment', 'attachments'],
  ['TicketSprintHistory', 'ticket_sprint_history'],
  ['ProjectSprintSettings', 'project_sprint_settings'],
  ['SystemSettings', 'system_settings'],
  ['PasswordResetToken', 'password_reset_tokens'],
  ['EmailVerificationToken', 'email_verification_tokens'],
  ['ChatSession', 'chat_sessions'],
  ['ChatMessage', 'chat_messages'],
]

// ---------------------------------------------------------------------------
// Column renames: [newTableName, oldCamelCase, newSnakeCase]
// Single-word lowercase columns (id, name, email, etc.) are skipped.
// Already-snake_case Account columns (refresh_token, etc.) are skipped.
// ---------------------------------------------------------------------------
const COLUMN_RENAMES: [string, string, string][] = [
  // users
  ['users', 'avatarColor', 'avatar_color'],
  ['users', 'createdAt', 'created_at'],
  ['users', 'updatedAt', 'updated_at'],
  ['users', 'lastLoginAt', 'last_login_at'],
  ['users', 'passwordHash', 'password_hash'],
  ['users', 'passwordChangedAt', 'password_changed_at'],
  ['users', 'emailVerified', 'email_verified'],
  ['users', 'isSystemAdmin', 'is_system_admin'],
  ['users', 'isActive', 'is_active'],
  ['users', 'totpSecret', 'totp_secret'],
  ['users', 'totpEnabled', 'totp_enabled'],
  ['users', 'totpRecoveryCodes', 'totp_recovery_codes'],
  ['users', 'mcpApiKey', 'mcp_api_key'],
  ['users', 'mcpApiKeyEncrypted', 'mcp_api_key_encrypted'],
  ['users', 'anthropicApiKey', 'anthropic_api_key'],
  ['users', 'chatProvider', 'chat_provider'],
  ['users', 'claudeSessionEncrypted', 'claude_session_encrypted'],
  ['users', 'enabledMcpServers', 'enabled_mcp_servers'],

  // accounts
  ['accounts', 'userId', 'user_id'],
  ['accounts', 'providerAccountId', 'provider_account_id'],

  // sessions
  ['sessions', 'sessionToken', 'session_token'],
  ['sessions', 'userId', 'user_id'],
  ['sessions', 'userAgent', 'user_agent'],
  ['sessions', 'ipAddress', 'ip_address'],
  ['sessions', 'createdAt', 'created_at'],
  ['sessions', 'lastActive', 'last_active'],

  // rate_limits
  ['rate_limits', 'windowStart', 'window_start'],

  // invitations
  ['invitations', 'expiresAt', 'expires_at'],
  ['invitations', 'createdAt', 'created_at'],
  ['invitations', 'senderId', 'sender_id'],
  ['invitations', 'projectId', 'project_id'],

  // projects
  ['projects', 'createdAt', 'created_at'],
  ['projects', 'updatedAt', 'updated_at'],
  ['projects', 'showAddColumnButton', 'show_add_column_button'],
  ['projects', 'repositoryUrl', 'repository_url'],
  ['projects', 'repositoryProvider', 'repository_provider'],
  ['projects', 'localPath', 'local_path'],
  ['projects', 'defaultBranch', 'default_branch'],
  ['projects', 'branchTemplate', 'branch_template'],
  ['projects', 'agentGuidance', 'agent_guidance'],
  ['projects', 'monorepoPath', 'monorepo_path'],
  ['projects', 'environmentBranches', 'environment_branches'],
  ['projects', 'webhookSecret', 'webhook_secret'],
  ['projects', 'commitPatterns', 'commit_patterns'],

  // project_members
  ['project_members', 'roleId', 'role_id'],
  ['project_members', 'userId', 'user_id'],
  ['project_members', 'projectId', 'project_id'],
  ['project_members', 'createdAt', 'created_at'],
  ['project_members', 'updatedAt', 'updated_at'],

  // roles
  ['roles', 'isDefault', 'is_default'],
  ['roles', 'projectId', 'project_id'],
  ['roles', 'createdAt', 'created_at'],
  ['roles', 'updatedAt', 'updated_at'],

  // sprints
  ['sprints', 'startDate', 'start_date'],
  ['sprints', 'endDate', 'end_date'],
  ['sprints', 'completedAt', 'completed_at'],
  ['sprints', 'completedById', 'completed_by_id'],
  ['sprints', 'completedTicketCount', 'completed_ticket_count'],
  ['sprints', 'incompleteTicketCount', 'incomplete_ticket_count'],
  ['sprints', 'completedStoryPoints', 'completed_story_points'],
  ['sprints', 'incompleteStoryPoints', 'incomplete_story_points'],
  ['sprints', 'createdAt', 'created_at'],
  ['sprints', 'updatedAt', 'updated_at'],
  ['sprints', 'projectId', 'project_id'],

  // columns
  ['columns', 'projectId', 'project_id'],

  // tickets
  ['tickets', 'storyPoints', 'story_points'],
  ['tickets', 'startDate', 'start_date'],
  ['tickets', 'dueDate', 'due_date'],
  ['tickets', 'createdAt', 'created_at'],
  ['tickets', 'updatedAt', 'updated_at'],
  ['tickets', 'resolvedAt', 'resolved_at'],
  ['tickets', 'affectedVersion', 'affected_version'],
  ['tickets', 'fixVersion', 'fix_version'],
  ['tickets', 'projectId', 'project_id'],
  ['tickets', 'columnId', 'column_id'],
  ['tickets', 'assigneeId', 'assignee_id'],
  ['tickets', 'creatorId', 'creator_id'],
  ['tickets', 'sprintId', 'sprint_id'],
  ['tickets', 'isCarriedOver', 'is_carried_over'],
  ['tickets', 'carriedFromSprintId', 'carried_from_sprint_id'],
  ['tickets', 'carriedOverCount', 'carried_over_count'],
  ['tickets', 'parentId', 'parent_id'],

  // ticket_watchers
  ['ticket_watchers', 'createdAt', 'created_at'],
  ['ticket_watchers', 'ticketId', 'ticket_id'],
  ['ticket_watchers', 'userId', 'user_id'],

  // ticket_links
  ['ticket_links', 'linkType', 'link_type'],
  ['ticket_links', 'fromTicketId', 'from_ticket_id'],
  ['ticket_links', 'toTicketId', 'to_ticket_id'],
  ['ticket_links', 'createdAt', 'created_at'],

  // ticket_edits
  ['ticket_edits', 'oldValue', 'old_value'],
  ['ticket_edits', 'newValue', 'new_value'],
  ['ticket_edits', 'createdAt', 'created_at'],
  ['ticket_edits', 'ticketId', 'ticket_id'],
  ['ticket_edits', 'userId', 'user_id'],

  // ticket_activities
  ['ticket_activities', 'ticketId', 'ticket_id'],
  ['ticket_activities', 'userId', 'user_id'],
  ['ticket_activities', 'oldValue', 'old_value'],
  ['ticket_activities', 'newValue', 'new_value'],
  ['ticket_activities', 'groupId', 'group_id'],
  ['ticket_activities', 'createdAt', 'created_at'],

  // labels
  ['labels', 'projectId', 'project_id'],

  // comments
  ['comments', 'createdAt', 'created_at'],
  ['comments', 'updatedAt', 'updated_at'],
  ['comments', 'isSystemGenerated', 'is_system_generated'],
  ['comments', 'ticketId', 'ticket_id'],
  ['comments', 'authorId', 'author_id'],

  // attachments
  ['attachments', 'mimeType', 'mime_type'],
  ['attachments', 'createdAt', 'created_at'],
  ['attachments', 'ticketId', 'ticket_id'],
  ['attachments', 'uploaderId', 'uploader_id'],

  // ticket_sprint_history
  ['ticket_sprint_history', 'ticketId', 'ticket_id'],
  ['ticket_sprint_history', 'sprintId', 'sprint_id'],
  ['ticket_sprint_history', 'addedAt', 'added_at'],
  ['ticket_sprint_history', 'removedAt', 'removed_at'],
  ['ticket_sprint_history', 'entryType', 'entry_type'],
  ['ticket_sprint_history', 'exitStatus', 'exit_status'],
  ['ticket_sprint_history', 'carriedFromSprintId', 'carried_from_sprint_id'],

  // project_sprint_settings
  ['project_sprint_settings', 'projectId', 'project_id'],
  ['project_sprint_settings', 'defaultSprintDuration', 'default_sprint_duration'],
  ['project_sprint_settings', 'autoCarryOverIncomplete', 'auto_carry_over_incomplete'],
  ['project_sprint_settings', 'doneColumnIds', 'done_column_ids'],
  ['project_sprint_settings', 'defaultStartTime', 'default_start_time'],
  ['project_sprint_settings', 'defaultEndTime', 'default_end_time'],
  ['project_sprint_settings', 'createdAt', 'created_at'],
  ['project_sprint_settings', 'updatedAt', 'updated_at'],

  // system_settings
  ['system_settings', 'updatedAt', 'updated_at'],
  ['system_settings', 'updatedBy', 'updated_by'],
  ['system_settings', 'appName', 'app_name'],
  ['system_settings', 'logoUrl', 'logo_url'],
  ['system_settings', 'logoLetter', 'logo_letter'],
  ['system_settings', 'logoGradientFrom', 'logo_gradient_from'],
  ['system_settings', 'logoGradientTo', 'logo_gradient_to'],
  ['system_settings', 'maxImageSizeMB', 'max_image_size_mb'],
  ['system_settings', 'maxVideoSizeMB', 'max_video_size_mb'],
  ['system_settings', 'maxDocumentSizeMB', 'max_document_size_mb'],
  ['system_settings', 'maxAttachmentsPerTicket', 'max_attachments_per_ticket'],
  ['system_settings', 'allowedImageTypes', 'allowed_image_types'],
  ['system_settings', 'allowedVideoTypes', 'allowed_video_types'],
  ['system_settings', 'allowedDocumentTypes', 'allowed_document_types'],
  ['system_settings', 'emailEnabled', 'email_enabled'],
  ['system_settings', 'emailProvider', 'email_provider'],
  ['system_settings', 'emailFromAddress', 'email_from_address'],
  ['system_settings', 'emailFromName', 'email_from_name'],
  ['system_settings', 'smtpHost', 'smtp_host'],
  ['system_settings', 'smtpPort', 'smtp_port'],
  ['system_settings', 'smtpUsername', 'smtp_username'],
  ['system_settings', 'smtpSecure', 'smtp_secure'],
  ['system_settings', 'emailPasswordReset', 'email_password_reset'],
  ['system_settings', 'emailWelcome', 'email_welcome'],
  ['system_settings', 'emailVerification', 'email_verification'],
  ['system_settings', 'emailInvitations', 'email_invitations'],
  ['system_settings', 'showAddColumnButton', 'show_add_column_button'],
  ['system_settings', 'defaultRolePermissions', 'default_role_permissions'],
  ['system_settings', 'canonicalRepoUrl', 'canonical_repo_url'],
  ['system_settings', 'repoHostingProvider', 'repo_hosting_provider'],
  ['system_settings', 'forkRepoUrl', 'fork_repo_url'],
  ['system_settings', 'defaultBranchTemplate', 'default_branch_template'],
  ['system_settings', 'defaultAgentGuidance', 'default_agent_guidance'],
  ['system_settings', 'defaultSprintStartTime', 'default_sprint_start_time'],
  ['system_settings', 'defaultSprintEndTime', 'default_sprint_end_time'],

  // password_reset_tokens
  ['password_reset_tokens', 'tokenHash', 'token_hash'],
  ['password_reset_tokens', 'userId', 'user_id'],
  ['password_reset_tokens', 'expiresAt', 'expires_at'],
  ['password_reset_tokens', 'usedAt', 'used_at'],
  ['password_reset_tokens', 'createdAt', 'created_at'],

  // email_verification_tokens
  ['email_verification_tokens', 'tokenHash', 'token_hash'],
  ['email_verification_tokens', 'userId', 'user_id'],
  ['email_verification_tokens', 'expiresAt', 'expires_at'],
  ['email_verification_tokens', 'createdAt', 'created_at'],

  // chat_sessions
  ['chat_sessions', 'createdAt', 'created_at'],
  ['chat_sessions', 'updatedAt', 'updated_at'],
  ['chat_sessions', 'userId', 'user_id'],
  ['chat_sessions', 'projectId', 'project_id'],

  // chat_messages
  ['chat_messages', 'createdAt', 'created_at'],
  ['chat_messages', 'sessionId', 'session_id'],
]

// ---------------------------------------------------------------------------
// Index renames: [oldName, newName]
// Only manually-created indexes need renaming here — Prisma-managed indexes
// are recreated automatically by `prisma db push`.
// ---------------------------------------------------------------------------
const INDEX_RENAMES: [string, string][] = [['User_username_lower_idx', 'users_username_lower_idx']]

async function main() {
  // Check if migration is needed by looking for the old PascalCase "User" table
  const result = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    ) as exists
  `

  if (!result[0]?.exists) {
    console.log('snake_case migration: already applied or fresh database — skipping.')
    return
  }

  console.log(
    `snake_case migration: renaming ${TABLE_RENAMES.length} tables, ${COLUMN_RENAMES.length} columns, ${INDEX_RENAMES.length} indexes...`,
  )

  await prisma.$transaction(async (tx) => {
    // Phase 1: Rename all tables
    for (const [oldName, newName] of TABLE_RENAMES) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${oldName}" RENAME TO ${newName}`)
    }

    // Phase 2: Rename all columns
    for (const [table, oldCol, newCol] of COLUMN_RENAMES) {
      await tx.$executeRawUnsafe(`ALTER TABLE ${table} RENAME COLUMN "${oldCol}" TO ${newCol}`)
    }

    // Phase 3: Rename indexes
    for (const [oldName, newName] of INDEX_RENAMES) {
      await tx.$executeRawUnsafe(`ALTER INDEX "${oldName}" RENAME TO ${newName}`)
    }
  })

  console.log('snake_case migration: complete.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('snake_case migration failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
