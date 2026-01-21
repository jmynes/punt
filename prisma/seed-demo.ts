import * as fs from 'node:fs'
import * as path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()
const SALT_ROUNDS = 12

// Default password for all demo users: DemoPass123!
const DEFAULT_PASSWORD = 'DemoPass123!'

interface UserConfig {
  username: string
  name: string
  email: string
  isSystemAdmin: boolean
  avatarFile?: string
}

const users: UserConfig[] = [
  {
    username: 'admin',
    name: 'Alex Admin',
    email: 'alex@example.com',
    isSystemAdmin: true,
    avatarFile: 'avatar-blue.png',
  },
  {
    username: 'sarah',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    isSystemAdmin: true,
    avatarFile: 'avatar-purple.png',
  },
  {
    username: 'marcus',
    name: 'Marcus Johnson',
    email: 'marcus@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-green.png',
  },
  {
    username: 'emily',
    name: 'Emily Rodriguez',
    email: 'emily@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-pink.png',
  },
  {
    username: 'david',
    name: 'David Kim',
    email: 'david@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-orange.png',
  },
  {
    username: 'lisa',
    name: 'Lisa Thompson',
    email: 'lisa@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-cyan.png',
  },
  {
    username: 'james',
    name: 'James Wilson',
    email: 'james@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-red.png',
  },
  {
    username: 'anna',
    name: 'Anna Martinez',
    email: 'anna@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-amber.png',
  },
  {
    username: 'michael',
    name: 'Michael Brown',
    email: 'michael@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-indigo.png',
  },
  {
    username: 'jessica',
    name: 'Jessica Lee',
    email: 'jessica@example.com',
    isSystemAdmin: false,
    avatarFile: 'avatar-teal.png',
  },
]

const _projectColors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6']

const labelConfigs = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#22c55e' },
  { name: 'enhancement', color: '#3b82f6' },
  { name: 'documentation', color: '#a855f7' },
  { name: 'performance', color: '#f59e0b' },
  { name: 'security', color: '#dc2626' },
  { name: 'ui/ux', color: '#ec4899' },
  { name: 'backend', color: '#0891b2' },
  { name: 'frontend', color: '#8b5cf6' },
  { name: 'testing', color: '#14b8a6' },
  { name: 'refactor', color: '#64748b' },
  { name: 'blocked', color: '#991b1b' },
  { name: 'help wanted', color: '#16a34a' },
  { name: 'good first issue', color: '#84cc16' },
]

const ticketTitles = {
  bug: [
    'Login form validation not working on Safari',
    'Dashboard charts not rendering on mobile',
    'Search results showing duplicates',
    'Password reset email not sending',
    'File upload fails for large images',
    'Session timeout not redirecting properly',
    'Notification sound plays multiple times',
    'Dark mode toggle not persisting',
    'Export CSV generates corrupted files',
    'User avatar not updating after upload',
    'Pagination breaks with special characters in search',
    'Date picker shows wrong timezone',
    'Form loses data on browser back button',
    'API rate limiting too aggressive',
    'Memory leak in real-time updates',
  ],
  task: [
    'Set up CI/CD pipeline',
    'Configure monitoring and alerting',
    'Update dependencies to latest versions',
    'Write unit tests for auth module',
    'Create database backup strategy',
    'Document API endpoints',
    'Set up staging environment',
    'Configure SSL certificates',
    'Implement logging infrastructure',
    'Create onboarding documentation',
    'Review and update security policies',
    'Set up code review guidelines',
    'Configure automated testing',
    'Create deployment runbook',
    'Set up error tracking service',
  ],
  story: [
    'As a user, I want to export my data',
    'As a user, I want to set up 2FA',
    'As a user, I want to customize notifications',
    'As a user, I want to see activity history',
    'As a user, I want to create custom reports',
    'As a user, I want to collaborate with team members',
    'As a user, I want to integrate with Slack',
    'As a user, I want to bulk edit items',
    'As a user, I want to save custom filters',
    'As a user, I want to schedule recurring tasks',
    'As a user, I want to set task dependencies',
    'As a user, I want to view timeline/Gantt charts',
    'As a user, I want to create project templates',
    'As a user, I want to track time spent on tasks',
    'As a user, I want to generate invoices from time logs',
  ],
  epic: [
    'User Authentication & Authorization Overhaul',
    'Mobile App Development',
    'Performance Optimization Initiative',
    'Reporting & Analytics Dashboard',
    'Third-party Integration Platform',
    'Multi-tenant Architecture',
    'Accessibility Compliance (WCAG 2.1)',
    'Internationalization & Localization',
  ],
  subtask: [
    'Research implementation options',
    'Create technical design document',
    'Write unit tests',
    'Update documentation',
    'Code review and feedback',
    'Deploy to staging',
    'QA testing',
    'Performance benchmarking',
    'Security audit',
    'User acceptance testing',
  ],
}

