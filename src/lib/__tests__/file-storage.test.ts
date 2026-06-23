import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FilesystemStorage, InMemoryStorage } from '../file-storage'

const { mkdir, writeFile, unlink } = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  mkdir,
  writeFile,
  unlink,
  default: { mkdir, writeFile, unlink },
}))

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage
  beforeEach(() => {
    storage = new InMemoryStorage()
  })

  it('writes and reads a file', async () => {
    await storage.writeFile('/dir/a.txt', Buffer.from('hello'))
    expect(storage.hasFile('/dir/a.txt')).toBe(true)
    expect(storage.getFile('/dir/a.txt')?.toString()).toBe('hello')
    expect(storage.files.size).toBe(1)
  })

  it('records the parent directory when writing', async () => {
    await storage.writeFile('/nested/dir/a.txt', Buffer.from('x'))
    expect(storage.hasFile('/nested/dir/a.txt')).toBe(true)
  })

  it('deletes a file and throws for a missing one', async () => {
    await storage.writeFile('/a.txt', Buffer.from('x'))
    await storage.deleteFile('/a.txt')
    expect(storage.hasFile('/a.txt')).toBe(false)
    await expect(storage.deleteFile('/missing.txt')).rejects.toThrow('File not found')
  })

  it('joins paths with forward slashes', () => {
    expect(storage.join('a', 'b', 'c')).toBe('a/b/c')
  })

  it('ensureDirectoryExists and clear are no-throw', async () => {
    await storage.ensureDirectoryExists('/some/dir')
    await storage.writeFile('/x.txt', Buffer.from('x'))
    storage.clear()
    expect(storage.files.size).toBe(0)
  })
})

describe('FilesystemStorage', () => {
  let storage: FilesystemStorage
  beforeEach(() => {
    vi.clearAllMocks()
    storage = new FilesystemStorage()
  })

  it('ensureDirectoryExists creates the directory recursively', async () => {
    await storage.ensureDirectoryExists('/data/uploads')
    expect(mkdir).toHaveBeenCalledWith('/data/uploads', { recursive: true })
  })

  it('writeFile delegates to fs writeFile', async () => {
    const buf = Buffer.from('content')
    await storage.writeFile('/data/a.txt', buf)
    expect(writeFile).toHaveBeenCalledWith('/data/a.txt', buf)
  })

  it('deleteFile delegates to unlink', async () => {
    await storage.deleteFile('/data/a.txt')
    expect(unlink).toHaveBeenCalledWith('/data/a.txt')
  })

  it('join uses the node path join', () => {
    expect(storage.join('a', 'b')).toBe('a/b')
  })
})
