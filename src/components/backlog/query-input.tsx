'use client'

import { Code2, HelpCircle, Search, X } from 'lucide-react'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type AutocompleteContext,
  FIELD_VALUES,
  getAutocompleteContext,
  parse,
  QUERY_FIELDS,
  QueryParseError,
  type Token,
  tokenize,
} from '@/lib/query-parser'
import { cn } from '@/lib/utils'

interface DynamicValues {
  /** Column/status names from the project */
  statusNames: string[]
  /** Assignee names from tickets */
  assigneeNames: string[]
  /** Sprint names from tickets */
  sprintNames: string[]
  /** Label names from tickets */
  labelNames: string[]
}

interface QueryInputProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  error: string | null
  /** Dynamic values for context-aware autocomplete */
  dynamicValues?: DynamicValues
}

// ============================================================================
// Syntax Highlighting
// ============================================================================

function getTokenClass(token: Token): string {
  switch (token.type) {
    case 'FIELD':
      return 'text-sky-400'
    case 'OPERATOR':
      return 'text-amber-400'
    case 'AND':
    case 'OR':
    case 'NOT':
    case 'IN':
    case 'IS':
      return 'text-purple-400 font-semibold'
    case 'EMPTY':
      return 'text-purple-400 font-semibold'
    case 'STRING':
      return 'text-green-400'
    case 'NUMBER':
      return 'text-orange-400'
    case 'DATE':
    case 'RELATIVE_DATE':
      return 'text-pink-400'
    case 'VALUE':
      return 'text-emerald-400'
    case 'LPAREN':
    case 'RPAREN':
      return 'text-zinc-400'
    case 'COMMA':
      return 'text-zinc-500'
    case 'UNKNOWN':
      return 'text-red-400 underline decoration-wavy'
    default:
      return 'text-zinc-300'
  }
}

function renderHighlightedTokens(input: string): ReactNode[] {
  if (!input) return []

  let tokens: Token[]
  try {
    tokens = tokenize(input)
  } catch {
    return [
      <span key="raw" className="text-zinc-300">
        {input}
      </span>,
    ]
  }

  const parts: ReactNode[] = []
  let lastEnd = 0

  for (const token of tokens) {
    if (token.type === 'EOF') break

    // Add any whitespace between tokens
    if (token.start > lastEnd) {
      parts.push(
        <span key={`ws-${lastEnd}`} className="text-zinc-300">
          {input.slice(lastEnd, token.start)}
        </span>,
      )
    }

    const rawText = input.slice(token.start, token.end)
    parts.push(
      <span key={`t-${token.start}`} className={getTokenClass(token)}>
        {rawText}
      </span>,
    )

    lastEnd = token.end
  }

  // Add trailing text
  if (lastEnd < input.length) {
    parts.push(
      <span key={`trail-${lastEnd}`} className="text-zinc-300">
        {input.slice(lastEnd)}
      </span>,
    )
  }

  return parts
}

// ============================================================================
// Autocomplete Items
// ============================================================================

interface AutocompleteItem {
  label: string
  value: string
  description?: string
}