const descriptions = [
  'This needs to be addressed as soon as possible. Multiple users have reported this issue.',
  'Low priority but would be nice to have. Consider for future sprints.',
  'Critical for the upcoming release. Blocking other work items.',
  'Technical debt that should be cleaned up when time permits.',
  'Feature request from the product team based on user feedback.',
  'Security concern that needs immediate attention.',
  'Performance improvement that will benefit all users.',
  'Documentation update needed for new features.',
  'Refactoring to improve code maintainability.',
  'Bug fix that will resolve intermittent errors.',
  null, // Some tickets have no description
  null,
  'Requested by stakeholders for Q1 delivery.',
  'Part of the ongoing infrastructure improvements.',
  'Follow-up from the last retrospective.',
]

const priorities = ['lowest', 'low', 'medium', 'high', 'highest', 'critical']
const types = ['bug', 'task', 'story', 'epic', 'subtask']
const environments = ['Production', 'Staging', 'Development', 'QA', null]
const storyPointValues = [1, 2, 3, 5, 8, 13, 21, null]
const estimates = ['1h', '2h', '4h', '1d', '2d', '3d', '1w', '2w', null]

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSubset<T>(arr: T[], minCount: number, maxCount: number): T[] {
  const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function generateTicketDescription(_type: string, title: string): string | null {
  const shouldHaveDescription = Math.random() > 0.2 // 80% have descriptions

  if (!shouldHaveDescription) return null

  const templates = [
    `## Summary\n${randomElement(descriptions) || 'No additional details provided.'}\n\n## Acceptance Criteria\n- [ ] Criteria 1\n- [ ] Criteria 2\n- [ ] Criteria 3`,
    `### Problem\nUsers are experiencing issues with ${title.toLowerCase()}.\n\n### Expected Behavior\nThe feature should work correctly without errors.\n\n### Steps to Reproduce\n1. Open the application\n2. Navigate to the affected area\n3. Observe the issue`,
    `**Context:** ${randomElement(descriptions)}\n\n**Technical Notes:**\n- Consider edge cases\n- Ensure backward compatibility\n- Add appropriate tests`,
    randomElement(descriptions) || 'Details to be added.',
  ]

  return randomElement(templates)
}

async function copyAvatarsToPublic() {
  const sampleDir = path.join(__dirname, 'sample-avatars')
  const publicDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars')

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  const files = fs.readdirSync(sampleDir).filter((f) => f.endsWith('.png'))
  for (const file of files) {
    const src = path.join(sampleDir, file)
    const dest = path.join(publicDir, file)
    fs.copyFileSync(src, dest)
  }

  console.log(`Copied ${files.length} avatar files to public/uploads/avatars`)
}

async function main() {
  console.log('🗑️  Clearing existing data...')

  // Delete in correct order to respect foreign keys
  await prisma.ticketSprintHistory.deleteMany()
  await prisma.ticketEdit.deleteMany()
  await prisma.ticketLink.deleteMany()
  await prisma.ticketWatcher.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.label.deleteMany()
  await prisma.sprint.deleteMany()
  await prisma.column.deleteMany()
  await prisma.projectSprintSettings.deleteMany()
  await prisma.invitation.deleteMany()
  await prisma.projectMember.deleteMany()
  await prisma.project.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.rateLimit.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Database cleared')

  // Copy avatars to public directory
  await copyAvatarsToPublic()

  // Create users
  console.log('\n👥 Creating users...')
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS)
  const createdUsers: { id: string; name: string; username: string }[] = []

  for (const userConfig of users) {
    const avatarPath = userConfig.avatarFile ? `/uploads/avatars/${userConfig.avatarFile}` : null

    const user = await prisma.user.create({
      data: {
        username: userConfig.username,
        name: userConfig.name,
        email: userConfig.email,
        passwordHash,
        isSystemAdmin: userConfig.isSystemAdmin,
        isActive: true,
        avatar: avatarPath,
      },
    })
    createdUsers.push({ id: user.id, name: user.name, username: user.username })
    console.log(`  ✓ ${user.name} (${user.username})${userConfig.isSystemAdmin ? ' [ADMIN]' : ''}`)
  }

  // Create projects
  console.log('\n📁 Creating projects...')
  const projectConfigs = [
    {
      name: 'PUNT Development',
      key: 'PUNT',
      description: 'Main project tracker development',
      color: '#6366f1',
    },
    {
      name: 'Mobile App',
      key: 'MOB',
      description: 'iOS and Android mobile application',
      color: '#10b981',
    },
    {
      name: 'API Platform',
      key: 'API',
      description: 'Backend API and infrastructure',
      color: '#f59e0b',
    },
  ]

  const createdProjects: { id: string; name: string; key: string }[] = []

  for (const projectConfig of projectConfigs) {
    const project = await prisma.project.create({
      data: {
        name: projectConfig.name,
        key: projectConfig.key,
        description: projectConfig.description,
        color: projectConfig.color,
      },
    })
    createdProjects.push({ id: project.id, name: project.name, key: project.key })
    console.log(`  ✓ ${project.name} (${project.key})`)
  }

  // Add all users as members to all projects
  console.log('\n👥 Adding project members...')

  for (const project of createdProjects) {
    for (let i = 0; i < createdUsers.length; i++) {
      const user = createdUsers[i]
      const role = i === 0 ? 'owner' : i < 3 ? 'admin' : 'member'

      await prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: project.id,
          role,
        },
      })
    }
    console.log(`  ✓ Added ${createdUsers.length} members to ${project.name}`)
  }

  // Create columns for all projects
  console.log('\n📋 Creating columns...')
  const columnNames = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
  const projectColumns: Record<string, { id: string; name: string }[]> = {}

  for (const project of createdProjects) {
    projectColumns[project.id] = []
    for (let i = 0; i < columnNames.length; i++) {
      const column = await prisma.column.create({
        data: {
          name: columnNames[i],
          order: i,
          projectId: project.id,
        },
      })
      projectColumns[project.id].push({ id: column.id, name: column.name })
    }
    console.log(`  ✓ Created ${columnNames.length} columns for ${project.name}`)
  }

  // Create labels for all projects
  console.log('\n🏷️  Creating labels...')
  const projectLabels: Record<string, { id: string; name: string }[]> = {}

  for (const project of createdProjects) {
    projectLabels[project.id] = []
    for (const labelConfig of labelConfigs) {
      const label = await prisma.label.create({
        data: {
          name: labelConfig.name,
          color: labelConfig.color,
          projectId: project.id,
        },
      })
      projectLabels[project.id].push({ id: label.id, name: label.name })
    }
    console.log(`  ✓ Created ${labelConfigs.length} labels for ${project.name}`)
  }

  // Create sprints for all projects
  console.log('\n🏃 Creating sprints...')
  const now = new Date()
  const sprintConfigs = [
    {
      name: 'Sprint 1 - Foundation',
      goal: 'Set up project infrastructure and basic features',
      status: 'completed',
      startDate: new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Sprint 2 - Core Features',
      goal: 'Implement core user features and authentication',
      status: 'completed',
      startDate: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Sprint 3 - Polish & Performance',
      goal: 'Improve UX and optimize performance',
      status: 'active',
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      name: 'Sprint 4 - Mobile & Integration',
      goal: 'Mobile responsiveness and third-party integrations',
      status: 'planning',
      startDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    },
  ]

  const projectSprints: Record<string, { id: string; name: string; status: string }[]> = {}

  for (const project of createdProjects) {
    projectSprints[project.id] = []
    for (const sprintConfig of sprintConfigs) {
      const sprint = await prisma.sprint.create({
        data: {
          name: sprintConfig.name,
          goal: sprintConfig.goal,
          status: sprintConfig.status,
          startDate: sprintConfig.startDate,
          endDate: sprintConfig.endDate,
          completedAt: sprintConfig.completedAt,
          completedById: sprintConfig.completedAt ? createdUsers[0].id : null,
          projectId: project.id,
        },
      })
      projectSprints[project.id].push({ id: sprint.id, name: sprint.name, status: sprint.status })
    }
    console.log(`  ✓ Created ${sprintConfigs.length} sprints for ${project.name}`)
  }

  // Create tickets for all projects
  console.log('\n🎫 Creating tickets...')
  const projectTicketNumbers: Record<string, number> = {}
  let totalTicketCount = 0

  // Distribution: more tickets in backlog, fewer in done
  const ticketDistribution = [
    { columnIndex: 0, count: 35 }, // Backlog
    { columnIndex: 1, count: 15 }, // To Do
    { columnIndex: 2, count: 12 }, // In Progress
    { columnIndex: 3, count: 8 }, // In Review
    { columnIndex: 4, count: 30 }, // Done
  ]

  for (const project of createdProjects) {
    projectTicketNumbers[project.id] = 1
    const columns = projectColumns[project.id]
    const labels = projectLabels[project.id]
    const sprints = projectSprints[project.id]

    for (const { columnIndex, count } of ticketDistribution) {
      const column = columns[columnIndex]
      for (let i = 0; i < count; i++) {
        const type = randomElement(types)
        const titleList = ticketTitles[type as keyof typeof ticketTitles] || ticketTitles.task
        const title = randomElement(titleList)
        const priority = randomElement(priorities)
        const assignee = Math.random() > 0.3 ? randomElement(createdUsers) : null
        const creator = randomElement(createdUsers)

        // Assign sprint based on column
        let sprint = null
        if (column.name === 'Done') {
          // Done tickets are mostly from completed sprints
          sprint =
            Math.random() > 0.3
              ? randomElement(sprints.filter((s) => s.status === 'completed'))
              : null
        } else if (column.name === 'In Progress' || column.name === 'In Review') {
          // Active work is in current sprint
          sprint = sprints.find((s) => s.status === 'active') || null
        } else if (column.name === 'To Do') {
          // To Do can be current or planning sprint
          sprint =
            Math.random() > 0.5
              ? sprints.find((s) => s.status === 'active')
              : Math.random() > 0.5
                ? sprints.find((s) => s.status === 'planning')
                : null
        }
        // Backlog items typically don't have sprints

        const ticketLabels = randomSubset(labels, 0, 3)

        // Create dates
        const createdAt = new Date(now.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000) // Up to 60 days ago
        const hasDueDate = Math.random() > 0.6
        const dueDate = hasDueDate
          ? new Date(now.getTime() + (Math.random() * 30 - 10) * 24 * 60 * 60 * 1000) // -10 to +20 days from now
          : null

        await prisma.ticket.create({
          data: {
            number: projectTicketNumbers[project.id]++,
            title: `${title}${i > 0 ? ` #${i + 1}` : ''}`, // Add suffix if duplicate title
            description: generateTicketDescription(type, title),
            type,
            priority,
            order: i,
            storyPoints: type !== 'epic' ? randomElement(storyPointValues) : null,
            estimate: randomElement(estimates),
            startDate: column.name !== 'Backlog' && column.name !== 'To Do' ? createdAt : null,
            dueDate,
            environment: type === 'bug' ? randomElement(environments) : null,
            createdAt,
            projectId: project.id,
            columnId: column.id,
            assigneeId: assignee?.id || null,
            creatorId: creator.id,
            sprintId: sprint?.id || null,
            labels: {
              connect: ticketLabels.map((l) => ({ id: l.id })),
            },
          },
        })
        totalTicketCount++
      }
    }
    console.log(`  ✓ Created 100 tickets for ${project.name}`)
  }

  // Create some subtasks for all projects
  console.log('\n📎 Creating subtasks...')
  let subtaskCount = 0

  for (const project of createdProjects) {
    const parentTickets = await prisma.ticket.findMany({
      where: {
        projectId: project.id,
        type: { in: ['story', 'epic', 'task'] },
      },
      take: 15,
    })

    for (const parent of parentTickets) {
      const numSubtasks = Math.floor(Math.random() * 4) + 1 // 1-4 subtasks
      for (let i = 0; i < numSubtasks; i++) {
        await prisma.ticket.create({
          data: {
            number: projectTicketNumbers[project.id]++,
            title: randomElement(ticketTitles.subtask),
            type: 'subtask',
            priority: parent.priority,
            order: i,
            projectId: project.id,
            columnId: parent.columnId,
            assigneeId: parent.assigneeId,
            creatorId: parent.creatorId,
            sprintId: parent.sprintId,
            parentId: parent.id,
          },
        })
        subtaskCount++
        totalTicketCount++
      }
    }
  }
  console.log(`  ✓ Created ${subtaskCount} subtasks across all projects`)

  // Create some comments for all projects
  console.log('\n💬 Creating comments...')
  const commentTemplates = [
    "I'll take a look at this today.",
    'Could you provide more details about the expected behavior?',
    'This is blocked by the database migration.',
    'LGTM! Ready for review.',
    "I've pushed a fix for this. Please review when you get a chance.",
    'This might be related to the issue we saw last week.',
    'Updated the implementation based on feedback.',
    'Can we schedule a quick call to discuss this?',
    'The tests are passing now.',
    'Moved to In Review - ready for QA.',
  ]

  let commentCount = 0
  for (const project of createdProjects) {
    const ticketsForComments = await prisma.ticket.findMany({
      where: { projectId: project.id },
      take: 40,
    })

    for (const ticket of ticketsForComments) {
      const numComments = Math.floor(Math.random() * 4) // 0-3 comments
      for (let i = 0; i < numComments; i++) {
        await prisma.comment.create({
          data: {
            content: randomElement(commentTemplates),
            ticketId: ticket.id,
            authorId: randomElement(createdUsers).id,
            createdAt: new Date(
              ticket.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000,
            ),
          },
        })
        commentCount++
      }
    }
  }
  console.log(`  ✓ Created ${commentCount} comments across all projects`)

  // Create some watchers for all projects
  console.log('\n👀 Creating watchers...')
  let watcherCount = 0
  for (const project of createdProjects) {
    const ticketsForWatchers = await prisma.ticket.findMany({
      where: { projectId: project.id },
      take: 25,
    })

    for (const ticket of ticketsForWatchers) {
      const watchers = randomSubset(createdUsers, 1, 4)
      for (const watcher of watchers) {
        // Don't add creator or assignee as watcher
        if (watcher.id !== ticket.creatorId && watcher.id !== ticket.assigneeId) {
          try {
            await prisma.ticketWatcher.create({
              data: {
                ticketId: ticket.id,
                userId: watcher.id,
              },
            })
            watcherCount++
          } catch {
            // Ignore duplicate errors
          }
        }
      }
    }
  }
  console.log(`  ✓ Created ${watcherCount} watchers across all projects`)

  // Create sprint settings for all projects
  for (const project of createdProjects) {
    const doneColumn = projectColumns[project.id].find((c) => c.name === 'Done')
    await prisma.projectSprintSettings.create({
      data: {
        projectId: project.id,
        defaultSprintDuration: 14,
        autoCarryOverIncomplete: true,
        doneColumnIds: JSON.stringify(doneColumn ? [doneColumn.id] : []),
      },
    })
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('✅ Database seeded successfully!')
  console.log('='.repeat(50))
  console.log(`\n📊 Summary:`)
  console.log(
    `   Users:    ${createdUsers.length} (${users.filter((u) => u.isSystemAdmin).length} admins)`,
  )
  console.log(`   Projects: ${createdProjects.length}`)
  console.log(
    `   Sprints:  ${sprintConfigs.length * createdProjects.length} (${sprintConfigs.length} per project)`,
  )
  console.log(
    `   Labels:   ${labelConfigs.length * createdProjects.length} (${labelConfigs.length} per project)`,
  )
  console.log(`   Tickets:  ${totalTicketCount}`)
  console.log(`   Comments: ${commentCount}`)
  console.log(`   Watchers: ${watcherCount}`)
  console.log(`\n🔑 Login credentials:`)
  console.log(`   All users have password: ${DEFAULT_PASSWORD}`)
  console.log(`\n👤 Admin accounts:`)
  for (const user of users.filter((u) => u.isSystemAdmin)) {
    console.log(`   - ${user.username} (${user.name})`)
  }
  console.log(`\n🌐 Start the app with: pnpm dev`)
  console.log(`   Then login at: http://localhost:3000/login`)
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
