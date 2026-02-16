'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BurndownDataPoint } from '@/lib/data-provider/types'

interface BurndownChartProps {
  dataPoints: BurndownDataPoint[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-zinc-300">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export function BurndownChart({ dataPoints }: BurndownChartProps) {
  if (dataPoints.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50">
        <p className="text-sm text-zinc-500">No burndown data available</p>
      </div>
    )
  }

  // Show scope line if scope changed during the sprint
  const scopeChanged = new Set(dataPoints.map((d) => d.scope)).size > 1

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dataPoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#3f3f46' }}
            tickFormatter={(value: string) => {
              const d = new Date(`${value}T00:00:00`)
              return `${d.getMonth() + 1}/${d.getDate()}`
            }}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#3f3f46' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Scope: amber/orange, solid thin — shows total work over time */}
          {scopeChanged && (
            <Line
              type="monotone"
              dataKey="scope"
              name="Scope"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
            />
          )}
          {/* Ideal guideline: thin gray dashed — constant-rate reference */}
          <Line
            type="monotone"
            dataKey="ideal"
            name="Guideline"
            stroke="#52525b"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
          />
          {/* Remaining: bold red — the main burndown line */}
          <Line
            type="monotone"
            dataKey="remaining"
            name="Remaining"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }}
            activeDot={{ fill: '#ef4444', r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
