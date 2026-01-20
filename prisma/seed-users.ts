import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const firstNames = [
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'William',
  'Mia',
  'James',
  'Charlotte',
  'Benjamin',
  'Amelia',
  'Lucas',
  'Harper',
  'Henry',
  'Evelyn',
  'Alexander',
  'Abigail',
  'Michael',
  'Emily',
  'Daniel',
  'Elizabeth',
  'Jacob',
  'Sofia',
  'Logan',
  'Avery',
  'Jackson',
]

const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
]

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateUsername(firstName: string, lastName: string, index: number): string {
  const variants = [
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${index}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}${index}`,
  ]
  return randomElement(variants)
}

async function main() {
  console.log('Generating 30 random users...\n')

  // Hash a common password for all test users (Password123!)
  const passwordHash = await bcrypt.hash('Password123!', 12)

  const users = []
  const usedEmails = new Set<string>()
  const usedUsernames = new Set<string>()

  for (let i = 0; i < 30; i++) {
    const firstName = randomElement(firstNames)
    const lastName = randomElement(lastNames)
    const name = `${firstName} ${lastName}`

    // Generate unique username
    let username = generateUsername(firstName, lastName, i)
    while (usedUsernames.has(username)) {
      username = `${username}${Math.floor(Math.random() * 100)}`
    }
    usedUsernames.add(username)

    // Generate unique email
    let email = `${username}@example.com`
    while (usedEmails.has(email)) {
      email = `${username}${Math.floor(Math.random() * 100)}@example.com`
    }
    usedEmails.add(email)

    users.push({
      username,
      email,
      name,
      passwordHash,
      isSystemAdmin: i < 2, // First 2 users are admins
      isActive: Math.random() > 0.1, // 90% are active
    })
  }

  // Insert users one by one to handle potential duplicates
  let createdCount = 0
  for (const user of users) {
    try {
      await prisma.user.create({ data: user })
      createdCount++
    } catch (_e) {
      // Skip duplicates
      console.log(`Skipped duplicate: ${user.username}`)
    }
  }

  console.log(`Created ${createdCount} users\n`)
  console.log('Sample users:')
  console.log('─'.repeat(60))

  // Show first 5 users
  const sampleUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      username: true,
      email: true,
      name: true,
      isSystemAdmin: true,
      isActive: true,
    },
  })

  for (const user of sampleUsers) {
    console.log(`  ${user.name}`)
    console.log(`    Username: ${user.username}`)
    console.log(`    Email: ${user.email}`)
    console.log(`    Admin: ${user.isSystemAdmin}, Active: ${user.isActive}`)
    console.log()
  }

  console.log('─'.repeat(60))
  console.log('All test users have password: Password123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
