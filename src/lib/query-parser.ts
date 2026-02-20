/**
 * JQL-like Query Language Parser for PUNT ticket filtering.
 *
 * Supports:
 * - Field comparisons: priority = high, type = bug
 * - Quoted strings: assignee = "Jordan Smith"
 * - Logical operators: AND, OR, NOT
 * - List operators: IN, NOT IN
 * - Comparison operators: =, !=, >, <, >=, <=
 * - Date comparisons: dueDate < 2024-12-31
 * - Relative dates: created > -7d, dueDate < -1w
 * - Parenthesized expressions: (priority = high OR priority = critical) AND type = bug
 * - IS EMPTY / IS NOT EMPTY for null checks
 */

// ============================================================================
// Token Types
// ============================================================================

export type TokenType =
  | 'FIELD'
  | 'OPERATOR'
  | 'VALUE'
  | 'STRING'
  | 'NUMBER'
  | 'DATE'
  | 'RELATIVE_DATE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'IN'
  | 'IS'
  | 'EMPTY'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF'
  | 'UNKNOWN'

export interface Token {
  type: TokenType
  value: string
  start: number
  end: number
}

// ============================================================================
// AST Node Types
// ============================================================================

export type ASTNode = ComparisonNode | LogicalNode | NotNode | InNode | IsEmptyNode

export interface ComparisonNode {
  type: 'comparison'
  field: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<='
  value: string | number | Date
  valueType: 'string' | 'number' | 'date' | 'relative_date'
}

export interface LogicalNode {
  type: 'logical'
  operator: 'AND' | 'OR'
  left: ASTNode
  right: ASTNode
}

export interface NotNode {
  type: 'not'
  operand: ASTNode
}

export interface InNode {
  type: 'in'
  field: string
  values: (string | number)[]
  negated: boolean
}

export interface IsEmptyNode {
  type: 'is_empty'
  field: string
  negated: boolean
}

// ============================================================================
// Known Fields
// ============================================================================

export const QUERY_FIELDS = [
  'type',
  'priority',
  'status',
  'assignee',
  'reporter',
  'sprint',
  'labels',
  'label',
  'storyPoints',
  'points',
  'estimate',
  'dueDate',
  'startDate',
  'created',
  'updated',
  'resolution',
  'environment',
  'affectedVersion',
  'fixVersion',
  'key',
  'title',
  'summary',
  'description',
] as const

export type QueryField = (typeof QUERY_FIELDS)[number]

// Field name aliases mapping to canonical names
const FIELD_ALIASES: Record<string, string> = {
  points: 'storyPoints',
  storypoints: 'storyPoints',
  story_points: 'storyPoints',
  label: 'labels',
  summary: 'title',
  duedate: 'dueDate',
  due_date: 'dueDate',
  startdate: 'startDate',
  start_date: 'startDate',
  affectedversion: 'affectedVersion',
  affected_version: 'affectedVersion',
  fixversion: 'fixVersion',
  fix_version: 'fixVersion',
  createdat: 'created',
  created_at: 'created',
  updatedat: 'updated',
  updated_at: 'updated',
}

function resolveFieldName(name: string): string {
  const lower = name.toLowerCase()
  return FIELD_ALIASES[lower] ?? name
}

// ============================================================================
// Known values for autocomplete
// ============================================================================

export const FIELD_VALUES: Record<string, string[]> = {
  type: ['epic', 'story', 'task', 'bug', 'subtask'],
  priority: ['lowest', 'low', 'medium', 'high', 'highest', 'critical'],
  resolution: ['Done', 'Cannot Reproduce', 'Duplicate', 'Incomplete', "Won't Do", "Won't Fix"],
}

// ============================================================================
// Parser Error
// ============================================================================

export class QueryParseError extends Error {
  public position: number
  public length: number

  constructor(message: string, position: number, length = 1) {
    super(message)
    this.name = 'QueryParseError'
    this.position = position
    this.length = length
  }
}

// ============================================================================
// Tokenizer
// ============================================================================

const OPERATORS = ['!=', '>=', '<=', '=', '>', '<'] as const

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}

