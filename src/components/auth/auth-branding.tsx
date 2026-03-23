'use client'

import { BrandingLogo } from '@/components/common/branding-logo'
import { useBranding } from '@/hooks/queries/use-branding'

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
        <BrandingLogo branding={branding} size="lg" />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{displayTitle}</h1>
        <p className="text-zinc-500">{subtitle}</p>
      </div>
    </div>
  )
}
