import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PrismaClient initialization - the generated client may require options but empty object works at runtime
// Using double type assertion to satisfy TypeScript's strict checking
export const db = globalForPrisma.prisma ?? (new PrismaClient({} as never) as PrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
