'use client'

import { useBranding } from '@/hooks/queries/use-branding'
import { withBasePath } from '@/lib/base-path'

interface AuthBrandingProps {
  title?: string
  subtitle?: string
}

export function AuthBranding({ title, subtitle = 'Sign in to your account' }: AuthBrandingProps) {
  const { data: branding } = useBranding()
  const appName = branding?.appName || 'PUNT'
  const displayTitle = title || `Welcome to ${appName}`

  return (
    <div className="text-center space-y-4">
      {/* Logo */}
      <div className="flex justify-center">
        <img
          src={withBasePath(branding?.logoUrl || '/punt-icon.svg')}
          alt={appName}
          className="h-16 w-16 rounded-xl object-contain"
        />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{displayTitle}</h1>
        <p className="text-zinc-500">{subtitle}</p>
      </div>
    </div>
  )
}
