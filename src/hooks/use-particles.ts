'use client'

import type { Engine } from '@tsparticles/engine'
import { useCallback, useRef, useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Confetti configuration for sprint completion celebration
 * Note: Using direct particle spawn instead of emitters (slim bundle doesn't include emitters)
 */
export const confettiConfig = {
  fullScreen: { enable: true, zIndex: 9999 },
  fpsLimit: 120,
  particles: {
    number: {
      value: 100, // Spawn 100 particles immediately
    },
    color: {
      value: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'],
    },
    shape: {
      type: ['circle', 'square'],
    },
    opacity: {
      value: { min: 0.5, max: 1 },
      animation: {
        enable: true,
        speed: 0.5,
        minimumValue: 0,
        sync: false,
        startValue: 'max',
        destroy: 'min',
      },
    },
    size: {
      value: { min: 4, max: 10 },
    },
    move: {
      enable: true,
      speed: { min: 10, max: 25 },
      direction: 'bottom' as const,
      random: true,
      straight: false,
      gravity: {
        enable: true,
        acceleration: 9.8,
      },
      outModes: {
        default: 'destroy' as const,
        top: 'none' as const,
      },
      decay: 0.02,
    },
    rotate: {
      value: { min: 0, max: 360 },
      direction: 'random' as const,
      animation: {
        enable: true,
        speed: 60,
      },
    },
    tilt: {
      enable: true,
      value: { min: 0, max: 360 },
      direction: 'random' as const,
      animation: {
        enable: true,
        speed: 30,
      },
    },
    wobble: {
      enable: true,
      distance: 20,
      speed: { min: 5, max: 15 },
    },
  },
  detectRetina: true,
}

/**
 * Fire/ember configuration for over-budget warning
 * Note: Using direct particle spawn instead of emitters (slim bundle doesn't include emitters)
 */
export const fireConfig = {
  fullScreen: { enable: true, zIndex: 9999 },
  fpsLimit: 120,
  particles: {
    number: {
      value: 60, // Spawn 60 fire particles immediately
    },
    color: {
      value: ['#ef4444', '#f97316', '#fbbf24', '#dc2626'],
    },
    shape: {
      type: 'circle',
    },
    opacity: {
      value: { min: 0.4, max: 0.9 },
      animation: {
        enable: true,
        speed: 1,
        minimumValue: 0,
        sync: false,
        startValue: 'max',
        destroy: 'min',
      },
    },
    size: {
      value: { min: 3, max: 8 },
      animation: {
        enable: true,
        speed: 3,
        minimumValue: 1,
        sync: false,
        startValue: 'max',
        destroy: 'min',
      },
    },
    move: {
      enable: true,
      speed: { min: 5, max: 12 },
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
        value: { min: 0.5, max: 1.5 },
      },
    },
  },
  detectRetina: true,
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
  const enableParticleAnimations = useSettingsStore((s) => s.enableParticleAnimations)

  const shouldAnimate = useCallback(() => {
    // Check settings and reduced motion preference
    return enableParticleAnimations && !prefersReducedMotion()
  }, [enableParticleAnimations])

  const triggerConfetti = useCallback(async () => {
    if (!shouldAnimate() || isAnimating) return

    try {
      setIsAnimating(true)

      // Dynamically import tsParticles to keep bundle size minimal
      const { tsParticles } = await import('@tsparticles/engine')
      const { loadSlim } = await import('@tsparticles/slim')

      await loadSlim(tsParticles as unknown as Engine)

      const container = await tsParticles.load({
        id: 'confetti-container',
        options: confettiConfig,
      })

      containerRef.current = container ?? null

      // Auto-cleanup after animation completes
      setTimeout(() => {
        container?.destroy()
        containerRef.current = null
        setIsAnimating(false)
      }, 2500)
    } catch (error) {
      console.error('Failed to trigger confetti:', error)
      setIsAnimating(false)
    }
  }, [shouldAnimate, isAnimating])

  const triggerFire = useCallback(async () => {
    if (!shouldAnimate() || isAnimating) return

    try {
      setIsAnimating(true)

      const { tsParticles } = await import('@tsparticles/engine')
      const { loadSlim } = await import('@tsparticles/slim')

      await loadSlim(tsParticles as unknown as Engine)

      const container = await tsParticles.load({
        id: 'fire-container',
        options: fireConfig,
      })

      containerRef.current = container ?? null

      // Auto-cleanup after animation completes
      setTimeout(() => {
        container?.destroy()
        containerRef.current = null
        setIsAnimating(false)
      }, 1500)
    } catch (error) {
      console.error('Failed to trigger fire effect:', error)
      setIsAnimating(false)
    }
  }, [shouldAnimate, isAnimating])

  return {
    triggerConfetti,
    triggerFire,
    isAnimating,
    isEnabled: enableParticleAnimations,
  }
}
