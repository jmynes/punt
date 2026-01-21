/**
 * File storage abstraction for dependency injection
 * Allows us to swap implementations (real filesystem, in-memory, cloud storage, etc.)
 */

export interface FileStorage {
  ensureDirectoryExists(path: string): Promise<void>
  writeFile(filepath: string, buffer: Buffer): Promise<void>
  deleteFile(filepath: string): Promise<void>
  join(...paths: string[]): string
}

import { writeFile as fsWriteFile, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Real filesystem implementation (production)
 */
export class FilesystemStorage implements FileStorage {
  async ensureDirectoryExists(path: string): Promise<void> {
    await mkdir(path, { recursive: true })
  }

  async writeFile(filepath: string, buffer: Buffer): Promise<void> {
    await fsWriteFile(filepath, buffer)
  }

  async deleteFile(filepath: string): Promise<void> {
    await unlink(filepath)
  }

  join(...paths: string[]): string {
    return join(...paths)
  }
}

/**
 * In-memory storage implementation (for testing)
 */
export class InMemoryStorage implements FileStorage {
  private _files: Map<string, Buffer> = new Map()
  private _directories: Set<string> = new Set()

  // Expose files for testing
  get files(): Map<string, Buffer> {
    return this._files
  }

  async ensureDirectoryExists(path: string): Promise<void> {
    this._directories.add(path)
  }

  async writeFile(filepath: string, buffer: Buffer): Promise<void> {
    this._files.set(filepath, buffer)
    // Also ensure parent directory exists
    const parentDir = filepath.substring(0, filepath.lastIndexOf('/'))
    if (parentDir) {
      this._directories.add(parentDir)
    }
  }

  async deleteFile(filepath: string): Promise<void> {
    if (!this._files.has(filepath)) {
      throw new Error(`File not found: ${filepath}`)
    }
    this._files.delete(filepath)
  }

  join(...paths: string[]): string {
    return paths.join('/')
  }

  // Test helpers
  getFile(filepath: string): Buffer | undefined {
    return this._files.get(filepath)
  }

  hasFile(filepath: string): boolean {
    return this._files.has(filepath)
  }

  clear(): void {
    this._files.clear()
    this._directories.clear()
  }
}