function isAlphaNumeric(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch)
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < input.length) {
    // Skip whitespace
    if (isWhitespace(input[pos])) {
      pos++
      continue
    }

    const start = pos

    // Parentheses
    if (input[pos] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', start, end: pos + 1 })
      pos++
      continue
    }
    if (input[pos] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', start, end: pos + 1 })
      pos++
      continue
    }

    // Comma
    if (input[pos] === ',') {
      tokens.push({ type: 'COMMA', value: ',', start, end: pos + 1 })
      pos++
      continue
    }

    // Operators (multi-char first)
    let matchedOp = false
    for (const op of OPERATORS) {
      if (input.slice(pos, pos + op.length) === op) {
        tokens.push({ type: 'OPERATOR', value: op, start, end: pos + op.length })
        pos += op.length
        matchedOp = true
        break
      }
    }
    if (matchedOp) continue

    // Quoted strings
    if (input[pos] === '"' || input[pos] === "'") {
      const quote = input[pos]
      pos++
      let value = ''
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          pos++
          value += input[pos]
        } else {
          value += input[pos]
        }
        pos++
      }
      if (pos >= input.length) {
        throw new QueryParseError(`Unterminated string starting at position ${start}`, start)
      }
      pos++ // skip closing quote
      tokens.push({ type: 'STRING', value, start, end: pos })
      continue
    }

    // Relative dates: -7d, -1w, -1m, -1y
    if (input[pos] === '-' && pos + 1 < input.length && isDigit(input[pos + 1])) {
      pos++
      let numStr = ''
      while (pos < input.length && isDigit(input[pos])) {
        numStr += input[pos]
        pos++
      }
      if (pos < input.length && 'dwmy'.includes(input[pos].toLowerCase())) {
        const unit = input[pos].toLowerCase()
        pos++
        tokens.push({ type: 'RELATIVE_DATE', value: `-${numStr}${unit}`, start, end: pos })
        continue
      }
      // It's a negative number, not a relative date
      tokens.push({ type: 'NUMBER', value: `-${numStr}`, start, end: pos })
      continue
    }

    // Numbers
    if (isDigit(input[pos])) {
      let numStr = ''
      while (pos < input.length && isDigit(input[pos])) {
        numStr += input[pos]
        pos++
      }
      // Check for date format: YYYY-MM-DD
      if (
        numStr.length === 4 &&
        pos < input.length &&
        input[pos] === '-' &&
        pos + 3 <= input.length &&
        isDigit(input[pos + 1]) &&
        isDigit(input[pos + 2]) &&
        input[pos + 3] === '-'
      ) {
        let dateStr = numStr
        dateStr += input[pos] // -
        pos++
        dateStr += input[pos] // M
        pos++
        dateStr += input[pos] // M
        pos++
        if (pos < input.length && input[pos] === '-') {
          dateStr += input[pos] // -
          pos++
          if (pos + 1 < input.length && isDigit(input[pos]) && isDigit(input[pos + 1])) {
            dateStr += input[pos]
            pos++
            dateStr += input[pos]
            pos++
            tokens.push({ type: 'DATE', value: dateStr, start, end: pos })
            continue
          }
        }
        // Fallback to treating the whole thing as a value
        tokens.push({ type: 'VALUE', value: dateStr, start, end: pos })
        continue
      }
      tokens.push({ type: 'NUMBER', value: numStr, start, end: pos })
      continue
    }

    // Identifiers (field names, keywords, and bare values)
    if (isAlpha(input[pos])) {
      let word = ''
      while (pos < input.length && (isAlphaNumeric(input[pos]) || input[pos] === '.')) {
        word += input[pos]
        pos++
      }

      const upper = word.toUpperCase()
      if (upper === 'AND') {
        tokens.push({ type: 'AND', value: word, start, end: pos })
      } else if (upper === 'OR') {
        tokens.push({ type: 'OR', value: word, start, end: pos })
      } else if (upper === 'NOT') {
        tokens.push({ type: 'NOT', value: word, start, end: pos })
      } else if (upper === 'IN') {
        tokens.push({ type: 'IN', value: word, start, end: pos })
      } else if (upper === 'IS') {
        tokens.push({ type: 'IS', value: word, start, end: pos })
      } else if (upper === 'EMPTY' || upper === 'NULL' || upper === 'NONE') {
        tokens.push({ type: 'EMPTY', value: word, start, end: pos })
      } else {
        // Determine if this is a field name or a value
        // If the next non-whitespace character is an operator, IN, IS, or NOT, it's a field
        let nextPos = pos
        while (nextPos < input.length && isWhitespace(input[nextPos])) {
          nextPos++
        }
        const rest = input.slice(nextPos)
        const isField =
          rest.startsWith('=') ||
          rest.startsWith('!') ||
          rest.startsWith('>') ||
          rest.startsWith('<') ||
          rest.toUpperCase().startsWith('IN ') ||
          rest.toUpperCase().startsWith('IN(') ||
          rest.toUpperCase().startsWith('NOT ') ||
          rest.toUpperCase().startsWith('IS ')

        if (isField) {
          tokens.push({ type: 'FIELD', value: word, start, end: pos })
        } else {
          tokens.push({ type: 'VALUE', value: word, start, end: pos })
        }
      }
      continue
    }

    // Unknown character
    tokens.push({ type: 'UNKNOWN', value: input[pos], start, end: pos + 1 })
    pos++
  }

  tokens.push({ type: 'EOF', value: '', start: pos, end: pos })
  return tokens
}

