import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, HEAD } from '../route'

const uploadRoot = resolve(process.cwd(), 'public', 'uploads')
let testDirectory: string
let testFileSegments: string[]

function context(filePath = testFileSegments) {
  return { params: Promise.resolve({ filePath }) }
}

describe('GET /api/uploads/[...filePath]', () => {
  beforeEach(async () => {
    await mkdir(uploadRoot, { recursive: true })
    testDirectory = await mkdtemp(join(uploadRoot, 'punt-file-serving-'))
    testFileSegments = [...relative(uploadRoot, testDirectory).split(/[\\/]/), 'test.webp']
    await writeFile(join(testDirectory, 'test.webp'), 'hello')
  })

  afterEach(async () => {
    if (testDirectory) {
      await rm(testDirectory, { recursive: true, force: true })
    }
  })

  it('streams an uploaded file with its media type and prevents stale browser copies', async () => {
    const response = await GET(new Request('http://localhost/api/uploads/test.webp'), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.text()).resolves.toBe('hello')
  })

  it('supports partial content for video and large-file previews', async () => {
    await writeFile(join(testDirectory, 'movie.mp4'), 'hello')
    const response = await GET(
      new Request('http://localhost/api/uploads/movie.mp4', { headers: { range: 'bytes=2-4' } }),
      context([...testFileSegments.slice(0, -1), 'movie.mp4']),
    )

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe('bytes 2-4/5')
    expect(response.headers.get('Content-Length')).toBe('3')
    await expect(response.text()).resolves.toBe('llo')
  })

  it('does not serve files outside the uploads directory', async () => {
    const response = await GET(
      new Request('http://localhost/api/uploads/../secret.txt'),
      context(['..', 'secret.txt']),
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when the uploaded file no longer exists', async () => {
    const response = await GET(
      new Request('http://localhost/api/uploads/missing.pdf'),
      context([...testFileSegments.slice(0, -1), 'missing.pdf']),
    )

    expect(response.status).toBe(404)
  })

  it('supports HEAD without streaming the file body', async () => {
    const response = await HEAD(
      new Request('http://localhost/api/uploads/test.webp', { method: 'HEAD' }),
      context(),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Length')).toBe(
      String((await stat(join(testDirectory, 'test.webp'))).size),
    )
    expect(response.body).toBeNull()
  })
})
