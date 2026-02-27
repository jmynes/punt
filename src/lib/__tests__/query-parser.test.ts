import { describe, expect, it } from 'vitest'
import {
  type ComparisonNode,
  getAutocompleteContext,
  type InNode,
  type IsEmptyNode,
  type LogicalNode,
  type NotNode,
  parse,
  QueryParseError,
  tokenize,
} from '../query-parser'

// ============================================================================
// Tokenizer Tests
// ============================================================================

describe('tokenize', () => {
  it('tokenizes a simple comparison', () => {
    const tokens = tokenize('priority = high')
    expect(tokens).toHaveLength(4) // FIELD, OPERATOR, VALUE, EOF
    expect(tokens[0]).toMatchObject({ type: 'FIELD', value: 'priority' })
    expect(tokens[1]).toMatchObject({ type: 'OPERATOR', value: '=' })
    expect(tokens[2]).toMatchObject({ type: 'VALUE', value: 'high' })
    expect(tokens[3]).toMatchObject({ type: 'EOF' })
  })

  it('tokenizes quoted strings', () => {
    const tokens = tokenize('assignee = "Jordan Smith"')
    expect(tokens[2]).toMatchObject({ type: 'STRING', value: 'Jordan Smith' })
  })

  it('tokenizes single-quoted strings', () => {
    const tokens = tokenize("title = 'some title'")
    expect(tokens[2]).toMatchObject({ type: 'STRING', value: 'some title' })
  })

  it('tokenizes escaped characters in strings', () => {
    const input = 'title = "hello \\"world\\""'
    const tokens = tokenize(input)
    expect(tokens[2].type).toBe('STRING')
    expect(tokens[2].value).toContain('world')
  })

  it('tokenizes numbers', () => {
    const tokens = tokenize('storyPoints >= 5')
    expect(tokens[2]).toMatchObject({ type: 'NUMBER', value: '5' })
  })

  it('tokenizes dates', () => {
    const tokens = tokenize('dueDate < 2024-12-31')
    expect(tokens[2]).toMatchObject({ type: 'DATE', value: '2024-12-31' })
  })

  it('tokenizes relative dates', () => {
    const tokens = tokenize('created > -7d')
    expect(tokens[2]).toMatchObject({ type: 'RELATIVE_DATE', value: '-7d' })
  })

  it('tokenizes relative dates with weeks', () => {
    const tokens = tokenize('updated > -2w')
    expect(tokens[2]).toMatchObject({ type: 'RELATIVE_DATE', value: '-2w' })
  })

  it('tokenizes relative dates with months', () => {
    const tokens = tokenize('created > -3m')
    expect(tokens[2]).toMatchObject({ type: 'RELATIVE_DATE', value: '-3m' })
  })

  it('tokenizes all operators', () => {
    for (const op of ['=', '!=', '>', '<', '>=', '<=']) {
      const tokens = tokenize(`x ${op} y`)
      expect(tokens[1]).toMatchObject({ type: 'OPERATOR', value: op })
    }
  })

  it('tokenizes AND/OR/NOT keywords', () => {
    const tokens = tokenize('a = 1 AND b = 2 OR NOT c = 3')
    expect(tokens[3]).toMatchObject({ type: 'AND' })
    expect(tokens[7]).toMatchObject({ type: 'OR' })
    expect(tokens[8]).toMatchObject({ type: 'NOT' })
  })

  it('tokenizes IN keyword', () => {
    const tokens = tokenize('type IN (bug, task)')
    expect(tokens[1]).toMatchObject({ type: 'IN' })
    expect(tokens[2]).toMatchObject({ type: 'LPAREN' })
    expect(tokens[3]).toMatchObject({ type: 'VALUE', value: 'bug' })
    expect(tokens[4]).toMatchObject({ type: 'COMMA' })
    expect(tokens[5]).toMatchObject({ type: 'VALUE', value: 'task' })
    expect(tokens[6]).toMatchObject({ type: 'RPAREN' })
  })

  it('tokenizes IS EMPTY', () => {
    const tokens = tokenize('assignee IS EMPTY')
    expect(tokens[1]).toMatchObject({ type: 'IS' })
    expect(tokens[2]).toMatchObject({ type: 'EMPTY' })
  })

  it('tokenizes parentheses', () => {
    const tokens = tokenize('(a = 1)')
    expect(tokens[0]).toMatchObject({ type: 'LPAREN' })
    expect(tokens[4]).toMatchObject({ type: 'RPAREN' })
  })

  it('handles case-insensitive keywords', () => {
    const tokens = tokenize('a = 1 and b = 2')
    expect(tokens[3]).toMatchObject({ type: 'AND', value: 'and' })
  })

  it('records correct positions', () => {
    const tokens = tokenize('priority = high')
    expect(tokens[0]).toMatchObject({ start: 0, end: 8 })
    expect(tokens[1]).toMatchObject({ start: 9, end: 10 })
    expect(tokens[2]).toMatchObject({ start: 11, end: 15 })
  })

  it('treats NULL and NONE as EMPTY tokens', () => {
    const tokens = tokenize('assignee IS NULL')
    expect(tokens[2]).toMatchObject({ type: 'EMPTY', value: 'NULL' })

    const tokens2 = tokenize('assignee IS NONE')
    expect(tokens2[2]).toMatchObject({ type: 'EMPTY', value: 'NONE' })
  })
})

