'use client'

import type { Engine } from '@tsparticles/engine'
import { useCallback, useRef, useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'

// v4: ALL plugin registration must happen before any tsParticles.load() call.
// Both slim and confetti register plugins lazily; if we don't force-register
// them up front, the first effect that fires locks out the other.
let initPromise: Promise<void> | null = null

function ensureInit(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const { tsParticles } = await import('@tsparticles/engine')
    const { loadSlim } = await import('@tsparticles/slim')
    const { confetti } = await import('@tsparticles/confetti')
    await loadSlim(tsParticles as unknown as Engine)
    // Force confetti's internal plugin registration with a no-op invocation.
    // particleCount: 0 keeps it invisible.
    await confetti({ particleCount: 0, ticks: 0 })
  })()
  return initPromise
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface UseParticlesReturn {
  triggerConfetti: () => Promise<void>
  triggerFire: () => Promise<void>
  isAnimating: boolean
  isEnabled: boolean
}

/**
 * Hook to trigger particle effects for celebrations and warnings.
 * Respects user preferences and reduced motion settings.
 */
export function useParticles(): UseParticlesReturn {
  const [isAnimating, setIsAnimating] = useState(false)
  const containerRef = useRef<{ destroy: () => void } | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const enableParticleAnimations = useSettingsStore((s) => s.enableParticleAnimations)

  const shouldAnimate = useCallback(() => {
    return enableParticleAnimations && !prefersReducedMotion()
  }, [enableParticleAnimations])

  const triggerConfetti = useCallback(async () => {
    if (!shouldAnimate()) return

    try {
      setIsAnimating(true)

      await ensureInit()
      const { confetti } = await import('@tsparticles/confetti')
      const colors = ['#FFE066', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F472B6', '#34D399']

      // Center explosion
      await confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6, x: 0.5 },
        colors,
        startVelocity: 45,
        gravity: 1.2,
        scalar: 1.1,
        ticks: 250,
      })

      // Left cannon
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.65 },
        colors,
        startVelocity: 55,
        gravity: 1,
        ticks: 200,
      })

      // Right cannon
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.65 },
        colors,
        startVelocity: 55,
        gravity: 1,
        ticks: 200,
      })

      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false)
      }, 3000)
    } catch (error) {
      console.error('Failed to trigger confetti:', error)
      setIsAnimating(false)
    }
  }, [shouldAnimate])

  const triggerFire = useCallback(async () => {
    if (!shouldAnimate()) return

    try {
      setIsAnimating(true)

      await ensureInit()
      const { tsParticles } = await import('@tsparticles/engine')

      // Rising embers - spawn particles directly at bottom, rise upward
      const container = await tsParticles.load({
        id: `fire-container-${Date.now()}`,
        options: {
          fpsLimit: 120,
          fullScreen: { enable: true, zIndex: 9999 },
          particles: {
            number: { value: 150 },
            shape: { type: 'circle' },
            // v4: fill color lives on paint.fill.color, not particles.color
            paint: {
              fill: {
                enable: true,
                color: {
                  value: ['#ff3300', '#ff5500', '#ff7700', '#ff9900', '#ffbb00'],
                },
              },
            },
            opacity: {
              value: { min: 0.6, max: 1 },
              animation: {
                enable: true,
                speed: 0.5,
                sync: false,
                startValue: 'max',
                destroy: 'min',
              },
            },
            size: {
              value: { min: 1, max: 3 },
              animation: {
                enable: true,
                speed: 1.5,
                sync: false,
                startValue: 'max',
                destroy: 'min',
              },
            },
            move: {
              enable: true,
              speed: { min: 3, max: 7 },
              direction: 'top' as const,
              random: true,
              straight: false,
              outModes: {
                default: 'destroy' as const,
                bottom: 'none' as const,
              },
            },
            life: {
              duration: {
                value: { min: 2, max: 4 },
              },
            },
          },
          // Particles spawn at bottom of screen
          position: { x: { min: 0, max: 100 }, y: { min: 90, max: 100 } },
        },
      })

      containerRef.current = container ?? null

      timeoutRef.current = setTimeout(() => {
        container?.destroy()
        containerRef.current = null
        setIsAnimating(false)
      }, 3000)
    } catch (error) {
      console.error('Failed to trigger fire effect:', error)
      setIsAnimating(false)
    }
  }, [shouldAnimate])

  return {
    triggerConfetti,
    triggerFire,
    isAnimating,
    isEnabled: enableParticleAnimations,
  }
}