function getAutocompleteSuggestions(
  ctx: AutocompleteContext | null,
  dynamicValues?: DynamicValues,
): AutocompleteItem[] {
  if (!ctx) return []

  const partial = ctx.partial.toLowerCase()

  if (ctx.type === 'field') {
    const fieldItems: AutocompleteItem[] = QUERY_FIELDS.map((field) => ({
      label: field,
      value: field,
      description: getFieldDescription(field),
    }))

    if (!partial) return fieldItems
    return fieldItems.filter((item) => item.label.toLowerCase().startsWith(partial))
  }

  if (ctx.type === 'value' && ctx.fieldName) {
    const fieldName = ctx.fieldName.toLowerCase()

    // Check for static field values first (type, priority, resolution)
    const canonicalField = Object.entries({
      type: 'type',
      priority: 'priority',
      resolution: 'resolution',
    }).find(([key]) => key === fieldName)?.[1]

    if (canonicalField && FIELD_VALUES[canonicalField]) {
      const items = FIELD_VALUES[canonicalField].map((v) => ({
        label: v,
        value: v,
      }))
      if (!partial) return items
      return items.filter((item) => item.label.toLowerCase().startsWith(partial))
    }

    // Check for dynamic field values
    if (dynamicValues) {
      let values: string[] = []

      if (fieldName === 'status') {
        values = dynamicValues.statusNames
      } else if (fieldName === 'assignee' || fieldName === 'reporter') {
        // Reporter uses the same user pool as assignee
        values = dynamicValues.assigneeNames
      } else if (fieldName === 'sprint') {
        values = dynamicValues.sprintNames
      } else if (fieldName === 'labels' || fieldName === 'label') {
        values = dynamicValues.labelNames
      }

      if (values.length > 0) {
        const items = values.map((v) => ({
          label: v,
          value: v,
        }))
        if (!partial) return items
        return items.filter((item) => item.label.toLowerCase().startsWith(partial))
      }
    }
  }

  if (ctx.type === 'operator') {
    // Field types that support comparison operators (>, <, >=, <=)
    const numericFields = ['storyPoints', 'points', 'estimate']
    const dateFields = ['dueDate', 'startDate', 'created', 'updated']
    // Ordinal fields have ordered values (low < medium < high < critical, Sprint 1 < Sprint 2)
    const ordinalFields = ['priority', 'sprint']
    // Fields that are enums (only =, !=, IN, NOT IN make sense)
    const enumFields = ['type', 'resolution']

    const fieldName = ctx.fieldName?.toLowerCase() ?? ''
    const isNumeric = numericFields.some((f) => f.toLowerCase() === fieldName)
    const isDate = dateFields.some((f) => f.toLowerCase() === fieldName)
    const isOrdinal = ordinalFields.some((f) => f.toLowerCase() === fieldName)
    const isEnum = enumFields.some((f) => f.toLowerCase() === fieldName)
    const supportsComparison = isNumeric || isDate || isOrdinal

    const allOperators = [
      { label: '=', value: '=', description: 'Equals' },
      { label: '!=', value: '!=', description: 'Not equals' },
      { label: 'IN', value: 'IN', description: 'In list of values' },
      { label: 'NOT IN', value: 'NOT IN', description: 'Not in list' },
      { label: 'IS EMPTY', value: 'IS EMPTY', description: 'Has no value' },
      { label: 'IS NOT EMPTY', value: 'IS NOT EMPTY', description: 'Has a value' },
      { label: '>', value: '>', description: 'Greater than' },
      { label: '<', value: '<', description: 'Less than' },
      { label: '>=', value: '>=', description: 'Greater or equal' },
      { label: '<=', value: '<=', description: 'Less or equal' },
    ]

    // Filter operators based on field type
    let operators = allOperators
    if (isEnum) {
      // Enum fields: only equality and list operators
      operators = allOperators.filter((op) => ['=', '!=', 'IN', 'NOT IN'].includes(op.value))
    } else if (!supportsComparison) {
      // String fields: exclude comparison operators
      operators = allOperators.filter((op) => !['>', '<', '>=', '<='].includes(op.value))
    }

    if (!partial) return operators
    return operators.filter((item) => item.label.toLowerCase().startsWith(partial))
  }

  if (ctx.type === 'keyword') {
    const keywords = [
      { label: 'AND', value: 'AND', description: 'Both conditions must match' },
      { label: 'OR', value: 'OR', description: 'Either condition must match' },
    ]
    if (!partial) return keywords
    return keywords.filter((item) => item.label.toLowerCase().startsWith(partial))
  }

  return []
}

