import sharp from 'sharp'

const AVATAR_MAX_SIZE = 256 // Max dimension in pixels
const AVATAR_QUALITY = 85 // WebP quality (0-100)

const LOGO_MAX_SIZE = 128 // Max dimension in pixels
const LOGO_QUALITY = 90 // WebP quality (0-100)

/**
 * Process an avatar image using sharp:
 * - Strips all metadata (EXIF, IPTC, XMP, ICC profiles, etc.)
 * - Removes any steganographically embedded data by re-encoding
 * - Resizes to max 256x256 (preserving aspect ratio)
 * - Converts to WebP for optimal compression
 *
 * @param inputBuffer - The raw image buffer
 * @returns Processed image buffer as WebP
 */
export async function processAvatarImage(inputBuffer: Buffer): Promise<Buffer> {
  return (
    sharp(inputBuffer)
      // Auto-rotate based on EXIF orientation before processing
      .rotate()
      // Resize to max dimensions, preserving aspect ratio
      // 'inside' fit means the image will fit within the box, never exceeding it
      .resize(AVATAR_MAX_SIZE, AVATAR_MAX_SIZE, {
        fit: 'inside',
        withoutEnlargement: true, // Don't upscale small images
      })
      // Convert to WebP with lossy compression
      // Re-encoding destroys any steganographic data
      // Not calling .withMetadata() strips all EXIF, ICC, XMP metadata by default
      .webp({
        quality: AVATAR_QUALITY,
        effort: 4, // Balance between speed and compression (0-6)
      })
      .toBuffer()
  )
}

/**
 * Process a logo image using sharp:
 * - Strips all metadata (EXIF, IPTC, XMP, ICC profiles, etc.)
 * - Removes any steganographically embedded data by re-encoding
 * - Resizes to max 128x128 (preserving aspect ratio)
 * - Converts to WebP for optimal compression
 *
 * @param inputBuffer - The raw image buffer
 * @returns Processed image buffer as WebP
 */
export async function processLogoImage(inputBuffer: Buffer): Promise<Buffer> {
  return (
    sharp(inputBuffer)
      // Auto-rotate based on EXIF orientation before processing
      .rotate()
      // Resize to max dimensions, preserving aspect ratio
      .resize(LOGO_MAX_SIZE, LOGO_MAX_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      // Convert to WebP with high quality for logo
      .webp({
        quality: LOGO_QUALITY,
        effort: 4,
      })
      .toBuffer()
  )
}
