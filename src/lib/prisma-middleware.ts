/**
 * Prisma query extension for validating enum-like string fields.
 *
 * SQLite does not enforce enum constraints at the database level,
 * so this extension intercepts create/update operations and validates
 * string fields against their allowed values before they reach the database.
 *
 * Uses Prisma's $extends query API (Prisma 6+) instead of the deprecated $use middleware.
 */
import {
  INVITATION_ROLES,
  INVITATION_STATUSES,
  ISSUE_TYPES,
  LINK_TYPES,
  PRIORITIES,
  RESOLUTIONS,
  SPRINT_ENTRY_TYPES,
  SPRINT_EXIT_STATUSES,
  SPRINT_STATUSES,
} from '@/types'

// ============================================================================
// Validation Definitions
// ============================================================================

/**
 * Map of model names to their enum-like field definitions.
 * Each field has its allowed values and whether null is permitted.
 */
interface FieldValidation {
  readonly allowedValues: readonly string[]
  readonly nullable: boolean
}

type ModelValidations = Record<string, FieldValidation>

const MODEL_VALIDATIONS: Record<string, ModelValidations> = {
  Ticket: {
    type: { allowedValues: ISSUE_TYPES, nullable: false },
    priority: { allowedValues: PRIORITIES, nullable: false },
    resolution: { allowedValues: RESOLUTIONS, nullable: true },
  },
  Sprint: {
    status: { allowedValues: SPRINT_STATUSES, nullable: false },
  },
  Invitation: {
    status: { allowedValues: INVITATION_STATUSES, nullable: false },
    role: { allowedValues: INVITATION_ROLES, nullable: false },
  },
  TicketSprintHistory: {
    entryType: { allowedValues: SPRINT_ENTRY_TYPES, nullable: false },
    exitStatus: { allowedValues: SPRINT_EXIT_STATUSES, nullable: true },
  },
  TicketLink: {
    linkType: { allowedValues: LINK_TYPES, nullable: false },
  },
}

// ============================================================================
// Validation Logic
// ============================================================================

/**
 * Validate a single field value against its allowed values.
 * Throws a descriptive error if the value is invalid.
 */
function validateField(
  model: string,
  field: string,
  value: unknown,
  validation: FieldValidation,
): void {
  // Skip undefined values (field not being set)
  if (value === undefined) return

  // Handle null
  if (value === null) {
    if (!validation.nullable) {
      throw new Error(
        `Invalid value for ${model}.${field}: null is not allowed. ` +
          `Allowed values: ${validation.allowedValues.join(', ')}`,
      )
    }
    return
  }

  // Check that value is a string
  if (typeof value !== 'string') {
    throw new Error(
      `Invalid value for ${model}.${field}: expected a string, got ${typeof value}. ` +
        `Allowed values: ${validation.allowedValues.join(', ')}`,
    )
  }

  // Check against allowed values
  if (!(validation.allowedValues as readonly string[]).includes(value)) {
    throw new Error(
      `Invalid value for ${model}.${field}: "${value}" is not allowed. ` +
        `Allowed values: ${validation.allowedValues.join(', ')}`,
    )
  }
}

/**
 * Extract the data object from various Prisma operation args.
 * Handles create, update, upsert, and createMany operations.
 */
function extractDataObjects(
  action: string,
  args: Record<string, unknown>,
): Record<string, unknown>[] {
  switch (action) {
    case 'create':
      return args.data ? [args.data as Record<string, unknown>] : []
    case 'update':
      return args.data ? [args.data as Record<string, unknown>] : []
    case 'upsert': {
      const results: Record<string, unknown>[] = []
      if (args.create) results.push(args.create as Record<string, unknown>)
      if (args.update) results.push(args.update as Record<string, unknown>)
      return results
    }
    case 'createMany':
    case 'createManyAndReturn': {
      const data = args.data
      if (Array.isArray(data)) {
        return data as Record<string, unknown>[]
      }
      return data ? [data as Record<string, unknown>] : []
    }
    case 'updateMany':
      return args.data ? [args.data as Record<string, unknown>] : []
    default:
      return []
  }
}

/**
 * Validate all enum-like fields in the data objects for a given model.
 */
function validateModelData(model: string, action: string, args: Record<string, unknown>): void {
  const validations = MODEL_VALIDATIONS[model]
  if (!validations) return

  const dataObjects = extractDataObjects(action, args)

  for (const data of dataObjects) {
    for (const [field, validation] of Object.entries(validations)) {
      if (field in data) {
        validateField(model, field, data[field], validation)
      }
    }
  }
}

// ============================================================================
// Prisma Extension
// ============================================================================

/**
 * Write operations that need enum validation.
 */
const WRITE_OPERATIONS = [
  'create',
  'update',
  'upsert',
  'createMany',
  'createManyAndReturn',
  'updateMany',
] as const

/**
 * Create a query handler that validates enum fields before passing to the original query.
 * Used by the Prisma $extends query API.
 */
function createValidatingHandler(modelName: string, operation: string) {
  // biome-ignore lint/suspicious/noExplicitAny: Prisma query extension args are dynamically typed
  return async ({ args, query }: { args: any; query: (args: any) => Promise<any> }) => {
    validateModelData(modelName, operation, args)
    return query(args)
  }
}

/**
 * Build the query extension object for all validated models.
 * Returns an object compatible with Prisma's $extends({ query: ... }) API.
 */
function buildQueryExtension(): Record<
  string,
  Record<string, ReturnType<typeof createValidatingHandler>>
> {
  const queryExt: Record<string, Record<string, ReturnType<typeof createValidatingHandler>>> = {}

  for (const modelName of Object.keys(MODEL_VALIDATIONS)) {
    // Convert PascalCase model name to camelCase for Prisma query API
    const camelName = modelName.charAt(0).toLowerCase() + modelName.slice(1)
    const handlers: Record<string, ReturnType<typeof createValidatingHandler>> = {}

    for (const op of WRITE_OPERATIONS) {
      handlers[op] = createValidatingHandler(modelName, op)
    }

    queryExt[camelName] = handlers
  }

  return queryExt
}

/**
 * Prisma query extension configuration for enum validation.
 * Apply via `prisma.$extends({ query: enumValidationExtension })`.
 */
export const enumValidationExtension = buildQueryExtension()

// Export for testing
export { MODEL_VALIDATIONS, validateField, validateModelData }
