import { PrismaClient } from '../../src/generated/prisma/index.js'

// Use a singleton pattern for the Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
