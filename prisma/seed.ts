import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'

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

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let email: string | undefined
  let password: string | undefined
  let name: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1]
      i++
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1]
      i++
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1]
      i++
    }
  }

  // Validate required arguments
  if (!email || !password || !name) {
    console.error('Usage: pnpm db:seed --email <email> --password <password> --name <name>')
    console.error('')
    console.error('Creates the first system administrator user.')
    console.error('')
    console.error('Password requirements:')
    console.error('  - At least 12 characters')
    console.error('  - At least one uppercase letter')
    console.error('  - At least one lowercase letter')
    console.error('  - At least one number')
    process.exit(1)
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error('Error: Invalid email format')
    process.exit(1)
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

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    console.error(`Error: User with email "${email}" already exists`)
    process.exit(1)
  }

  // Check if any system admin exists
  const existingAdmin = await prisma.user.findFirst({
    where: { isSystemAdmin: true },
  })

  if (existingAdmin) {
    console.log(`Note: A system admin already exists (${existingAdmin.email})`)
    console.log('Creating additional admin user...')
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  // Create admin user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      isSystemAdmin: true,
      isActive: true,
    },
  })

  console.log('')
  console.log('System administrator created successfully!')
  console.log('')
  console.log(`  Email: ${user.email}`)
  console.log(`  Name:  ${user.name}`)
  console.log(`  ID:    ${user.id}`)
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
