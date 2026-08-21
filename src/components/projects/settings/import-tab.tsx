'use client'

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { getTabId } from '@/hooks/use-realtime'
import { autoDetectAndParse, parseJiraCsv } from '@/lib/import'
import type { ImportResult, ParsedTicket, ParseResult } from '@/lib/import/types'
import { showToast } from '@/lib/toast'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'

interface ImportTabProps {
  projectId: string
}

type ImportStage = 'upload' | 'preview' | 'importing' | 'complete'

const TYPE_COLORS: Record<string, string> = {
  epic: 'bg-purple-500/20 text-purple-400',
  story: 'bg-green-500/20 text-green-400',
  task: 'bg-blue-500/20 text-blue-400',
  bug: 'bg-red-500/20 text-red-400',
  subtask: 'bg-zinc-500/20 text-zinc-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  highest: 'text-orange-400',
  high: 'text-amber-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
  lowest: 'text-zinc-400',
}

export function ImportTab({ projectId }: ImportTabProps) {
  const [stage, setStage] = useState<ImportStage>('upload')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set())
  const [columnId, setColumnId] = useState<string>('')
  const [sprintId, setSprintId] = useState<string | null>(null)
  const [createMissingLabels, setCreateMissingLabels] = useState(true)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get columns and sprints from stores
  const columns = useBoardStore((s) => s.getColumns(projectId))
  const { getProjectByKey, getProject } = useProjectsStore()
  const project = getProject(projectId) ?? getProjectByKey(projectId)
  const projectKey = project?.key ?? projectId

  // Get sprints from the project data (use board store columns for column list)
  // We'll fetch sprints from the API in a simpler way

  // Set default column to the first column if not set
  const firstColumnId = columns[0]?.id ?? ''

  const handleFileSelect = useCallback(
    async (file: File) => {
      setFileName(file.name)
      const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'

      try {
        const text = await file.text()

        let result: ParseResult

        if (isCSV) {
          result = parseJiraCsv(text)
        } else {
          // Try to parse as JSON
          let data: unknown
          try {
            data = JSON.parse(text)
          } catch {
            showToast.error('Invalid file format. Please upload a JSON or CSV file.')
            return
          }
          result = autoDetectAndParse(data)
        }

        if (result.tickets.length === 0) {
          showToast.error(
            result.warnings.length > 0 ? result.warnings[0] : 'No tickets found in the file',
          )
          return
        }

        setParseResult(result)
        // Select all tickets by default
        setSelectedTickets(new Set(result.tickets.map((_, i) => i)))
        setColumnId(firstColumnId)
        setStage('preview')

        if (result.warnings.length > 0) {
          showToast.warning(
            `Parsed ${result.tickets.length} tickets with ${result.warnings.length} warning(s)`,
          )
        } else {
          showToast.success(
            `Found ${result.tickets.length} tickets from ${result.source === 'jira' ? 'Jira' : 'GitHub'}`,
          )
        }
      } catch {
        showToast.error('Failed to read the file')
      }
    },
    [firstColumnId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [handleFileSelect],
  )

  const toggleTicket = useCallback((index: number) => {
    setSelectedTickets((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!parseResult) return
    setSelectedTickets(new Set(parseResult.tickets.map((_, i) => i)))
  }, [parseResult])

  const selectNone = useCallback(() => {
    setSelectedTickets(new Set())
  }, [])

  const handleImport = useCallback(async () => {
    if (!parseResult || selectedTickets.size === 0 || !columnId) return

    const ticketsToImport = parseResult.tickets.filter((_, i) => selectedTickets.has(i))

    setIsImporting(true)
    setStage('importing')

    try {
      const response = await fetch(`/api/projects/${projectKey}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tab-Id': getTabId(),
        },
        body: JSON.stringify({
          tickets: ticketsToImport,
          columnId,
          sprintId: sprintId || null,
          createMissingLabels,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(error.error ?? 'Import failed')
      }

      const result: ImportResult = await response.json()
      setImportResult(result)
      setStage('complete')
      showToast.success(`Successfully imported ${result.imported} ticket(s)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed'
      showToast.error(message)
      setStage('preview')
    } finally {
      setIsImporting(false)
    }
  }, [parseResult, selectedTickets, columnId, sprintId, createMissingLabels, projectKey])

  const handleReset = useCallback(() => {
    setStage('upload')
    setParseResult(null)
    setSelectedTickets(new Set())
    setImportResult(null)
    setFileName('')
    setColumnId(firstColumnId)
    setSprintId(null)
  }, [firstColumnId])

  return (
    <div className="space-y-6">
      {stage === 'upload' && (
        <UploadStage
          fileInputRef={fileInputRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onFileInput={handleFileInput}
        />
      )}

      {stage === 'preview' && parseResult && (
        <PreviewStage
          parseResult={parseResult}
          selectedTickets={selectedTickets}
          fileName={fileName}
          columnId={columnId}
          sprintId={sprintId}
          createMissingLabels={createMissingLabels}
          columns={columns}
          onToggleTicket={toggleTicket}
          onSelectAll={selectAll}
          onSelectNone={selectNone}
          onColumnChange={setColumnId}
          onSprintChange={setSprintId}
          onCreateMissingLabelsChange={setCreateMissingLabels}
          onImport={handleImport}
          onCancel={handleReset}
        />
      )}

      {stage === 'importing' && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
            <p className="mt-4 text-sm text-zinc-400">
              Importing {selectedTickets.size} ticket(s)...
            </p>
          </CardContent>
        </Card>
      )}

      {stage === 'complete' && importResult && (
        <CompleteStage result={importResult} onReset={handleReset} />
      )}
    </div>
  )
}

// ============================================================================
// Upload Stage
// ============================================================================

function UploadStage({
  fileInputRef,
  onDrop,
  onDragOver,
  onFileInput,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100">Import Tickets</CardTitle>
          <CardDescription>
            Import tickets from Jira or GitHub Issues. Upload a JSON or CSV file to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-12 transition-colors hover:border-zinc-600 cursor-pointer"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
            tabIndex={0}
            role="button"
            aria-label="Upload file"
          >
            <Upload className="h-10 w-10 text-zinc-500" />
            <p className="mt-4 text-sm font-medium text-zinc-300">
              Drop a file here or click to browse
            </p>
            <p className="mt-1 text-xs text-zinc-500">Supports JSON and CSV files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="hidden"
              onChange={onFileInput}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-sm text-zinc-100">Jira Import</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400 space-y-2">
            <p>Accepts Jira JSON export or CSV export.</p>
            <p className="font-medium text-zinc-300">Mapped fields:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Summary, Description, Priority</li>
              <li>Issue Type, Status, Resolution</li>
              <li>Labels, Components, Story Points</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-400" />
              <CardTitle className="text-sm text-zinc-100">GitHub Issues Import</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-zinc-400 space-y-2">
            <p>
              Accepts GitHub Issues JSON from the REST API or{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">
                gh issue list --json
              </code>
              .
            </p>
            <p className="font-medium text-zinc-300">Mapped fields:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Title, Body, Labels, State</li>
              <li>Type/priority inferred from labels</li>
              <li>Pull requests are excluded</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ============================================================================
// Preview Stage
// ============================================================================

function PreviewStage({
  parseResult,
  selectedTickets,
  fileName,
  columnId,
  sprintId: _sprintId,
  createMissingLabels,
  columns,
  onToggleTicket,
  onSelectAll,
  onSelectNone,
  onColumnChange,
  onSprintChange: _onSprintChange,
  onCreateMissingLabelsChange,
  onImport,
  onCancel,
}: {
  parseResult: ParseResult
  selectedTickets: Set<number>
  fileName: string
  columnId: string
  sprintId: string | null
  createMissingLabels: boolean
  columns: { id: string; name: string; icon?: string | null }[]
  onToggleTicket: (index: number) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onColumnChange: (id: string) => void
  onSprintChange: (id: string | null) => void
  onCreateMissingLabelsChange: (v: boolean) => void
  onImport: () => void
  onCancel: () => void
}) {
  const { tickets, warnings, source } = parseResult
  const allLabels = new Set<string>()
  for (const t of tickets) {
    for (const l of t.labels) allLabels.add(l)
  }

  return (
    <>
      {/* File info and source badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-zinc-400" />
          <span className="text-sm text-zinc-300">{fileName}</span>
          <Badge variant="outline" className="text-xs">
            {source === 'jira' ? 'Jira' : 'GitHub'}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-amber-800/50 bg-amber-950/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import settings */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-100">Import Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Target Column</Label>
              <Select value={columnId} onValueChange={onColumnChange}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="create-labels"
              checked={createMissingLabels}
              onCheckedChange={onCreateMissingLabelsChange}
            />
            <Label htmlFor="create-labels" className="text-sm text-zinc-300">
              Create labels that don&apos;t exist yet
              {allLabels.size > 0 && (
                <span className="text-xs text-zinc-500 ml-1">
                  ({allLabels.size} unique label{allLabels.size !== 1 ? 's' : ''})
                </span>
              )}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Ticket preview */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-zinc-100">
              Preview ({selectedTickets.size} of {tickets.length} selected)
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onSelectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onSelectNone}>
                Select None
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-96 overflow-auto">
            {tickets.map((ticket, index) => (
              <TicketPreviewRow
                key={index}
                ticket={ticket}
                index={index}
                selected={selectedTickets.has(index)}
                onToggle={onToggleTicket}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import action */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {selectedTickets.size} ticket{selectedTickets.size !== 1 ? 's' : ''} will be imported into
          the selected column.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onImport}
            disabled={selectedTickets.size === 0 || !columnId}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            Import {selectedTickets.size} Ticket{selectedTickets.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Ticket Preview Row
// ============================================================================

function TicketPreviewRow({
  ticket,
  index,
  selected,
  onToggle,
}: {
  ticket: ParsedTicket
  index: number
  selected: boolean
  onToggle: (index: number) => void
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-3 w-full rounded px-3 py-2 text-left transition-colors ${
        selected
          ? 'bg-zinc-800/80 hover:bg-zinc-800'
          : 'bg-transparent hover:bg-zinc-800/40 opacity-50'
      }`}
      onClick={() => onToggle(index)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(index)}
        className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30 shrink-0"
        onClick={(e) => e.stopPropagation()}
      />

      {/* External key */}
      {ticket.externalKey && (
        <span className="text-xs text-zinc-500 font-mono shrink-0 w-20 truncate">
          {ticket.externalKey}
        </span>
      )}

      {/* Type badge */}
      <span
        className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[ticket.type] ?? TYPE_COLORS.task}`}
      >
        {ticket.type}
      </span>

      {/* Priority */}
      <span
        className={`text-xs shrink-0 ${PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium}`}
      >
        {ticket.priority}
      </span>

      {/* Title */}
      <span className="text-sm text-zinc-200 truncate flex-1 min-w-0">{ticket.title}</span>

      {/* Story points */}
      {ticket.storyPoints != null && (
        <span className="text-xs text-zinc-500 shrink-0">{ticket.storyPoints}sp</span>
      )}

      {/* Labels */}
      {ticket.labels.length > 0 && (
        <span className="text-xs text-zinc-500 shrink-0">
          {ticket.labels.length} label{ticket.labels.length !== 1 ? 's' : ''}
        </span>
      )}

      {/* Resolved indicator */}
      {ticket.isResolved && <span className="text-xs text-emerald-500 shrink-0">resolved</span>}
    </button>
  )
}

// ============================================================================
// Complete Stage
// ============================================================================

function CompleteStage({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <div className="text-center space-y-1">
          <p className="text-lg font-medium text-zinc-100">Import Complete</p>
          <p className="text-sm text-zinc-400">
            Successfully imported {result.imported} ticket{result.imported !== 1 ? 's' : ''}
            {result.labelsCreated > 0 && (
              <>
                {' '}
                and created {result.labelsCreated} new label{result.labelsCreated !== 1 ? 's' : ''}
              </>
            )}
          </p>
        </div>

        {result.warnings.length > 0 && (
          <div className="w-full max-w-md">
            <Separator className="my-2" />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-xs font-medium text-amber-400">
                  {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="max-h-32 overflow-auto space-y-0.5">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-zinc-500">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <Button variant="outline" onClick={onReset} className="mt-4">
          Import More
        </Button>
      </CardContent>
    </Card>
  )
}
