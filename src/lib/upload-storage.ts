import { type FileStorage, FilesystemStorage } from '@/lib/file-storage'

// Use filesystem storage by default, can be swapped for testing
let fileStorage: FileStorage = new FilesystemStorage()

export function getFileStorage(): FileStorage {
  return fileStorage
}

// Export for testing - allows injection of mock storage
export function setFileStorage(storage: FileStorage): void {
  fileStorage = storage
}
