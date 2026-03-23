'use client'

import { useState } from 'react'
import { withBasePath } from '@/lib/base-path'
import type { BrandingSettings } from '@/lib/branding'
import { cn } from '@/lib/utils'
import { PuntLogo } from './punt-logo'

interface BrandingLogoProps {
  branding: BrandingSettings | undefined
  size: 'sm' | 'lg'
}

/**
 * Renders the branding logo based on logoMode.
 * Shows nothing until the correct logo is ready to paint (no flash).
 */
export function BrandingLogo({ branding, size }: BrandingLogoProps) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const sizeClasses = size === 'sm' ? 'h-8 w-8' : 'h-16 w-16'
  const roundedClass = size === 'sm' ? 'rounded-lg' : 'rounded-xl'
  const textSize = size === 'sm' ? 'text-sm' : 'text-2xl'
  const px = size === 'sm' ? 32 : 64

  // While branding is loading, reserve space but show nothing
  if (!branding) {
    return <div className={cn(sizeClasses, 'shrink-0')} />
  }

  if (branding.logoMode === 'custom' && branding.logoUrl) {
    return (
      <div className={cn(sizeClasses, 'shrink-0')}>
        <img
          src={withBasePath(branding.logoUrl)}
          alt={branding.appName}
          width={px}
          height={px}
          onLoad={() => setImgLoaded(true)}
          className={cn(sizeClasses, roundedClass, 'object-contain', !imgLoaded && 'invisible')}
        />
      </div>
    )
  }

  if (branding.logoMode === 'letter') {
    return (
      <div
        className={cn(
          sizeClasses,
          roundedClass,
          'flex shrink-0 items-center justify-center text-white',
        )}
        style={{
          background: `linear-gradient(to bottom right, ${branding.logoGradientFrom}, ${branding.logoGradientTo})`,
        }}
      >
        <span className={cn(textSize, 'font-bold')}>{branding.logoLetter}</span>
      </div>
    )
  }

  // Default mode
  return <PuntLogo className={cn(sizeClasses, 'shrink-0', roundedClass)} />
}
