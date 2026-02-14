import { PrismaClient } from '@/generated/prisma'
import { enumValidationExtension } from '@/lib/prisma-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PrismaClient initialization with enum validation extension.
// The $extends query API intercepts write operations to validate enum-like
// string fields before they reach SQLite (which has no native enum support).
function createPrismaClient() {
  const client = new PrismaClient().$extends({
    query: enumValidationExtension,
  })
  // Cast back to PrismaClient for type compatibility across the codebase.
  // The extended client is a superset of PrismaClient with identical API.
  return client as unknown as PrismaClient
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