// ============================================================================
// Parser Tests
// ============================================================================

describe('parse', () => {
  describe('simple comparisons', () => {
    it('parses a simple equality comparison', () => {
      const ast = parse('priority = high')
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'priority',
        operator: '=',
        value: 'high',
        valueType: 'string',
      })
    })

    it('parses not-equal comparison', () => {
      const ast = parse('status != "Done"')
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'status',
        operator: '!=',
        value: 'Done',
        valueType: 'string',
      })
    })

    it('parses numeric comparison', () => {
      const ast = parse('storyPoints >= 5')
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'storyPoints',
        operator: '>=',
        value: 5,
        valueType: 'number',
      })
    })

    it('parses date comparison', () => {
      const ast = parse('dueDate < 2024-12-31')
      const node = ast as ComparisonNode
      expect(node.type).toBe('comparison')
      expect(node.field).toBe('dueDate')
      expect(node.operator).toBe('<')
      expect(node.valueType).toBe('date')
    })

    it('parses relative date comparison', () => {
      const ast = parse('created > -7d')
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'created',
        operator: '>',
        value: '-7d',
        valueType: 'relative_date',
      })
    })
  })

  describe('field aliases', () => {
    it('resolves "points" to "storyPoints"', () => {
      const ast = parse('points = 5') as ComparisonNode
      expect(ast.field).toBe('storyPoints')
    })

    it('resolves "label" to "labels"', () => {
      const ast = parse('label = frontend') as ComparisonNode
      expect(ast.field).toBe('labels')
    })

    it('resolves "summary" to "title"', () => {
      const ast = parse('summary = "some text"') as ComparisonNode
      expect(ast.field).toBe('title')
    })
  })

  describe('logical operators', () => {
    it('parses AND', () => {
      const ast = parse('type = bug AND priority = high')
      const node = ast as LogicalNode
      expect(node.type).toBe('logical')
      expect(node.operator).toBe('AND')
      expect((node.left as ComparisonNode).field).toBe('type')
      expect((node.right as ComparisonNode).field).toBe('priority')
    })

    it('parses OR', () => {
      const ast = parse('priority = high OR priority = critical')
      const node = ast as LogicalNode
      expect(node.type).toBe('logical')
      expect(node.operator).toBe('OR')
    })

    it('parses NOT', () => {
      const ast = parse('NOT type = subtask')
      const node = ast as NotNode
      expect(node.type).toBe('not')
      expect((node.operand as ComparisonNode).field).toBe('type')
    })

    it('handles operator precedence (AND before OR)', () => {
      const ast = parse('a = 1 OR b = 2 AND c = 3')
      const node = ast as LogicalNode
      expect(node.operator).toBe('OR')
      // b = 2 AND c = 3 should be grouped together
      expect((node.right as LogicalNode).operator).toBe('AND')
    })

    it('handles implicit AND (no keyword)', () => {
      const ast = parse('type = bug priority = high')
      const node = ast as LogicalNode
      expect(node.type).toBe('logical')
      expect(node.operator).toBe('AND')
    })
  })

  describe('parenthesized expressions', () => {
    it('parses parenthesized expression', () => {
      const ast = parse('(priority = high OR priority = critical) AND type = bug')
      const node = ast as LogicalNode
      expect(node.operator).toBe('AND')
      expect((node.left as LogicalNode).operator).toBe('OR')
    })

    it('handles nested parentheses', () => {
      const ast = parse('((priority = high))')
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'priority',
        operator: '=',
        value: 'high',
      })
    })
  })

  describe('IN operator', () => {
    it('parses IN with values', () => {
      const ast = parse('type IN (bug, task, story)')
      const node = ast as InNode
      expect(node.type).toBe('in')
      expect(node.field).toBe('type')
      expect(node.values).toEqual(['bug', 'task', 'story'])
      expect(node.negated).toBe(false)
    })

    it('parses NOT IN', () => {
      const ast = parse('type NOT IN (epic, subtask)')
      const node = ast as InNode
      expect(node.type).toBe('in')
      expect(node.negated).toBe(true)
      expect(node.values).toEqual(['epic', 'subtask'])
    })

    it('parses IN with quoted strings', () => {
      const ast = parse('assignee IN ("Jordan", "Alex")')
      const node = ast as InNode
      expect(node.values).toEqual(['Jordan', 'Alex'])
    })

    it('parses IN with numbers', () => {
      const ast = parse('storyPoints IN (1, 2, 3, 5)')
      const node = ast as InNode
      expect(node.values).toEqual([1, 2, 3, 5])
    })

    it('parses IN with empty list', () => {
      const ast = parse('type IN ()')
      const node = ast as InNode
      expect(node.values).toEqual([])
    })

    // Lenient parsing tests for incomplete IN lists
    it('parses IN without closing paren', () => {
      const ast = parse('type IN (bug')
      const node = ast as InNode
      expect(node.type).toBe('in')
      expect(node.values).toEqual(['bug'])
      expect(node.negated).toBe(false)
    })

    it('parses IN with trailing comma', () => {
      const ast = parse('type IN (bug,')
      const node = ast as InNode
      expect(node.values).toEqual(['bug'])
    })

    it('parses IN with trailing comma and space', () => {
      const ast = parse('type IN (bug, ')
      const node = ast as InNode
      expect(node.values).toEqual(['bug'])
    })

    it('parses IN with trailing comma before closing paren', () => {
      const ast = parse('type IN (bug, )')
      const node = ast as InNode
      expect(node.values).toEqual(['bug'])
    })

    it('parses IN with multiple values and trailing comma', () => {
      const ast = parse('type IN (bug, task,')
      const node = ast as InNode
      expect(node.values).toEqual(['bug', 'task'])
    })

    it('parses NOT IN without closing paren', () => {
      const ast = parse('type NOT IN (epic')
      const node = ast as InNode
      expect(node.type).toBe('in')
      expect(node.values).toEqual(['epic'])
      expect(node.negated).toBe(true)
    })

    it('parses NOT IN with trailing comma', () => {
      const ast = parse('type NOT IN (epic, subtask,')
      const node = ast as InNode
      expect(node.values).toEqual(['epic', 'subtask'])
      expect(node.negated).toBe(true)
    })
  })

  describe('IS EMPTY / IS NOT EMPTY', () => {
    it('parses IS EMPTY', () => {
      const ast = parse('assignee IS EMPTY')
      const node = ast as IsEmptyNode
      expect(node.type).toBe('is_empty')
      expect(node.field).toBe('assignee')
      expect(node.negated).toBe(false)
    })

    it('parses IS NOT EMPTY', () => {
      const ast = parse('sprint IS NOT EMPTY')
      const node = ast as IsEmptyNode
      expect(node.type).toBe('is_empty')
      expect(node.field).toBe('sprint')
      expect(node.negated).toBe(true)
    })

    it('parses IS NULL', () => {
      const ast = parse('assignee IS NULL')
      const node = ast as IsEmptyNode
      expect(node.type).toBe('is_empty')
      expect(node.negated).toBe(false)
    })
  })

  describe('key, title, and description fields', () => {
    it('parses key with quoted string value', () => {
      const ast = parse('key = "TEST-42"') as ComparisonNode
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'key',
        operator: '=',
        value: 'TEST-42',
        valueType: 'string',
      })
    })

    it('parses key with numeric value', () => {
      const ast = parse('key = 42') as ComparisonNode
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'key',
        operator: '=',
        value: 42,
        valueType: 'number',
      })
    })

    it('parses key with ordering operator', () => {
      const ast = parse('key > "TEST-10"') as ComparisonNode
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'key',
        operator: '>',
        value: 'TEST-10',
      })
    })

    it('parses title with quoted string', () => {
      const ast = parse('title = "login bug"') as ComparisonNode
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'title',
        operator: '=',
        value: 'login bug',
        valueType: 'string',
      })
    })

    it('parses title IS EMPTY', () => {
      const ast = parse('title IS EMPTY') as IsEmptyNode
      expect(ast).toMatchObject({
        type: 'is_empty',
        field: 'title',
        negated: false,
      })
    })

    it('parses description with comparison', () => {
      const ast = parse('description = "some text"') as ComparisonNode
      expect(ast).toMatchObject({
        type: 'comparison',
        field: 'description',
        operator: '=',
        value: 'some text',
      })
    })

    it('parses description IS EMPTY', () => {
      const ast = parse('description IS EMPTY') as IsEmptyNode
      expect(ast).toMatchObject({
        type: 'is_empty',
        field: 'description',
        negated: false,
      })
    })

    it('parses description IS NOT EMPTY', () => {
      const ast = parse('description IS NOT EMPTY') as IsEmptyNode
      expect(ast).toMatchObject({
        type: 'is_empty',
        field: 'description',
        negated: true,
      })
    })
  })

  describe('complex queries', () => {
    it('parses a complex query with AND, OR, and IN', () => {
      const ast = parse(
        'type = bug AND (priority = high OR priority = critical) AND sprint = "Sprint 1"',
      )
      expect(ast.type).toBe('logical')
    })

    it('parses query with multiple conditions', () => {
      const ast = parse(
        'assignee IN ("Jordan", "Alex") AND sprint = "Sprint 1" AND storyPoints >= 3',
      )
      expect(ast.type).toBe('logical')
    })

    it('parses query with NOT and parentheses', () => {
      const ast = parse('NOT (type = subtask OR type = epic)')
      const node = ast as NotNode
      expect(node.type).toBe('not')
      expect((node.operand as LogicalNode).operator).toBe('OR')
    })
  })

  describe('error handling', () => {
    it('throws on empty query', () => {
      expect(() => parse('')).toThrow(QueryParseError)
      expect(() => parse('   ')).toThrow(QueryParseError)
    })

    it('throws on missing operator', () => {
      expect(() => parse('priority high')).toThrow(QueryParseError)
    })

    it('throws on missing value', () => {
      expect(() => parse('priority =')).toThrow(QueryParseError)
    })

    it('throws on unmatched parenthesis', () => {
      expect(() => parse('(priority = high')).toThrow(QueryParseError)
    })

    it('throws on unexpected token after expression', () => {
      expect(() => parse('priority = high )')).toThrow(QueryParseError)
    })

    it('throws on unterminated string', () => {
      expect(() => parse('title = "unclosed')).toThrow(QueryParseError)
      expect(() => parse("title = 'unclosed")).toThrow(QueryParseError)
    })

    it('includes position in error', () => {
      try {
        parse('priority = ')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(QueryParseError)
        expect((err as QueryParseError).position).toBeGreaterThanOrEqual(0)
      }
    })
  })
})

