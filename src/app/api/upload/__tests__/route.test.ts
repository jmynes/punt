import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createMockFile, createMockFormData } from '@/__tests__/utils/mocks'
import { InMemoryStorage, FilesystemStorage } from '@/lib/file-storage'
import { POST, GET, setFileStorage } from '../route'

describe('Upload API Route', () => {
  let mockStorage: InMemoryStorage

  beforeEach(() => {
    // Use in-memory storage for tests
    mockStorage = new InMemoryStorage()
    setFileStorage(mockStorage)
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockStorage.clear()
    // Reset to default storage
    setFileStorage(new FilesystemStorage())
  })

  describe('POST /api/upload', () => {
    it('should return 400 if no files provided', async () => {
      const formData = new FormData()
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No files provided')
    })

    it('should reject invalid file types', async () => {
      const invalidFile = createMockFile('test.exe', 'application/x-msdownload', 1024)
      const formData = createMockFormData([invalidFile])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('File type not allowed')
    })

    it('should reject files that are too large', async () => {
      // Create a file that's actually 11MB (larger than the 10MB limit)
      const largeContent = new Array(11 * 1024 * 1024).fill(0).map(() => 'a').join('')
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const formData = createMockFormData([largeFile])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('File too large')
    })

    it('should successfully upload a valid image file', async () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg', 1024)
      const formData = createMockFormData([imageFile])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.files).toHaveLength(1)
      expect(data.files[0].category).toBe('image')
      expect(data.files[0].mimetype).toBe('image/jpeg')
      // File name might be 'blob' in test environment, so we check that it's set
      expect(data.files[0].originalName).toBeTruthy()
      // Verify file was written to storage
      const storedFiles = Array.from((mockStorage as any).files.keys())
      expect(storedFiles.length).toBeGreaterThan(0)
    })

    it('should successfully upload a valid video file', async () => {
      const videoFile = createMockFile('test.mp4', 'video/mp4', 5 * 1024 * 1024)
      const formData = createMockFormData([videoFile])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.files[0].category).toBe('video')
    })

    it('should successfully upload multiple files', async () => {
      const file1 = createMockFile('test1.jpg', 'image/jpeg', 1024)
      const file2 = createMockFile('test2.png', 'image/png', 2048)
      const formData = createMockFormData([file1, file2])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.files).toHaveLength(2)
    })

    it('should generate unique filenames', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const formData = createMockFormData([file])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      // The filename is generated with a timestamp and random string
      expect(data.files[0].filename).toBeTruthy()
      expect(data.files[0].filename).not.toBe(data.files[0].originalName)
      expect(data.files[0].originalName).toBeTruthy()
    })

    it('should return 500 on file system error', async () => {
      // Create a storage that throws errors
      const errorStorage = {
        ensureDirectoryExists: vi.fn().mockRejectedValue(new Error('File system error')),
        writeFile: vi.fn().mockRejectedValue(new Error('File system error')),
        join: (...paths: string[]) => paths.join('/'),
      }
      setFileStorage(errorStorage)

      const file = createMockFile('test.jpg', 'image/jpeg', 1024)
      const formData = createMockFormData([file])
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to upload file')
    })
  })

  describe('GET /api/upload', () => {
    it('should return allowed types and max sizes', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.allowedTypes).toBeDefined()
      expect(data.maxSizes).toBeDefined()
      expect(data.maxSizes.image).toBe(10 * 1024 * 1024)
      expect(data.maxSizes.video).toBe(100 * 1024 * 1024)
      expect(data.maxSizes.document).toBe(25 * 1024 * 1024)
    })
  })
})
