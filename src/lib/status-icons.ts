import {
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  Clock3,
  Eye,
  Flag,
  Flame,
  Loader2,
  type LucideIcon,
  MessageSquare,
  PauseCircle,
  Rocket,
  Search,
  Shield,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'

export type StatusIconEntry = { icon: LucideIcon; color: string }

// Common status names mapped to icons and colors
const STATUS_ICON_MAP: Record<string, StatusIconEntry> = {
  backlog: { icon: CircleDashed, color: 'text-zinc-400' },
  'to do': { icon: CircleDashed, color: 'text-blue-300' },
  todo: { icon: CircleDashed, color: 'text-blue-300' },
  'in progress': { icon: Loader2, color: 'text-amber-400' },
  progress: { icon: Loader2, color: 'text-amber-400' },
  doing: { icon: Loader2, color: 'text-amber-400' },
  review: { icon: PauseCircle, color: 'text-purple-300' },
  'in review': { icon: PauseCircle, color: 'text-purple-300' },
  qa: { icon: PauseCircle, color: 'text-purple-300' },
  done: { icon: CheckCircle2, color: 'text-emerald-400' },
  complete: { icon: CheckCircle2, color: 'text-emerald-400' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400' },
  blocked: { icon: Flag, color: 'text-red-400' },
  onhold: { icon: Clock3, color: 'text-amber-300' },
  'on hold': { icon: Clock3, color: 'text-amber-300' },
  ready: { icon: TrendingUp, color: 'text-cyan-300' },
}

export function getStatusIcon(statusName: string): StatusIconEntry {
  const key = statusName.trim().toLowerCase()
  return STATUS_ICON_MAP[key] ?? { icon: Circle, color: 'text-zinc-400' }
}

// Icon options available for the column icon picker
export interface ColumnIconOption {
  name: string
  icon: LucideIcon
  color: string
}

export const COLUMN_ICON_OPTIONS: ColumnIconOption[] = [
  { name: 'CircleDashed', icon: CircleDashed, color: 'text-zinc-400' },
  { name: 'Circle', icon: Circle, color: 'text-zinc-400' },
  { name: 'CircleDot', icon: CircleDot, color: 'text-blue-300' },
  { name: 'Loader2', icon: Loader2, color: 'text-amber-400' },
  { name: 'Clock3', icon: Clock3, color: 'text-amber-300' },
  { name: 'PauseCircle', icon: PauseCircle, color: 'text-purple-300' },
  { name: 'Eye', icon: Eye, color: 'text-purple-300' },
  { name: 'Search', icon: Search, color: 'text-cyan-300' },
  { name: 'CheckCircle2', icon: CheckCircle2, color: 'text-emerald-400' },
  { name: 'TrendingUp', icon: TrendingUp, color: 'text-cyan-300' },
  { name: 'ArrowRight', icon: ArrowRight, color: 'text-blue-400' },
  { name: 'Rocket', icon: Rocket, color: 'text-indigo-400' },
  { name: 'Flag', icon: Flag, color: 'text-red-400' },
  { name: 'AlertCircle', icon: AlertCircle, color: 'text-red-400' },
  { name: 'Shield', icon: Shield, color: 'text-green-400' },
  { name: 'Zap', icon: Zap, color: 'text-yellow-400' },
  { name: 'Flame', icon: Flame, color: 'text-orange-400' },
  { name: 'Star', icon: Star, color: 'text-yellow-300' },
  { name: 'Target', icon: Target, color: 'text-red-300' },
  { name: 'MessageSquare', icon: MessageSquare, color: 'text-blue-300' },
  { name: 'Archive', icon: Archive, color: 'text-zinc-500' },
]

// Map from icon name to the icon option (for quick lookup)
const COLUMN_ICON_MAP = new Map(COLUMN_ICON_OPTIONS.map((opt) => [opt.name, opt]))

/**
 * Get the icon for a column. Uses custom icon if set, otherwise falls back
 * to the name-based heuristic.
 */
export function getColumnIcon(iconName?: string | null, columnName?: string): StatusIconEntry {
  if (iconName) {
    const custom = COLUMN_ICON_MAP.get(iconName)
    if (custom) return { icon: custom.icon, color: custom.color }
  }
  if (columnName) {
    return getStatusIcon(columnName)
  }
  return { icon: Circle, color: 'text-zinc-400' }
}