// ============================================================================
// Autocomplete Context Tests
// ============================================================================

describe('getAutocompleteContext', () => {
  it('returns field context for empty input', () => {
    const ctx = getAutocompleteContext('', 0)
    expect(ctx).toMatchObject({ type: 'field', partial: '' })
  })

  it('returns field context when typing a field name', () => {
    const ctx = getAutocompleteContext('pri', 3)
    expect(ctx).toMatchObject({ type: 'field', partial: 'pri' })
  })

  it('returns value context after operator', () => {
    const ctx = getAutocompleteContext('priority = ', 11)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'priority', partial: '' })
  })

  it('returns value context when typing a value', () => {
    const ctx = getAutocompleteContext('priority = hi', 13)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'priority', partial: 'hi' })
  })

  it('returns field context after AND', () => {
    const ctx = getAutocompleteContext('type = bug AND ', 15)
    expect(ctx).toMatchObject({ type: 'field', partial: '' })
  })

  it('returns keyword context after complete comparison', () => {
    const ctx = getAutocompleteContext('type = bug ', 11)
    expect(ctx).toMatchObject({ type: 'keyword', partial: '' })
  })

  it('returns field context after OR', () => {
    const ctx = getAutocompleteContext('type = bug OR ', 14)
    expect(ctx).toMatchObject({ type: 'field', partial: '' })
  })

  it('returns value context after IN (', () => {
    const ctx = getAutocompleteContext('type IN (', 9)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'type', partial: '' })
  })

  it('returns value context after NOT IN (', () => {
    const ctx = getAutocompleteContext('priority NOT IN (', 17)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'priority', partial: '' })
  })

  it('returns value context when typing in IN list', () => {
    const ctx = getAutocompleteContext('type IN (bu', 11)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'type', partial: 'bu' })
  })

  it('returns value context after comma in IN list', () => {
    const ctx = getAutocompleteContext('type IN (bug, ', 14)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'type', partial: '' })
  })

  it('returns value context when typing after comma in IN list', () => {
    const ctx = getAutocompleteContext('type IN (bug, ta', 16)
    expect(ctx).toMatchObject({ type: 'value', fieldName: 'type', partial: 'ta' })
  })
})
