/**
 * Load environment variables BEFORE any other imports
 * This file must be imported first in index.ts
 */
import { resolve } from 'node:path'
import { config } from 'dotenv'

// Load .env from parent directory (where the main PUNT app lives)
config({ path: resolve(import.meta.dirname, '../../.env') })