function getFieldDescription(field: string): string {
  const descriptions: Record<string, string> = {
    type: 'epic, story, task, bug, subtask',
    priority: 'lowest to critical',
    status: 'Column/status name',
    assignee: 'Assigned user name',
    reporter: 'Creator name',
    sprint: 'Sprint name',
    labels: 'Label names',
    label: 'Alias for labels',
    storyPoints: 'Story points',
    points: 'Alias for storyPoints',
    estimate: 'Time estimate',
    dueDate: 'Due date',
    startDate: 'Start date',
    created: 'Creation date',
    updated: 'Last updated',
    resolution: 'Resolution status',
    parent: 'Parent ticket',
    environment: 'Environment',
    affectedVersion: 'Affected version',
    fixVersion: 'Fix version',
    key: 'Ticket key (e.g. PROJ-1)',
    title: 'Ticket title',
    summary: 'Alias for title',
    description: 'Description text',
  }
  return descriptions[field] ?? ''
}

// ============================================================================
// Query Input Component
// ============================================================================

export function QueryInput({ value, onChange, onClear, error, dynamicValues }: QueryInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [autocompleteCtx, setAutocompleteCtx] = useState<AutocompleteContext | null>(null)

  // Get suggestions
  const suggestions = useMemo(
    () => getAutocompleteSuggestions(autocompleteCtx, dynamicValues),
    [autocompleteCtx, dynamicValues],
  )

  // Update autocomplete context on cursor movement or input change
  const updateAutocomplete = useCallback(() => {
    if (!inputRef.current) return
    const cursorPos = inputRef.current.selectionStart ?? value.length
    const ctx = getAutocompleteContext(value, cursorPos)
    setAutocompleteCtx(ctx)
    setSelectedIndex(0)
  }, [value])

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateAutocomplete recalculates when value changes
  useEffect(() => {
    updateAutocomplete()
  }, [value, updateAutocomplete])

  // Apply autocomplete suggestion
  const applySuggestion = useCallback(
    (item: AutocompleteItem) => {
      if (!autocompleteCtx) return

      const before = value.slice(0, autocompleteCtx.position)
      const after = value.slice(autocompleteCtx.position + autocompleteCtx.partial.length)

      // If the value contains spaces, wrap in quotes (but not for operators)
      const needsQuotes =
        autocompleteCtx.type !== 'operator' &&
        (item.value.includes(' ') || item.value.includes("'"))
      const insertValue = needsQuotes ? `"${item.value}"` : item.value

      // Add appropriate suffix based on context type:
      // - Field names get " " (operator autocomplete will appear next)
      // - Operators: IN/NOT IN get " (" to start list, others get " "
      // - Values and keywords get " "
      let suffix = ' '
      if (autocompleteCtx.type === 'operator') {
        if (item.value === 'IN' || item.value === 'NOT IN') {
          suffix = ' ('
        }
      }

      const newValue = before + insertValue + suffix + after
      onChange(newValue)

      // Keep autocomplete open for:
      // - Field selections (operators come next)
      // - Operator selections (values come next), except IS EMPTY/IS NOT EMPTY which are complete
      const isCompleteOperator = item.value === 'IS EMPTY' || item.value === 'IS NOT EMPTY'
      const keepOpen =
        autocompleteCtx.type === 'field' ||
        (autocompleteCtx.type === 'operator' && !isCompleteOperator)

      if (!keepOpen) {
        setShowAutocomplete(false)
      }

      // Focus input and place cursor after the inserted text
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPos = before.length + insertValue.length + suffix.length
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newPos, newPos)
          // Trigger autocomplete update for the new position
          if (keepOpen) {
            const ctx = getAutocompleteContext(newValue, newPos)
            setAutocompleteCtx(ctx)
            setSelectedIndex(0)
          }
        }
      })
    },
    [autocompleteCtx, value, onChange],
  )

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (showAutocomplete && suggestions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setSelectedIndex((prev) => (prev + 1) % suggestions.length)
            return
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
            return
          case 'Tab':
          case 'Enter':
            if (suggestions[selectedIndex]) {
              e.preventDefault()
              applySuggestion(suggestions[selectedIndex])
              return
            }
            break
          case 'Escape':
            e.preventDefault()
            setShowAutocomplete(false)
            return
        }
      }

      if (e.key === 'Escape' && !showAutocomplete) {
        e.preventDefault()
        onClear()
      }
    },
    [showAutocomplete, suggestions, selectedIndex, applySuggestion, onClear],
  )

  // Validation error from parsing
  const validationError = useMemo(() => {
    if (!value.trim()) return null
    try {
      parse(value)
      return null
    } catch (err) {
      if (err instanceof QueryParseError) {
        return err.message
      }
      return 'Invalid query'
    }
  }, [value])

  const displayError = error ?? validationError

  return (
    <div className="relative flex items-center gap-2" ref={containerRef}>
      {/* Query mode icon */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Code2 className="h-4 w-4 text-purple-400" />
      </div>

      {/* Input wrapper with syntax highlighting overlay */}
      <div className="relative flex-1">
        {/* Syntax highlighting layer (behind the input) */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 py-1 font-mono text-sm"
          style={{ fontVariantLigatures: 'none' }}
          aria-hidden="true"
        >
          <span className="whitespace-pre">{renderHighlightedTokens(value)}</span>
        </div>

        {/* Actual input (transparent text, visible caret) */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setShowAutocomplete(true)
          }}
          onFocus={() => {
            setShowAutocomplete(true)
            updateAutocomplete()
          }}
          onBlur={() => {
            // Delay to allow clicking on autocomplete items
            setTimeout(() => setShowAutocomplete(false), 200)
          }}
          onClick={updateAutocomplete}
          onKeyDown={handleKeyDown}
          placeholder="e.g. priority = high AND type = bug"
          className={cn(
            'h-9 w-full rounded-md border bg-zinc-900/50 px-3 py-1 font-mono text-sm caret-zinc-300 outline-none transition-colors',
            'text-transparent',
            'placeholder:text-zinc-600 placeholder:font-sans',
            displayError
              ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
              : 'border-zinc-800 hover:border-zinc-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30',
          )}
          style={{ fontVariantLigatures: 'none' }}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
        />

        {/* Autocomplete dropdown */}
        {showAutocomplete && suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-72 overflow-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
            {suggestions.map((item, index) => (
              <button
                type="button"
                key={item.value}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors',
                  index === selectedIndex
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-300 hover:bg-zinc-800/50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  applySuggestion(item)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="font-mono text-xs" style={{ fontVariantLigatures: 'none' }}>
                  {item.label}
                </span>
                {item.description && (
                  <span className="ml-2 truncate text-xs text-zinc-500">{item.description}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error tooltip */}
      {displayError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="shrink-0 text-red-400">
              <Search className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-xs border-red-900/50 bg-zinc-900 text-red-300"
          >
            <p className="text-xs">{displayError}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Clear button */}
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 w-7 shrink-0 p-0 text-zinc-400 hover:text-red-400"
          title="Clear query (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* Help button */}
      <QueryHelpButton />
    </div>
  )
}

// ============================================================================
// Help Popover
// ============================================================================

function QueryHelpButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-zinc-500 hover:text-zinc-300"
          title="Query syntax help"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-96 border-zinc-700 bg-zinc-900 p-4"
        style={{ fontVariantLigatures: 'none' }}
      >
        <h4 className="mb-3 text-sm font-medium text-zinc-200">PQL Reference</h4>

        <div className="space-y-3 text-xs">
          <section>
            <h5 className="mb-1 font-medium text-zinc-300">Comparisons</h5>
            <div className="space-y-0.5 font-mono text-zinc-400">
              <p>
                <span className="text-sky-400">priority</span>{' '}
                <span className="text-amber-400">=</span>{' '}
                <span className="text-emerald-400">high</span>
              </p>
              <p>
                <span className="text-sky-400">status</span>{' '}
                <span className="text-amber-400">!=</span>{' '}
                <span className="text-green-400">&quot;Done&quot;</span>
              </p>
              <p>
                <span className="text-sky-400">storyPoints</span>{' '}
                <span className="text-amber-400">&gt;=</span>{' '}
                <span className="text-orange-400">5</span>
              </p>
            </div>
          </section>

          <section>
            <h5 className="mb-1 font-medium text-zinc-300">Logical Operators</h5>
            <div className="space-y-0.5 font-mono text-zinc-400">
              <p>
                <span className="text-sky-400">type</span> <span className="text-amber-400">=</span>{' '}
                <span className="text-emerald-400">bug</span>{' '}
                <span className="text-purple-400 font-semibold">AND</span>{' '}
                <span className="text-sky-400">priority</span>{' '}
                <span className="text-amber-400">=</span>{' '}
                <span className="text-emerald-400">high</span>
              </p>
              <p>
                <span className="text-sky-400">priority</span>{' '}
                <span className="text-amber-400">=</span>{' '}
                <span className="text-emerald-400">high</span>{' '}
                <span className="text-purple-400 font-semibold">OR</span>{' '}
                <span className="text-sky-400">priority</span>{' '}
                <span className="text-amber-400">=</span>{' '}
                <span className="text-emerald-400">critical</span>
              </p>
            </div>
          </section>

          <section>
            <h5 className="mb-1 font-medium text-zinc-300">List Operators</h5>
            <div className="space-y-0.5 font-mono text-zinc-400">
              <p>
                <span className="text-sky-400">assignee</span>{' '}
                <span className="text-purple-400 font-semibold">IN</span>{' '}
                <span className="text-zinc-400">(</span>
                <span className="text-green-400">&quot;Alex&quot;</span>
                <span className="text-zinc-500">,</span>{' '}
                <span className="text-green-400">&quot;Jordan&quot;</span>
                <span className="text-zinc-400">)</span>
              </p>
              <p>
                <span className="text-sky-400">type</span>{' '}
                <span className="text-purple-400 font-semibold">NOT IN</span>{' '}
                <span className="text-zinc-400">(</span>
                <span className="text-emerald-400">epic</span>
                <span className="text-zinc-500">,</span>{' '}
                <span className="text-emerald-400">subtask</span>
                <span className="text-zinc-400">)</span>
              </p>
            </div>
          </section>

          <section>
            <h5 className="mb-1 font-medium text-zinc-300">Date Comparisons</h5>
            <div className="space-y-0.5 font-mono text-zinc-400">
              <p>
                <span className="text-sky-400">dueDate</span>{' '}
                <span className="text-amber-400">&lt;</span>{' '}
                <span className="text-pink-400">2024-12-31</span>
              </p>
              <p>
                <span className="text-sky-400">created</span>{' '}
                <span className="text-amber-400">&gt;</span>{' '}
                <span className="text-pink-400">-7d</span>
                <span className="text-zinc-600"> (7 days ago)</span>
              </p>
              <p>
                <span className="text-sky-400">updated</span>{' '}
                <span className="text-amber-400">&gt;</span>{' '}
                <span className="text-pink-400">-1w</span>
                <span className="text-zinc-600"> (1 week ago)</span>
              </p>
            </div>
          </section>

          <section>
            <h5 className="mb-1 font-medium text-zinc-300">Empty Checks</h5>
            <div className="space-y-0.5 font-mono text-zinc-400">
              <p>
                <span className="text-sky-400">assignee</span>{' '}
                <span className="text-purple-400 font-semibold">IS EMPTY</span>
              </p>
              <p>
                <span className="text-sky-400">sprint</span>{' '}
                <span className="text-purple-400 font-semibold">IS NOT EMPTY</span>
              </p>
            </div>
          </section>

          <section>
            <h5 className="mb-1 font-medium text-zinc-300">Relative Date Units</h5>
            <p className="text-zinc-500">
              <span className="text-pink-400">-Nd</span> days,{' '}
              <span className="text-pink-400">-Nw</span> weeks,{' '}
              <span className="text-pink-400">-Nm</span> months,{' '}
              <span className="text-pink-400">-Ny</span> years
            </p>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  )
}
