import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const SALT_ROUNDS = 12

function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return { valid: errors.length === 0, errors }
}

function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username must be between 3 and 30 characters' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, underscores, and hyphens',
    }
  }
  return { valid: true }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let username: string | undefined
  let password: string | undefined
  let name: string | undefined
  let email: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) {
      username = args[i + 1]
      i++
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1]
      i++
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1]
      i++
    } else if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1]
      i++
    }
  }

  // Validate required arguments
  if (!username || !password || !name) {
    console.error(
      'Usage: pnpm db:seed --username <username> --password <password> --name <name> [--email <email>]',
    )
    console.error('')
    console.error('Creates the first system administrator user.')
    console.error('')
    console.error('Required:')
    console.error(
      '  --username    Username for login (3-30 characters, letters/numbers/underscores/hyphens)',
    )
    console.error('  --password    Password (see requirements below)')
    console.error('  --name        Display name')
    console.error('')
    console.error('Optional:')
    console.error('  --email       Email address')
    console.error('')
    console.error('Password requirements:')
    console.error('  - At least 12 characters')
    console.error('  - At least one uppercase letter')
    console.error('  - At least one lowercase letter')
    console.error('  - At least one number')
    process.exit(1)
  }

  // Validate username
  const usernameValidation = validateUsername(username)
  if (!usernameValidation.valid) {
    console.error(`Error: ${usernameValidation.error}`)
    process.exit(1)
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Error: Invalid email format')
      process.exit(1)
    }
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password)
  if (!passwordValidation.valid) {
    console.error('Error: Password does not meet requirements:')
    for (const error of passwordValidation.errors) {
      console.error(`  - ${error}`)
    }
    process.exit(1)
  }

  // Check if username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  })

  if (existingUser) {
    console.error(`Error: Username "${username}" is already taken`)
    process.exit(1)
  }

  // Check if email already exists (if provided)
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    })
    if (existingEmail) {
      console.error(`Error: Email "${email}" is already in use`)
      process.exit(1)
    }
  }

  // Check if any system admin exists
  const existingAdmin = await prisma.user.findFirst({
    where: { isSystemAdmin: true },
  })

  if (existingAdmin) {
    console.log(`Note: A system admin already exists (${existingAdmin.username})`)
    console.log('Creating additional admin user...')
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  // Create admin user
  const user = await prisma.user.create({
    data: {
      username,
      name,
      email: email || null,
      passwordHash,
      isSystemAdmin: true,
      isActive: true,
    },
  })

  console.log('')
  console.log('System administrator created successfully!')
  console.log('')
  console.log(`  Username: ${user.username}`)
  console.log(`  Name:     ${user.name}`)
  if (user.email) {
    console.log(`  Email:    ${user.email}`)
  }
  console.log(`  ID:       ${user.id}`)
  console.log('')
  console.log('You can now log in at http://localhost:3000/login')
}

main()
  .catch((e) => {
    console.error('Error:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
