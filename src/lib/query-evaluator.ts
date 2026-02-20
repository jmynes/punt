/**
 * Query Evaluator for PUNT tickets.
 *
 * Walks the AST produced by the query parser and filters tickets client-side.
 */

import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import type {
  ASTNode,
  ComparisonNode,
  InNode,
  IsEmptyNode,
  LogicalNode,
  NotNode,
} from './query-parser'

// ============================================================================
// Relative Date Resolution
// ============================================================================

function resolveRelativeDate(value: string): Date {
  const match = value.match(/^-(\d+)([dwmy])$/)
  if (!match) {
    throw new Error(`Invalid relative date: ${value}`)
  }

  const amount = Number.parseInt(match[1], 10)
  const unit = match[2]
  const now = new Date()

  switch (unit) {
    case 'd':
      now.setDate(now.getDate() - amount)
      break
    case 'w':
      now.setDate(now.getDate() - amount * 7)
      break
    case 'm':
      now.setMonth(now.getMonth() - amount)
      break
    case 'y':
      now.setFullYear(now.getFullYear() - amount)
      break
  }

  return now
}

// ============================================================================
// Field Value Extraction
// ============================================================================

interface EvaluationContext {
  statusColumns: ColumnWithTickets[]
  projectKey: string
}

function getColumnName(ticket: TicketWithRelations, ctx: EvaluationContext): string {
  const column = ctx.statusColumns.find((c) => c.id === ticket.columnId)
  return column?.name ?? ''
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function getFieldValue(
  ticket: TicketWithRelations,
  field: string,
  ctx: EvaluationContext,
): string | number | Date | null | string[] {
  switch (field) {
    case 'type':
      return ticket.type
    case 'priority':
      return ticket.priority
    case 'status':
      return getColumnName(ticket, ctx)
    case 'assignee':
      return ticket.assignee?.name ?? null
    case 'reporter':
      return ticket.creator?.name ?? null
    case 'sprint':
      return ticket.sprint?.name ?? null
    case 'labels':
      return ticket.labels.map((l) => l.name)
    case 'storyPoints':
      return ticket.storyPoints ?? null
    case 'estimate':
      return ticket.estimate ?? null
    case 'dueDate':
      return ticket.dueDate ? toDate(ticket.dueDate) : null
    case 'startDate':
      return ticket.startDate ? toDate(ticket.startDate) : null
    case 'created':
      return toDate(ticket.createdAt)
    case 'updated':
      return toDate(ticket.updatedAt)
    case 'resolution':
      return ticket.resolution ?? null
    case 'environment':
      return ticket.environment ?? null
    case 'affectedVersion':
      return ticket.affectedVersion ?? null
    case 'fixVersion':
      return ticket.fixVersion ?? null
    case 'key':
      return `${ctx.projectKey}-${ticket.number}`
    case 'title':
      return ticket.title
    case 'description':
      return ticket.description ?? null
    default:
      return null
  }
}

// ============================================================================
// Comparison Helpers
// ============================================================================

function compareValues(
  fieldValue: string | number | Date | null,
  operator: ComparisonNode['operator'],
  targetValue: string | number | Date,
  valueType: ComparisonNode['valueType'],
): boolean {
  if (fieldValue === null) {
    return operator === '!='
  }

  let resolvedTarget = targetValue
  if (valueType === 'relative_date' && typeof targetValue === 'string') {
    resolvedTarget = resolveRelativeDate(targetValue)
  }

  let a: number | string
  let b: number | string

  if (resolvedTarget instanceof Date || valueType === 'date' || valueType === 'relative_date') {
    const dateA = fieldValue instanceof Date ? fieldValue : new Date(String(fieldValue))
    const dateB = resolvedTarget instanceof Date ? resolvedTarget : new Date(String(resolvedTarget))
    a = dateA.getTime()
    b = dateB.getTime()
  } else if (typeof resolvedTarget === 'number' || valueType === 'number') {
    a = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue)
    b = typeof resolvedTarget === 'number' ? resolvedTarget : Number(resolvedTarget)
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return operator === '!='
    }
  } else {
    a = String(fieldValue).toLowerCase()
    b = String(resolvedTarget).toLowerCase()
  }

  switch (operator) {
    case '=':
      return a === b
    case '!=':
      return a !== b
    case '>':
      return a > b
    case '<':
      return a < b
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    default:
      return false
  }
}

