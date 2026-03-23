'use client'

import { PuntLogo } from '@/components/common/punt-logo'
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
        {branding?.logoMode === 'custom' && branding.logoUrl ? (
          <img
            src={withBasePath(branding.logoUrl)}
            alt={appName}
            className="h-16 w-16 rounded-xl object-contain"
          />
        ) : branding?.logoMode === 'letter' ? (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-xl text-white"
            style={{
              background: `linear-gradient(to bottom right, ${branding.logoGradientFrom}, ${branding.logoGradientTo})`,
            }}
          >
            <span className="text-2xl font-bold">{branding.logoLetter}</span>
          </div>
        ) : (
          <PuntLogo className="h-16 w-16 rounded-xl" />
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{displayTitle}</h1>
        <p className="text-zinc-500">{subtitle}</p>
      </div>
    </div>
  )
}
