/**
 * Branding constants and types.
 * Separated from system-settings.ts to avoid pulling PrismaClient into client bundles.
 */

export type LogoMode = 'default' | 'letter' | 'custom'

export const DEFAULT_BRANDING = {
  appName: 'PUNT',
  logoMode: 'default' as LogoMode,
  logoUrl: null as string | null,
  logoLetter: 'P',
  logoGradientFrom: '#f59e0b',
  logoGradientTo: '#ea580c',
}

export interface BrandingSettings {
  appName: string
  logoMode: LogoMode
  logoUrl: string | null
  logoLetter: string
  logoGradientFrom: string
  logoGradientTo: string
}