// ============================================================================
// Parser
// ============================================================================

export function parse(input: string): ASTNode {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new QueryParseError('Empty query', 0, 0)
  }

  const tokens = tokenize(trimmed)
  let pos = 0

  function current(): Token {
    return tokens[pos]
  }

  function advance(): Token {
    const token = tokens[pos]
    pos++
    return token
  }

  function expect(type: TokenType, errorMsg?: string): Token {
    const token = current()
    if (token.type !== type) {
      throw new QueryParseError(
        errorMsg ?? `Expected ${type} but got ${token.type} "${token.value}"`,
        token.start,
        Math.max(1, token.end - token.start),
      )
    }
    return advance()
  }

  function parseExpression(): ASTNode {
    return parseOr()
  }

  function parseOr(): ASTNode {
    let left = parseAnd()

    while (current().type === 'OR') {
      advance()
      const right = parseAnd()
      left = { type: 'logical', operator: 'OR', left, right }
    }

    return left
  }

  function parseAnd(): ASTNode {
    let left = parseNot()

    while (current().type === 'AND') {
      advance()
      const right = parseNot()
      left = { type: 'logical', operator: 'AND', left, right }
    }

    // Implicit AND: if the next token is a FIELD or LPAREN or NOT, treat as AND
    while (
      current().type === 'FIELD' ||
      current().type === 'LPAREN' ||
      current().type === 'NOT' ||
      current().type === 'VALUE'
    ) {
      // Check if this VALUE could be a field name (followed by operator)
      if (current().type === 'VALUE') {
        const nextPos = pos + 1
        if (
          nextPos < tokens.length &&
          tokens[nextPos].type !== 'EOF' &&
          (tokens[nextPos].type === 'OPERATOR' ||
            tokens[nextPos].type === 'IN' ||
            tokens[nextPos].type === 'IS' ||
            tokens[nextPos].type === 'NOT')
        ) {
          // Re-classify this VALUE as a FIELD
          tokens[pos] = { ...tokens[pos], type: 'FIELD' }
          const right = parseNot()
          left = { type: 'logical', operator: 'AND', left, right }
          continue
        }
        break
      }
      const right = parseNot()
      left = { type: 'logical', operator: 'AND', left, right }
    }

    return left
  }

  function parseNot(): ASTNode {
    if (current().type === 'NOT') {
      // Check if this is NOT IN (look ahead to see if there's no field before)
      advance()
      if (current().type === 'IN') {
        // This is "field NOT IN (...)" - but we've already parsed "field" in the parent
        // Roll back - NOT IN is handled in parsePrimary
        pos--
        return parsePrimary()
      }
      const operand = parseNot()
      return { type: 'not', operand }
    }
    return parsePrimary()
  }

  function parsePrimary(): ASTNode {
    // Parenthesized expression
    if (current().type === 'LPAREN') {
      advance()
      const expr = parseExpression()
      expect('RPAREN', 'Expected closing parenthesis ")"')
      return expr
    }

    // Field comparison or IN expression
    if (current().type === 'FIELD' || current().type === 'VALUE') {
      const fieldToken = advance()
      const field = resolveFieldName(fieldToken.value)

      // IS EMPTY / IS NOT EMPTY
      if (current().type === 'IS') {
        advance()
        const negated = current().type === 'NOT'
        if (negated) advance()
        expect('EMPTY', `Expected "EMPTY" after "IS${negated ? ' NOT' : ''}"`)
        return { type: 'is_empty', field, negated }
      }

      // NOT IN
      if (current().type === 'NOT') {
        advance()
        expect('IN', 'Expected "IN" after "NOT"')
        expect('LPAREN', 'Expected "(" after "NOT IN"')
        const values = parseValueList()
        expect('RPAREN', 'Expected closing parenthesis ")"')
        return { type: 'in', field, values, negated: true }
      }

      // IN (...)
      if (current().type === 'IN') {
        advance()
        expect('LPAREN', 'Expected "(" after "IN"')
        const values = parseValueList()
        expect('RPAREN', 'Expected closing parenthesis ")"')
        return { type: 'in', field, values, negated: false }
      }

      // Comparison
      const opToken = expect('OPERATOR', `Expected operator after "${field}"`)
      const operator = opToken.value as ComparisonNode['operator']

      const valueToken = current()
      let value: string | number | Date
      let valueType: ComparisonNode['valueType'] = 'string'

      if (valueToken.type === 'STRING') {
        value = valueToken.value
        valueType = 'string'
        advance()
      } else if (valueToken.type === 'NUMBER') {
        value = Number(valueToken.value)
        valueType = 'number'
        advance()
      } else if (valueToken.type === 'DATE') {
        value = new Date(valueToken.value)
        valueType = 'date'
        advance()
      } else if (valueToken.type === 'RELATIVE_DATE') {
        value = valueToken.value
        valueType = 'relative_date'
        advance()
      } else if (
        valueToken.type === 'VALUE' ||
        valueToken.type === 'FIELD' ||
        valueToken.type === 'EMPTY'
      ) {
        value = valueToken.value
        valueType = 'string'
        advance()
      } else {
        throw new QueryParseError(
          `Expected a value after "${operator}"`,
          valueToken.start,
          Math.max(1, valueToken.end - valueToken.start),
        )
      }

      return { type: 'comparison', field, operator, value, valueType }
    }

    const token = current()
    throw new QueryParseError(
      `Unexpected token "${token.value}"`,
      token.start,
      Math.max(1, token.end - token.start),
    )
  }

  function parseValueList(): (string | number)[] {
    const values: (string | number)[] = []

    // Parse first value
    const first = current()
    if (first.type === 'STRING') {
      values.push(first.value)
      advance()
    } else if (first.type === 'NUMBER') {
      values.push(Number(first.value))
      advance()
    } else if (first.type === 'VALUE' || first.type === 'FIELD') {
      values.push(first.value)
      advance()
    } else if (first.type === 'RPAREN') {
      // Empty list
      return values
    } else {
      throw new QueryParseError(
        `Expected value in list but got "${first.value}"`,
        first.start,
        Math.max(1, first.end - first.start),
      )
    }

    // Parse remaining values
    while (current().type === 'COMMA') {
      advance() // skip comma
      const valToken = current()
      if (valToken.type === 'STRING') {
        values.push(valToken.value)
        advance()
      } else if (valToken.type === 'NUMBER') {
        values.push(Number(valToken.value))
        advance()
      } else if (valToken.type === 'VALUE' || valToken.type === 'FIELD') {
        values.push(valToken.value)
        advance()
      } else {
        throw new QueryParseError(
          `Expected value after "," but got "${valToken.value}"`,
          valToken.start,
          Math.max(1, valToken.end - valToken.start),
        )
      }
    }

    return values
  }

  const ast = parseExpression()

  // Ensure we consumed all tokens
  if (current().type !== 'EOF') {
    const remaining = current()
    throw new QueryParseError(
      `Unexpected token "${remaining.value}" after expression`,
      remaining.start,
      Math.max(1, remaining.end - remaining.start),
    )
  }

  return ast
}