// ============================================================================
// AST Evaluation
// ============================================================================

function evaluateNode(node: ASTNode, ticket: TicketWithRelations, ctx: EvaluationContext): boolean {
  switch (node.type) {
    case 'comparison':
      return evaluateComparison(node, ticket, ctx)
    case 'logical':
      return evaluateLogical(node, ticket, ctx)
    case 'not':
      return evaluateNot(node, ticket, ctx)
    case 'in':
      return evaluateIn(node, ticket, ctx)
    case 'is_empty':
      return evaluateIsEmpty(node, ticket, ctx)
  }
}

function evaluateComparison(
  node: ComparisonNode,
  ticket: TicketWithRelations,
  ctx: EvaluationContext,
): boolean {
  const fieldValue = getFieldValue(ticket, node.field, ctx)

  if (Array.isArray(fieldValue)) {
    if (node.operator === '!=') {
      if (fieldValue.length === 0) return false // no labels means nothing is "not equal to X"
      return fieldValue.every((v) => !compareValues(v, '=', node.value, node.valueType))
    }
    return fieldValue.some((v) => compareValues(v, node.operator, node.value, node.valueType))
  }

  if (node.field === 'key' && node.valueType === 'number') {
    return compareValues(ticket.number, node.operator, node.value, 'number')
  }

  return compareValues(
    fieldValue as string | number | Date | null,
    node.operator,
    node.value,
    node.valueType,
  )
}

function evaluateLogical(
  node: LogicalNode,
  ticket: TicketWithRelations,
  ctx: EvaluationContext,
): boolean {
  const leftResult = evaluateNode(node.left, ticket, ctx)

  if (node.operator === 'AND') {
    if (!leftResult) return false
    return evaluateNode(node.right, ticket, ctx)
  }

  if (leftResult) return true
  return evaluateNode(node.right, ticket, ctx)
}

function evaluateNot(node: NotNode, ticket: TicketWithRelations, ctx: EvaluationContext): boolean {
  return !evaluateNode(node.operand, ticket, ctx)
}

function evaluateIn(node: InNode, ticket: TicketWithRelations, ctx: EvaluationContext): boolean {
  const fieldValue = getFieldValue(ticket, node.field, ctx)

  if (Array.isArray(fieldValue)) {
    const lowerValues = node.values.map((v) => (typeof v === 'string' ? v.toLowerCase() : v))
    const match = fieldValue.some((v) => {
      const lower = typeof v === 'string' ? v.toLowerCase() : v
      return lowerValues.includes(lower)
    })
    return node.negated ? !match : match
  }

  if (fieldValue === null) {
    return node.negated
  }

  const lowerValues = node.values.map((v) => (typeof v === 'string' ? v.toLowerCase() : v))
  const normalizedField = typeof fieldValue === 'string' ? fieldValue.toLowerCase() : fieldValue
  const isIn = lowerValues.includes(normalizedField as string | number)

  return node.negated ? !isIn : isIn
}

function evaluateIsEmpty(
  node: IsEmptyNode,
  ticket: TicketWithRelations,
  ctx: EvaluationContext,
): boolean {
  const fieldValue = getFieldValue(ticket, node.field, ctx)
  const isEmpty =
    fieldValue === null ||
    fieldValue === '' ||
    (Array.isArray(fieldValue) && fieldValue.length === 0)

  return node.negated ? !isEmpty : isEmpty
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Evaluate a parsed query AST against a list of tickets.
 * Returns the filtered list of tickets that match the query.
 */
export function evaluateQuery(
  ast: ASTNode,
  tickets: TicketWithRelations[],
  statusColumns: ColumnWithTickets[],
  projectKey: string,
): TicketWithRelations[] {
  const ctx: EvaluationContext = { statusColumns, projectKey }
  return tickets.filter((ticket) => evaluateNode(ast, ticket, ctx))
}
