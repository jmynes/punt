import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  /**
   * Icon displayed next to the title
   */
  icon?: LucideIcon
  /**
   * Category label shown above the title (only in hero variant)
   */
  category?: string
  /**
   * Main title of the page
   */
  title: string
  /**
   * Description text below the title
   */
  description?: string
  /**
   * Header variant: 'hero' for gradient background, 'simple' for minimal style
   * @default 'simple'
   */
  variant?: 'hero' | 'simple'
  /**
   * Accent color for the icon and gradient (in hero variant)
   * @default 'amber'
   */
  accentColor?: 'amber' | 'blue' | 'green' | 'red' | 'purple'
  /**
   * Additional content to display in the header (e.g., action buttons)
   */
  children?: ReactNode
  /**
   * Additional CSS classes for the container
   */
  className?: string
}

const accentColorStyles = {
  amber: {
    icon: 'text-amber-500',
    gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    blob1: 'bg-amber-500/5',
    blob2: 'bg-orange-500/5',
  },
  blue: {
    icon: 'text-blue-500',
    gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent',
    blob1: 'bg-blue-500/5',
    blob2: 'bg-cyan-500/5',
  },
  green: {
    icon: 'text-green-500',
    gradient: 'from-green-500/10 via-emerald-500/5 to-transparent',
    blob1: 'bg-green-500/5',
    blob2: 'bg-emerald-500/5',
  },
  red: {
    icon: 'text-red-500',
    gradient: 'from-red-500/10 via-rose-500/5 to-transparent',
    blob1: 'bg-red-500/5',
    blob2: 'bg-rose-500/5',
  },
  purple: {
    icon: 'text-purple-500',
    gradient: 'from-purple-500/10 via-violet-500/5 to-transparent',
    blob1: 'bg-purple-500/5',
    blob2: 'bg-violet-500/5',
  },
}

/**
 * Reusable page header component with two variants:
 * - 'hero': Full-width gradient header with category label, used for main settings pages
 * - 'simple': Minimal inline header with icon and title
 */
export function PageHeader({
  icon: Icon,
  category,
  title,
  description,
  variant = 'simple',
  accentColor = 'amber',
  children,
  className,
}: PageHeaderProps) {
  const colors = accentColorStyles[accentColor]

  if (variant === 'hero') {
    return (
      <>
        <div className={cn('relative overflow-hidden', className)}>
          <div className={cn('absolute inset-0 bg-gradient-to-br', colors.gradient)} />
          <div
            className={cn('absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl', colors.blob1)}
          />
          <div
            className={cn(
              'absolute top-20 right-1/4 w-64 h-64 rounded-full blur-3xl',
              colors.blob2,
            )}
          />

          <div className="relative max-w-3xl mx-auto px-6 py-12">
            {category && Icon && (
              <div className={cn('flex items-center gap-2 mb-2', colors.icon)}>
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">{category}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-zinc-100 mb-2">{title}</h1>
                {description && <p className="text-zinc-400">{description}</p>}
              </div>
              {children}
            </div>
          </div>
        </div>
        {/* Gap between header and content */}
        <div className="h-6" />
      </>
    )
  }

  // Simple variant
  return (
    <div className={cn('flex items-center gap-3 mb-6', className)}>
      {Icon && <Icon className={cn('h-6 w-6', colors.icon)} />}
      <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
      {children}
    </div>
  )
}