// ============================================================================
// Helpers for autocomplete
// ============================================================================

export interface AutocompleteContext {
  type: 'field' | 'operator' | 'value' | 'keyword'
  fieldName?: string
  partial: string
  position: number
}

/**
 * Analyze the cursor position in the input to determine autocomplete context.
 */
export function getAutocompleteContext(
  input: string,
  cursorPosition: number,
): AutocompleteContext | null {
  const textBefore = input.slice(0, cursorPosition)
  const trimmed = textBefore.trimEnd()

  // If the text is empty, suggest fields
  if (!trimmed) {
    return { type: 'field', partial: '', position: 0 }
  }

  // Tokenize what we have so far
  let tokens: Token[]
  try {
    tokens = tokenize(trimmed)
  } catch {
    return null
  }

  // Remove EOF token
  const meaningful = tokens.filter((t) => t.type !== 'EOF')
  if (meaningful.length === 0) {
    return { type: 'field', partial: '', position: 0 }
  }

  const last = meaningful[meaningful.length - 1]

  // Check if we're in the middle of typing (cursor is right at/within the last token).
  // If there's trailing whitespace after the last token (i.e., textBefore is longer than
  // trimmed), the user has finished typing that token and moved on.
  const hasTrailingSpace = textBefore.length > trimmed.length
  const isTyping = last.end >= trimmed.length && !hasTrailingSpace

  // If the last token is an operator, suggest values
  if (last.type === 'OPERATOR') {
    const fieldToken = meaningful.length >= 2 ? meaningful[meaningful.length - 2] : null
    return {
      type: 'value',
      fieldName: fieldToken?.value,
      partial: '',
      position: cursorPosition,
    }
  }

  // If the last token is AND/OR/NOT/LPAREN, suggest fields
  if (last.type === 'AND' || last.type === 'OR' || last.type === 'NOT' || last.type === 'LPAREN') {
    return { type: 'field', partial: '', position: cursorPosition }
  }

  // If the last token is IN, no autocomplete needed
  if (last.type === 'IN') {
    return null
  }

  // If the last token is a field/value and we're still typing, determine context
  if ((last.type === 'FIELD' || last.type === 'VALUE') && isTyping) {
    // Check if the token before this is an operator
    const prev = meaningful.length >= 2 ? meaningful[meaningful.length - 2] : null
    if (prev?.type === 'OPERATOR') {
      // We're typing a value
      const fieldToken = meaningful.length >= 3 ? meaningful[meaningful.length - 3] : null
      return {
        type: 'value',
        fieldName: fieldToken?.value,
        partial: last.value,
        position: last.start,
      }
    }
    if (prev?.type === 'COMMA') {
      // We're typing a value in a list
      let fieldName: string | undefined
      for (let i = meaningful.length - 3; i >= 0; i--) {
        if (meaningful[i].type === 'FIELD') {
          fieldName = meaningful[i].value
          break
        }
      }
      return {
        type: 'value',
        fieldName,
        partial: last.value,
        position: last.start,
      }
    }
    // We're typing a field name
    return { type: 'field', partial: last.value, position: last.start }
  }

  // After a complete comparison, suggest AND/OR
  if (
    last.type === 'VALUE' ||
    last.type === 'STRING' ||
    last.type === 'NUMBER' ||
    last.type === 'DATE' ||
    last.type === 'RELATIVE_DATE' ||
    last.type === 'RPAREN' ||
    last.type === 'EMPTY'
  ) {
    if (!isTyping) {
      return { type: 'keyword', partial: '', position: cursorPosition }
    }
  }

  return null
}
