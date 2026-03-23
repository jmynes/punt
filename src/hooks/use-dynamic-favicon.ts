'use client'

import { useEffect } from 'react'
import { useBranding } from '@/hooks/queries/use-branding'
import { withBasePath } from '@/lib/base-path'

/**
 * Dynamically updates the favicon based on the branding logo mode.
 * - default: uses /favicon.ico (the PUNT icon)
 * - custom: uses the uploaded logo URL
 * - letter: renders the gradient letter to a canvas and creates a data URL
 */
export function useDynamicFavicon() {
  const { data: branding } = useBranding()

  useEffect(() => {
    if (!branding) return

    const setFavicon = (href: string) => {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = href
    }

    if (branding.logoMode === 'custom' && branding.logoUrl) {
      setFavicon(withBasePath(branding.logoUrl))
      return
    }

    if (branding.logoMode === 'letter') {
      // Render gradient letter to canvas
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Rounded rect with gradient
      const radius = 14
      const gradient = ctx.createLinearGradient(0, 0, size, size)
      gradient.addColorStop(0, branding.logoGradientFrom)
      gradient.addColorStop(1, branding.logoGradientTo)

      ctx.beginPath()
      ctx.roundRect(0, 0, size, size, radius)
      ctx.fillStyle = gradient
      ctx.fill()

      // Letter
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${size * 0.5}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(branding.logoLetter, size / 2, size / 2 + 2)

      setFavicon(canvas.toDataURL('image/png'))
      return
    }

    // Default mode — use the static favicon
    setFavicon(withBasePath('/favicon.ico'))
  }, [branding])
}
