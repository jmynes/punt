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

// Reverse map from LucideIcon component to icon name
const ICON_TO_NAME = new Map(COLUMN_ICON_OPTIONS.map((opt) => [opt.icon, opt.name]))

/**
 * Resolve the effective icon name for a column. If the column has an explicit icon,
 * returns it. Otherwise, looks up the auto-detected icon from the column name and
 * returns the matching icon name from COLUMN_ICON_OPTIONS (if any).
 */
export function resolveColumnIconName(
  iconName?: string | null,
  columnName?: string,
): string | null {
  if (iconName) return iconName
  if (columnName) {
    const entry = getStatusIcon(columnName)
    return ICON_TO_NAME.get(entry.icon) ?? null
  }
  return null
}

// Map Tailwind text color classes to hex values for the color picker.
// Uses LABEL_COLORS preset values where possible so the swatch gets highlighted.
export const TAILWIND_TO_HEX: Record<string, string> = {
  'text-zinc-400': '#64748b', // slate preset
  'text-zinc-500': '#78716c', // stone preset
  'text-blue-300': '#3b82f6', // blue preset
  'text-blue-400': '#3b82f6', // blue preset
  'text-cyan-300': '#06b6d4', // cyan preset
  'text-amber-300': '#f59e0b', // amber preset
  'text-amber-400': '#f59e0b', // amber preset
  'text-purple-300': '#8b5cf6', // purple preset
  'text-emerald-400': '#22c55e', // green preset
  'text-red-300': '#ef4444', // red preset
  'text-red-400': '#ef4444', // red preset
  'text-green-400': '#22c55e', // green preset
  'text-yellow-300': '#eab308', // yellow preset
  'text-yellow-400': '#eab308', // yellow preset
  'text-orange-400': '#f97316', // orange preset
  'text-indigo-400': '#a855f7', // purple-500 preset
}

/**
 * Resolve the default color for a column as a hex value. If the column already has
 * a custom hex color, returns it. Otherwise converts the auto-detected Tailwind
 * class to hex.
 */
export function resolveColumnColor(
  hexColor?: string | null,
  iconName?: string | null,
  columnName?: string,
): string | null {
  if (hexColor) return hexColor
  // Get the Tailwind class from the icon or name heuristic
  const entry = iconName
    ? COLUMN_ICON_MAP.get(iconName)
    : columnName
      ? getStatusIcon(columnName)
      : null
  if (entry) return TAILWIND_TO_HEX[entry.color] ?? null
  return null
}

/**
 * Get the icon for a column. Uses custom icon/color if set, otherwise falls back
 * to the name-based heuristic.
 *
 * When `hexColor` is provided (a hex string like "#3b82f6"), it is returned as the color.
 * Components should check if color starts with "#" and use inline style instead of className.
 */
export function getColumnIcon(
  iconName?: string | null,
  columnName?: string,
  hexColor?: string | null,
): StatusIconEntry {
  if (iconName) {
    const custom = COLUMN_ICON_MAP.get(iconName)
    if (custom) return { icon: custom.icon, color: hexColor ?? custom.color }
  }
  if (columnName) {
    const entry = getStatusIcon(columnName)
    return hexColor ? { icon: entry.icon, color: hexColor } : entry
  }
  return { icon: Circle, color: hexColor ?? 'text-zinc-400' }
}
