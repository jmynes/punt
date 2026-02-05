---
sidebar_position: 7
---

# File Upload API

Endpoints for uploading files and managing attachments.

## Upload Configuration

### Get Upload Config

Retrieve current upload limits and allowed file types.

```http
GET /api/upload
```

#### Response

```json
{
  "maxImageSize": 5242880,
  "maxVideoSize": 52428800,
  "maxDocumentSize": 10485760,
  "allowedTypes": {
    "image": ["image/jpeg", "image/png", "image/gif", "image/webp"],
    "video": ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
    "document": ["application/pdf", "text/plain", "text/csv"]
  }
}
```

## Upload File

Upload a file to the server.

```http
POST /api/upload
Content-Type: multipart/form-data
```

### Request

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The file to upload |

### Response

```json
{
  "url": "/uploads/files/1705312800-abc123.png",
  "filename": "screenshot.png",
  "mimeType": "image/png",
  "size": 102400
}
```

### Validation

Files are validated against:

1. **MIME Type**: Must be in the allowed types list
2. **File Size**: Must not exceed category limit
3. **Extension**: Must match MIME type

## Allowed File Types

### Images

| Type | Extension | Max Size |
|------|-----------|----------|
| JPEG | `.jpg`, `.jpeg` | 5 MB |
| PNG | `.png` | 5 MB |
| GIF | `.gif` | 5 MB |
| WebP | `.webp` | 5 MB |

### Videos

| Type | Extension | Max Size |
|------|-----------|----------|
| MP4 | `.mp4` | 50 MB |
| WebM | `.webm` | 50 MB |
| OGG | `.ogg` | 50 MB |
| QuickTime | `.mov` | 50 MB |

### Documents

| Type | Extension | Max Size |
|------|-----------|----------|
| PDF | `.pdf` | 10 MB |
| Word | `.doc`, `.docx` | 10 MB |
| Excel | `.xls`, `.xlsx` | 10 MB |
| Text | `.txt` | 10 MB |
| CSV | `.csv` | 10 MB |

## Blocked File Types

The following types are blocked for security:

| Type | Reason |
|------|--------|
| SVG | XSS risk via embedded scripts |
| HTML | XSS risk |
| JavaScript | Code execution |
| Executable | Malware risk |

## Avatar Upload

Avatars have special handling. See [Authentication API](/api-reference/authentication#upload-avatar).

### Avatar Processing

Uploaded avatars are automatically:
- Resized to 256x256 pixels
- Converted to WebP format
- Stripped of metadata (EXIF, etc.)

## File Storage

### Storage Location

Files are stored in the `uploads/` directory:

```
uploads/
├── avatars/       # User avatars
├── attachments/   # Ticket attachments
└── files/         # General uploads
```

### Filename Generation

Uploaded files are renamed to prevent collisions:

```
{timestamp}-{random}.{extension}
```

Example: `1705312800-a1b2c3.png`

Original filenames are preserved in the database.

## Error Responses

### 400 Bad Request - Invalid Type

```json
{
  "error": "File type not allowed",
  "allowed": ["image/jpeg", "image/png", "image/gif", "image/webp"]
}
```

### 400 Bad Request - File Too Large

```json
{
  "error": "File too large",
  "maxSize": 5242880,
  "actualSize": 10485760
}
```

### 400 Bad Request - No File

```json
{
  "error": "No file provided"
}
```

### 413 Payload Too Large

```json
{
  "error": "Request body too large"
}
```

## Client-Side Validation

For better UX, validate files before upload:

```typescript
async function validateFile(file: File) {
  const config = await fetch('/api/upload').then(r => r.json())

  // Check type
  const category = getFileCategory(file.type)
  if (!category) {
    throw new Error('File type not allowed')
  }

  // Check size
  const maxSize = config[`max${category}Size`]
  if (file.size > maxSize) {
    throw new Error(`File too large (max ${formatBytes(maxSize)})`)
  }

  return true
}
```

## Security Considerations

### Content-Type Validation

The server validates both:
- The `Content-Type` header
- The actual file content (magic bytes)

This prevents type spoofing attacks.

### Path Traversal Prevention

Filenames are sanitized to prevent directory traversal:
- Only alphanumeric characters allowed
- No path separators
- Server-generated unique names

### XSS Prevention

SVG files are blocked because they can contain embedded JavaScript:

```xml
<!-- Malicious SVG example - blocked -->
<svg onload="alert('xss')">
</svg>
```

Use PNG or WebP for web graphics instead.
