/**
 * Branding constants and types.
 * Separated from system-settings.ts to avoid pulling PrismaClient into client bundles.
 */

export const DEFAULT_BRANDING = {
  appName: 'PUNT',
  logoUrl: null as string | null,
  logoLetter: 'P',
  logoGradientFrom: '#f59e0b',
  logoGradientTo: '#ea580c',
}

export interface BrandingSettings {
  appName: string
  logoUrl: string | null
  logoLetter: string
  logoGradientFrom: string
  logoGradientTo: string
}
