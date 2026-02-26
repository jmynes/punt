import 'tsconfig-paths/register'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { importDatabase, isZipFile, parseExportFile } from '@/lib/database-import'

async function main() {
  const args = process.argv.slice(2)

  let filePath: string | undefined
  let password: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      filePath = args[i + 1]
      i++
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1]
      i++
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage()
      process.exit(0)
    }
  }

  if (!filePath) {
    printUsage()
    process.exit(1)
  }

  // Resolve file path
  const absolutePath = resolve(filePath)

  console.log(`Reading backup file: ${absolutePath}`)

  let buffer: Buffer
  try {
    buffer = readFileSync(absolutePath)
  } catch (err) {
    console.error(`Error: Could not read file "${absolutePath}"`)
    if (err instanceof Error) {
      console.error(`  ${err.message}`)
    }
    process.exit(1)
  }

  const isZip = isZipFile(buffer)
  console.log(`File type: ${isZip ? 'ZIP archive' : 'JSON'}`)
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`)

  // Parse and validate the export file
  console.log('Parsing export file...')
  const parseResult = await parseExportFile(buffer, password)

  if (!parseResult.success) {
    console.error(`Error: ${parseResult.error}`)
    process.exit(1)
  }

  console.log(`Export date: ${parseResult.exportedAt}`)
  console.log('')

  // Import the data
  console.log('Importing database...')
  const result = await importDatabase(parseResult.data, {
    zipBuffer: parseResult.isZip ? parseResult.zipBuffer : undefined,
    exportOptions: parseResult.options,
  })

  // Print summary
  console.log('')
  console.log('Import completed successfully!')
  console.log('')
  console.log('Records imported:')

  const countEntries = Object.entries(result.counts).filter(([, count]) => count > 0)
  for (const [model, count] of countEntries) {
    // Convert camelCase to readable format
    const label = model.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
    console.log(`  ${label}: ${count}`)
  }

  const totalRecords = Object.values(result.counts).reduce((sum, count) => sum + count, 0)
  console.log(`  Total: ${totalRecords}`)

  // File restoration summary
  const totalFiles = result.files.attachmentsRestored + result.files.avatarsRestored
  if (totalFiles > 0) {
    console.log('')
    console.log('Files restored:')
    if (result.files.attachmentsRestored > 0) {
      console.log(`  Attachments: ${result.files.attachmentsRestored}`)
    }
    if (result.files.avatarsRestored > 0) {
      console.log(`  Avatars: ${result.files.avatarsRestored}`)
    }
  }

  const missingFiles = result.files.attachmentsMissing + result.files.avatarsMissing
  if (missingFiles > 0) {
    console.log('')
    console.log(`Warning: ${missingFiles} files could not be restored`)
    if (result.files.missingFiles.length > 0 && result.files.missingFiles.length <= 10) {
      for (const file of result.files.missingFiles) {
        console.log(`  - ${file}`)
      }
    }
  }

  // 2FA resets
  if (result.twoFactorResets.length > 0) {
    console.log('')
    console.log(`Warning: 2FA was reset for ${result.twoFactorResets.length} user(s):`)
    for (const username of result.twoFactorResets) {
      console.log(`  - ${username}`)
    }
    console.log('  These users will need to re-enable 2FA after logging in.')
  }

  console.log('')
  console.log('You can now log in at http://localhost:3000/login')
}

function printUsage() {
  console.log('Usage: pnpm db:import --file <path> [--password <decrypt-password>]')
  console.log('')
  console.log('Import a PUNT database backup from a JSON or ZIP file.')
  console.log('')
  console.log('Required:')
  console.log('  --file <path>        Path to the backup file (.json or .zip)')
  console.log('')
  console.log('Optional:')
  console.log('  --password <pass>    Decryption password (if backup is encrypted)')
  console.log('  --help, -h           Show this help message')
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
