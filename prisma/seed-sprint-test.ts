import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const SALT_ROUNDS = 12

async function main() {
  console.log('Creating sprint test data...\n')

  // Create test users
  const passwordHash = await bcrypt.hash('TestPassword123', SALT_ROUNDS)

  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'alice' },
      update: {},
      create: {
        username: 'alice',
        name: 'Alice Johnson',
        email: 'alice@test.local',
        passwordHash,
        isSystemAdmin: true,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'bob' },
      update: {},
      create: {
        username: 'bob',
        name: 'Bob Smith',
        email: 'bob@test.local',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'carol' },
      update: {},
      create: {
        username: 'carol',
        name: 'Carol Williams',
        email: 'carol@test.local',
        passwordHash,
        isActive: true,
      },
    }),
  ])

  console.log('Created users:')
  for (const user of users) {
    console.log(`  - ${user.name} (${user.username})`)
  }

  const [alice, bob, carol] = users

  // Create or get test project
  let project = await prisma.project.findUnique({
    where: { key: 'SPRINT' },
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        key: 'SPRINT',
        name: 'Sprint Test Project',
        description: 'A project for testing sprint functionality',
        color: '#3b82f6',
      },
    })
    console.log(`\nCreated project: ${project.name} (${project.key})`)
  } else {
    console.log(`\nUsing existing project: ${project.name} (${project.key})`)
  }

  // Add users as project members
  await Promise.all([
    prisma.projectMember.upsert({
      where: { userId_projectId: { userId: alice.id, projectId: project.id } },
      update: {},
      create: {
        userId: alice.id,
        projectId: project.id,
        role: 'owner',
      },
    }),
    prisma.projectMember.upsert({
      where: { userId_projectId: { userId: bob.id, projectId: project.id } },
      update: {},
      create: {
        userId: bob.id,
        projectId: project.id,
        role: 'admin',
      },
    }),
    prisma.projectMember.upsert({
      where: { userId_projectId: { userId: carol.id, projectId: project.id } },
      update: {},
      create: {
        userId: carol.id,
        projectId: project.id,
        role: 'member',
      },
    }),
  ])

  console.log('\nProject members:')
  console.log('  - Alice (owner)')
  console.log('  - Bob (admin)')
  console.log('  - Carol (member)')

  // Create columns if they don't exist
  const existingColumns = await prisma.column.findMany({
    where: { projectId: project.id },
  })

  let columns = existingColumns
  if (columns.length === 0) {
    const columnData = [
      { name: 'To Do', order: 0 },
      { name: 'In Progress', order: 1 },
      { name: 'Review', order: 2 },
      { name: 'Done', order: 3 },
    ]

    columns = await Promise.all(
      columnData.map((col) =>
        prisma.column.create({
          data: {
            name: col.name,
            order: col.order,
            projectId: project!.id,
          },
        }),
      ),
    )
    console.log('\nCreated columns: To Do, In Progress, Review, Done')
  } else {
    console.log('\nUsing existing columns')
  }

  const todoCol = columns.find((c) => c.name === 'To Do')!
  const inProgressCol = columns.find((c) => c.name === 'In Progress')!
  const reviewCol = columns.find((c) => c.name === 'Review')!
  const doneCol = columns.find((c) => c.name === 'Done')!

  // Create labels
  const labelData = [
    { name: 'frontend', color: '#ec4899' },
    { name: 'backend', color: '#06b6d4' },
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#22c55e' },
    { name: 'documentation', color: '#64748b' },
  ]

  const labels = await Promise.all(
    labelData.map((label) =>
      prisma.label.upsert({
        where: {
          projectId_name: { projectId: project!.id, name: label.name },
        },
        update: {},
        create: {
          name: label.name,
          color: label.color,
          projectId: project!.id,
        },
      }),
    ),
  )

  console.log('\nLabels: frontend, backend, bug, feature, documentation')

  // Create sprints
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  // Delete existing sprints for this project to start fresh
  await prisma.sprint.deleteMany({
    where: { projectId: project.id },
  })

  const sprints = await Promise.all([
    prisma.sprint.create({
      data: {
        name: 'Sprint 1 - Foundation',
        goal: 'Set up project infrastructure and core components',
        status: 'completed',
        startDate: twoWeeksAgo,
        endDate: oneWeekAgo,
        completedAt: oneWeekAgo,
        completedTicketCount: 5,
        incompleteTicketCount: 1,
        completedStoryPoints: 13,
        incompleteStoryPoints: 3,
        projectId: project.id,
      },
    }),
    prisma.sprint.create({
      data: {
        name: 'Sprint 2 - Core Features',
        goal: 'Implement main functionality and user workflows',
        status: 'active',
        startDate: oneWeekAgo,
        endDate: oneWeekFromNow,
        projectId: project.id,
      },
    }),
    prisma.sprint.create({
      data: {
        name: 'Sprint 3 - Polish',
        goal: 'Bug fixes and UX improvements',
        status: 'planning',
        startDate: oneWeekFromNow,
        endDate: twoWeeksFromNow,
        projectId: project.id,
      },
    }),
  ])

  console.log('\nCreated sprints:')
  console.log('  - Sprint 1 - Foundation (completed)')
  console.log('  - Sprint 2 - Core Features (active)')
  console.log('  - Sprint 3 - Polish (planning)')

  const [sprint1, sprint2, sprint3] = sprints

  // Delete existing tickets for this project
  await prisma.ticket.deleteMany({
    where: { projectId: project.id },
  })

  // Create tickets
  const tickets = await Promise.all([
    // Done tickets (from Sprint 1)
    prisma.ticket.create({
      data: {
        number: 1,
        title: 'Set up Next.js project',
        description: 'Initialize the project with Next.js 16, TypeScript, and Tailwind CSS',
        type: 'task',
        priority: 'high',
        storyPoints: 3,
        order: 0,
        projectId: project.id,
        columnId: doneCol.id,
        creatorId: alice.id,
        assigneeId: alice.id,
        sprintId: sprint1.id,
        labels: { connect: [{ id: labels[0].id }] },
      },
    }),
    prisma.ticket.create({
      data: {
        number: 2,
        title: 'Configure Prisma with SQLite',
        description: 'Set up Prisma ORM with SQLite database',
        type: 'task',
        priority: 'high',
        storyPoints: 2,
        order: 1,
        projectId: project.id,
        columnId: doneCol.id,
        creatorId: alice.id,
        assigneeId: bob.id,
        sprintId: sprint1.id,
        labels: { connect: [{ id: labels[1].id }] },
      },
    }),

    // Active sprint tickets
    prisma.ticket.create({
      data: {
        number: 3,
        title: 'Implement user authentication',
        description: 'Add login/register with NextAuth.js',
        type: 'story',
        priority: 'high',
        storyPoints: 5,
        order: 0,
        projectId: project.id,
        columnId: inProgressCol.id,
        creatorId: alice.id,
        assigneeId: bob.id,
        sprintId: sprint2.id,
        labels: { connect: [{ id: labels[1].id }, { id: labels[3].id }] },
      },
    }),
    prisma.ticket.create({
      data: {
        number: 4,
        title: 'Create ticket list component',
        description: 'Build the main ticket listing UI',
        type: 'task',
        priority: 'medium',
        storyPoints: 3,
        order: 1,
        projectId: project.id,
        columnId: reviewCol.id,
        creatorId: bob.id,
        assigneeId: carol.id,
        sprintId: sprint2.id,
        labels: { connect: [{ id: labels[0].id }] },
      },
    }),
    prisma.ticket.create({
      data: {
        number: 5,
        title: 'Add drag and drop for tickets',
        description: 'Implement dnd-kit for Kanban board',
        type: 'story',
        priority: 'medium',
        storyPoints: 5,
        order: 2,
        projectId: project.id,
        columnId: todoCol.id,
        creatorId: alice.id,
        assigneeId: alice.id,
        sprintId: sprint2.id,
        labels: { connect: [{ id: labels[0].id }, { id: labels[3].id }] },
      },
    }),
    prisma.ticket.create({
      data: {
        number: 6,
        title: 'Fix login redirect bug',
        description: 'Users are not redirected after login',
        type: 'bug',
        priority: 'high',
        storyPoints: 2,
        order: 3,
        projectId: project.id,
        columnId: todoCol.id,
        creatorId: carol.id,
        assigneeId: bob.id,
        sprintId: sprint2.id,
        labels: { connect: [{ id: labels[2].id }] },
      },
    }),

    // Backlog tickets (no sprint)
    prisma.ticket.create({
      data: {
        number: 7,
        title: 'Add dark mode support',
        description: 'Implement theme switching with dark mode',
        type: 'story',
        priority: 'low',
        storyPoints: 3,
        order: 0,
        projectId: project.id,
        columnId: todoCol.id,
        creatorId: alice.id,
        sprintId: null,
        labels: { connect: [{ id: labels[0].id }] },
      },
    }),
    prisma.ticket.create({
      data: {
        number: 8,
        title: 'Write API documentation',
        description: 'Document all REST API endpoints',
        type: 'task',
        priority: 'low',
        storyPoints: 2,
        order: 1,
        projectId: project.id,
        columnId: todoCol.id,
        creatorId: bob.id,
        sprintId: null,
        labels: { connect: [{ id: labels[4].id }] },
      },
    }),

    // Sprint 3 tickets (planning)
    prisma.ticket.create({
      data: {
        number: 9,
        title: 'Performance optimization',
        description: 'Optimize render performance and bundle size',
        type: 'task',
        priority: 'medium',
        storyPoints: 5,
        order: 0,
        projectId: project.id,
        columnId: todoCol.id,
        creatorId: alice.id,
        sprintId: sprint3.id,
        labels: { connect: [{ id: labels[0].id }] },
      },
    }),
    prisma.ticket.create({
      data: {
        number: 10,
        title: 'Add keyboard shortcuts',
        description: 'Implement keyboard navigation and shortcuts',
        type: 'story',
        priority: 'low',
        storyPoints: 3,
        order: 1,
        projectId: project.id,
        columnId: todoCol.id,
        creatorId: carol.id,
        sprintId: sprint3.id,
        labels: { connect: [{ id: labels[0].id }, { id: labels[3].id }] },
      },
    }),
  ])

  console.log(`\nCreated ${tickets.length} tickets:`)
  console.log('  - 2 in Done (Sprint 1)')
  console.log('  - 4 in active sprint (Sprint 2)')
  console.log('  - 2 in backlog (no sprint)')
  console.log('  - 2 assigned to Sprint 3 (planning)')

  console.log('\n' + '='.repeat(50))
  console.log('Sprint test data created successfully!')
  console.log('='.repeat(50))
  console.log('\nYou can log in with any of these users:')
  console.log('  Username: alice, bob, or carol')
  console.log('  Password: TestPassword123')
  console.log('\nProject: SPRINT - Sprint Test Project')
  console.log(`  URL: http://localhost:3000/projects/${project.id}/board`)
}

main()
  .catch((e) => {
    console.error('Error:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
