import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uploadRoot = resolve(process.cwd(), 'public', 'uploads')

const contentTypes: Record<string, string> = {
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogg': 'video/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function isInsideDirectory(directory: string, filePath: string): boolean {
  const relativePath = relative(directory, filePath)
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

function notFound() {
  return new Response('Not found', { status: 404 })
}

async function serveUploadedFile(
  request: Request,
  params: Promise<{ filePath: string[] }>,
  headOnly = false,
) {
  const { filePath } = await params
  if (
    !filePath.length ||
    filePath.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return notFound()
  }

  const requestedPath = resolve(uploadRoot, ...filePath)
  if (!isInsideDirectory(uploadRoot, requestedPath)) return notFound()

  try {
    // Check both lexical and resolved paths so symlinks cannot escape uploads.
    const [realUploadRoot, realFilePath] = await Promise.all([
      realpath(uploadRoot),
      realpath(requestedPath),
    ])
    if (!isInsideDirectory(realUploadRoot, realFilePath)) return notFound()

    const fileStats = await stat(realFilePath)
    if (!fileStats.isFile()) return notFound()

    let start = 0
    let end = Math.max(0, fileStats.size - 1)
    let status = 200
    const range = request.headers.get('range')

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
      if (!match || (!match[1] && !match[2])) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileStats.size}` },
        })
      }

      if (match[1]) {
        start = Number(match[1])
        end = match[2] ? Number(match[2]) : fileStats.size - 1
      } else {
        const suffixLength = Number(match[2])
        start = Math.max(0, fileStats.size - suffixLength)
      }

      if (start >= fileStats.size || start > end || end < 0) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileStats.size}` },
        })
      }

      end = Math.min(end, fileStats.size - 1)
      status = 206
    }

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(basename(realFilePath))}`,
      'Content-Length': String(Math.max(0, end - start + 1)),
      'Content-Type':
        contentTypes[extname(realFilePath).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })

    if (status === 206) {
      headers.set('Content-Range', `bytes ${start}-${end}/${fileStats.size}`)
    }

    const body =
      headOnly || fileStats.size === 0
        ? null
        : (Readable.toWeb(createReadStream(realFilePath, { start, end })) as ReadableStream)

    return new Response(body, { status, headers })
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return notFound()
    }
    return new Response('Unable to read file', { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filePath: string[] }> },
) {
  return serveUploadedFile(request, params)
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ filePath: string[] }> },
) {
  return serveUploadedFile(request, params, true)
}
