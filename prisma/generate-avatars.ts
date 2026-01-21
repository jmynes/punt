import * as fs from 'node:fs'
import * as path from 'node:path'
import { PNG } from 'pngjs'

const AVATAR_SIZE = 200

interface AvatarConfig {
  name: string
  baseColor: [number, number, number]
  accentColor: [number, number, number]
  pattern: 'gradient' | 'circle' | 'diamond' | 'stripes' | 'dots' | 'waves'
}

const avatarConfigs: AvatarConfig[] = [
  {
    name: 'avatar-blue',
    baseColor: [59, 130, 246],
    accentColor: [147, 197, 253],
    pattern: 'gradient',
  },
  {
    name: 'avatar-green',
    baseColor: [34, 197, 94],
    accentColor: [134, 239, 172],
    pattern: 'circle',
  },
  {
    name: 'avatar-purple',
    baseColor: [147, 51, 234],
    accentColor: [216, 180, 254],
    pattern: 'diamond',
  },
  {
    name: 'avatar-orange',
    baseColor: [249, 115, 22],
    accentColor: [253, 186, 116],
    pattern: 'gradient',
  },
  {
    name: 'avatar-pink',
    baseColor: [236, 72, 153],
    accentColor: [249, 168, 212],
    pattern: 'waves',
  },
  {
    name: 'avatar-cyan',
    baseColor: [6, 182, 212],
    accentColor: [103, 232, 249],
    pattern: 'stripes',
  },
  { name: 'avatar-red', baseColor: [239, 68, 68], accentColor: [252, 165, 165], pattern: 'circle' },
  { name: 'avatar-amber', baseColor: [245, 158, 11], accentColor: [252, 211, 77], pattern: 'dots' },
  {
    name: 'avatar-indigo',
    baseColor: [99, 102, 241],
    accentColor: [165, 180, 252],
    pattern: 'diamond',
  },
  { name: 'avatar-teal', baseColor: [20, 184, 166], accentColor: [94, 234, 212], pattern: 'waves' },
]

function createAvatar(config: AvatarConfig): PNG {
  const png = new PNG({ width: AVATAR_SIZE, height: AVATAR_SIZE })
  const centerX = AVATAR_SIZE / 2
  const centerY = AVATAR_SIZE / 2

  for (let y = 0; y < AVATAR_SIZE; y++) {
    for (let x = 0; x < AVATAR_SIZE; x++) {
      const idx = (AVATAR_SIZE * y + x) << 2

      // Calculate distance from center for circular mask
      const dx = x - centerX
      const dy = y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const maxDist = AVATAR_SIZE / 2

      // If outside circle, make transparent
      if (distance > maxDist - 2) {
        png.data[idx] = 0
        png.data[idx + 1] = 0
        png.data[idx + 2] = 0
        png.data[idx + 3] = 0
        continue
      }

      // Anti-aliasing for circle edge
      let alpha = 255
      if (distance > maxDist - 4) {
        alpha = Math.round((255 * (maxDist - distance)) / 4)
      }

      let color: [number, number, number]

      switch (config.pattern) {
        case 'gradient': {
          const t = y / AVATAR_SIZE
          color = [
            Math.round(config.baseColor[0] * (1 - t) + config.accentColor[0] * t),
            Math.round(config.baseColor[1] * (1 - t) + config.accentColor[1] * t),
            Math.round(config.baseColor[2] * (1 - t) + config.accentColor[2] * t),
          ]
          break
        }
        case 'circle': {
          const t = Math.min(1, distance / (maxDist * 0.7))
          color = [
            Math.round(config.accentColor[0] * (1 - t) + config.baseColor[0] * t),
            Math.round(config.accentColor[1] * (1 - t) + config.baseColor[1] * t),
            Math.round(config.accentColor[2] * (1 - t) + config.baseColor[2] * t),
          ]
          break
        }
        case 'diamond': {
          const diamondDist = Math.abs(dx) + Math.abs(dy)
          const t = Math.min(1, diamondDist / maxDist)
          color = [
            Math.round(config.accentColor[0] * (1 - t) + config.baseColor[0] * t),
            Math.round(config.accentColor[1] * (1 - t) + config.baseColor[1] * t),
            Math.round(config.accentColor[2] * (1 - t) + config.baseColor[2] * t),
          ]
          break
        }
        case 'stripes': {
          const stripe = Math.floor(y / 20) % 2 === 0
          color = stripe ? config.baseColor : config.accentColor
          break
        }
        case 'dots': {
          const dotSize = 30
          const dotX = (x % dotSize) - dotSize / 2
          const dotY = (y % dotSize) - dotSize / 2
          const dotDist = Math.sqrt(dotX * dotX + dotY * dotY)
          color = dotDist < 8 ? config.accentColor : config.baseColor
          break
        }
        case 'waves': {
          const wave = Math.sin((x + y * 0.5) / 15) * 0.5 + 0.5
          color = [
            Math.round(config.baseColor[0] * (1 - wave) + config.accentColor[0] * wave),
            Math.round(config.baseColor[1] * (1 - wave) + config.accentColor[1] * wave),
            Math.round(config.baseColor[2] * (1 - wave) + config.accentColor[2] * wave),
          ]
          break
        }
        default:
          color = config.baseColor
      }

      png.data[idx] = color[0]
      png.data[idx + 1] = color[1]
      png.data[idx + 2] = color[2]
      png.data[idx + 3] = alpha
    }
  }

  return png
}

async function main() {
  const outputDir = path.join(__dirname, 'sample-avatars')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log('Generating avatar images...')

  for (const config of avatarConfigs) {
    const png = createAvatar(config)
    const outputPath = path.join(outputDir, `${config.name}.png`)

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath)
      png.pack().pipe(writeStream)
      writeStream.on('finish', () => {
        console.log(`  Created: ${config.name}.png`)
        resolve()
      })
      writeStream.on('error', reject)
    })
  }

  console.log(`\nGenerated ${avatarConfigs.length} avatars in ${outputDir}`)
}

main().catch(console.error)
