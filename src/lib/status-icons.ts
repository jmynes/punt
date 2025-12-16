import {
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  Flag,
  Loader2,
  type LucideIcon,
  PauseCircle,
  TrendingUp,
} from 'lucide-react'

type StatusIconEntry = { icon: LucideIcon; color: string }

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
