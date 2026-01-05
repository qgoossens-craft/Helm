import OpenAI from 'openai'
import { db, getDocumentsPath } from '../database/db'
import { join, extname, basename } from 'path'
import { copyFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, statSync, writeFileSync } from 'fs'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import Tesseract from 'tesseract.js'
import { randomUUID } from 'crypto'

// Chunking configuration
const CHUNK_SIZE = 500 // target tokens per chunk
const CHUNK_OVERLAP = 50 // overlap tokens
const CHARS_PER_TOKEN = 4 // approximate

interface ProcessResult {
  success: boolean
  documentId: string
  error?: string
}

interface TextChunk {
  content: string
  tokenCount: number
  index: number
}

// Get OpenAI client (reuse settings from ai.ts pattern)
function getOpenAI(): OpenAI | null {
  const apiKey = db.settings.get('openai_api_key')
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

// Copy file to app storage
function storeFile(sourcePath: string, documentId: string): string {
  const documentsPath = getDocumentsPath()
  const docDir = join(documentsPath, documentId)

  if (!existsSync(docDir)) {
    mkdirSync(docDir, { recursive: true })
  }

  const ext = extname(sourcePath)
  const destPath = join(docDir, `original${ext}`)
  copyFileSync(sourcePath, destPath)

  return destPath
}

// Delete stored file
export function deleteStoredFile(documentId: string): void {
  const documentsPath = getDocumentsPath()
  const docDir = join(documentsPath, documentId)

  if (existsSync(docDir)) {
    const files = ['original.pdf', 'original.docx', 'original.txt', 'original.md',
                   'original.png', 'original.jpg', 'original.jpeg', 'original.gif', 'original.webp']
    for (const file of files) {
      const filePath = join(docDir, file)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    }
  }
}

// Extract text based on file type
async function extractText(filePath: string, fileType: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()

  // PDF
  if (ext === '.pdf' || fileType === 'application/pdf') {
    const buffer = readFileSync(filePath)
    const result = await pdfParse(buffer)
    return result.text
  }

  // Word DOCX
  if (ext === '.docx' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }

  // Plain text / Markdown
  if (['.txt', '.md', '.markdown'].includes(ext) || fileType.startsWith('text/')) {
    return readFileSync(filePath, 'utf-8')
  }

  // Images - OCR
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) || fileType.startsWith('image/')) {
    const result = await Tesseract.recognize(filePath, 'eng', {
      logger: (m) => console.log(`OCR: ${m.status} ${Math.round((m.progress || 0) * 100)}%`)
    })
    return result.data.text
  }

  throw new Error(`Unsupported file type: ${fileType}`)
}

// Split text into chunks with overlap
function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = []

  // Clean and normalize text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!cleanedText) return chunks

  const targetChars = CHUNK_SIZE * CHARS_PER_TOKEN
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN

  // Split by paragraphs first
  const paragraphs = cleanedText.split(/\n\n+/)

  let currentChunk = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds target, save current chunk
    if (currentChunk.length + paragraph.length > targetChars && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: Math.ceil(currentChunk.length / CHARS_PER_TOKEN),
        index: chunkIndex++
      })

      // Keep overlap from end of current chunk
      const words = currentChunk.split(/\s+/)
      const overlapWords = words.slice(-Math.ceil(overlapChars / 5)) // ~5 chars per word
      currentChunk = overlapWords.join(' ') + '\n\n'
    }

    currentChunk += paragraph + '\n\n'
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      tokenCount: Math.ceil(currentChunk.length / CHARS_PER_TOKEN),
      index: chunkIndex
    })
  }

  return chunks
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<Float32Array | null> {
  const openai = getOpenAI()
  if (!openai) {
    console.error('OpenAI API key not configured')
    return null
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit input length
      encoding_format: 'float'
    })

    return new Float32Array(response.data[0].embedding)
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    return null
  }
}

// Process document upload
export async function processUpload(
  sourcePath: string,
  taskId: string | null,
  projectId: string | null
): Promise<ProcessResult> {
  const fileName = basename(sourcePath)
  const fileType = getFileType(sourcePath)
  const fileSize = statSync(sourcePath).size

  // Check file size (50MB limit)
  if (fileSize > 50 * 1024 * 1024) {
    return { success: false, documentId: '', error: 'File too large (max 50MB)' }
  }

  // Create document record
  const document = db.documents.create({
    project_id: projectId,
    task_id: taskId,
    name: fileName,
    file_path: '', // Will update after copying
    file_type: fileType,
    file_size: fileSize
  })

  try {
    // Copy file to storage
    const storedPath = storeFile(sourcePath, document.id)

    // Update status to processing
    db.documents.updateStatus(document.id, 'processing')

    // Extract text
    const extractedText = await extractText(storedPath, fileType)

    if (!extractedText.trim()) {
      db.documents.updateStatus(document.id, 'completed', undefined, '')
      return { success: true, documentId: document.id }
    }

    // Chunk the text
    const chunks = chunkText(extractedText)

    // Store chunks and generate embeddings
    for (const chunk of chunks) {
      const storedChunk = db.chunks.create({
        document_id: document.id,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: chunk.tokenCount
      })

      // Generate and store embedding
      const embedding = await generateEmbedding(chunk.content)
      if (embedding) {
        db.embeddings.store(storedChunk.id, embedding)
      }
    }

    // Update status to completed
    db.documents.updateStatus(document.id, 'completed', undefined, extractedText)

    return { success: true, documentId: document.id }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    db.documents.updateStatus(document.id, 'failed', errorMessage)
    return { success: false, documentId: document.id, error: errorMessage }
  }
}

// Get file MIME type from extension
function getFileType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Search documents by query (for RAG)
export async function searchDocuments(
  query: string,
  options: { projectId?: string; taskId?: string; limit?: number } = {}
): Promise<Array<{ documentName: string; content: string; relevance: number }>> {
  const embedding = await generateEmbedding(query)
  if (!embedding) return []

  const results = db.embeddings.searchSimilar(
    embedding,
    options.limit || 3,
    options.projectId,
    options.taskId
  )

  return results.map(r => ({
    documentName: r.document_name,
    content: r.content,
    relevance: 1 - r.distance // Convert distance to similarity
  }))
}

// Get the stored file path for a document
export function getDocumentFilePath(documentId: string): string | null {
  const documentsPath = getDocumentsPath()
  const docDir = join(documentsPath, documentId)

  // Check for common extensions
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.docx', '.txt', '.md']
  for (const ext of extensions) {
    const filePath = join(docDir, `original${ext}`)
    if (existsSync(filePath)) {
      return filePath
    }
  }

  return null
}

// Get document as base64 data URL for preview
export function getDocumentDataUrl(documentId: string): string | null {
  const filePath = getDocumentFilePath(documentId)
  if (!filePath) return null

  try {
    const buffer = readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const ext = extname(filePath).toLowerCase()

    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }

    const mimeType = mimeTypes[ext] || 'application/octet-stream'
    return `data:${mimeType};base64,${base64}`
  } catch (err) {
    console.error('Failed to read file:', err)
    return null
  }
}

// Rename a document
export function renameDocument(documentId: string, newName: string): void {
  db.documents.updateName(documentId, newName)
}

// Delete document and all associated data
export function deleteDocument(documentId: string): void {
  // Delete chunks (embeddings cascade via foreign key)
  const chunks = db.chunks.getByDocument(documentId)
  for (const chunk of chunks) {
    db.embeddings.deleteByChunk(chunk.id)
  }
  db.chunks.deleteByDocument(documentId)

  // Delete stored file
  deleteStoredFile(documentId)

  // Delete document record
  db.documents.delete(documentId)
}

// Process clipboard image upload (base64 data)
export async function processClipboardUpload(
  base64Data: string,
  mimeType: string,
  taskId: string | null,
  projectId: string | null
): Promise<ProcessResult> {
  // Determine file extension from mime type
  const extMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp'
  }
  const ext = extMap[mimeType] || '.png'

  // Generate unique filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `screenshot-${timestamp}${ext}`

  // Write base64 to temp file
  const tempPath = join(getDocumentsPath(), `temp-${randomUUID()}${ext}`)

  try {
    // Decode base64 and write to file
    const buffer = Buffer.from(base64Data, 'base64')

    // Check file size (50MB limit)
    if (buffer.length > 50 * 1024 * 1024) {
      return { success: false, documentId: '', error: 'Image too large (max 50MB)' }
    }

    // Ensure documents directory exists
    const documentsPath = getDocumentsPath()
    if (!existsSync(documentsPath)) {
      mkdirSync(documentsPath, { recursive: true })
    }

    writeFileSync(tempPath, buffer)

    // Create document record
    const document = db.documents.create({
      project_id: projectId,
      task_id: taskId,
      name: fileName,
      file_path: '',
      file_type: mimeType,
      file_size: buffer.length
    })

    // Copy to permanent storage
    const docDir = join(documentsPath, document.id)
    if (!existsSync(docDir)) {
      mkdirSync(docDir, { recursive: true })
    }
    const storedPath = join(docDir, `original${ext}`)
    copyFileSync(tempPath, storedPath)

    // Clean up temp file
    unlinkSync(tempPath)

    // Update status to processing
    db.documents.updateStatus(document.id, 'processing')

    // Extract text via OCR
    const extractedText = await extractText(storedPath, mimeType)

    if (!extractedText.trim()) {
      db.documents.updateStatus(document.id, 'completed', undefined, '')
      return { success: true, documentId: document.id }
    }

    // Chunk the text
    const chunks = chunkText(extractedText)

    // Store chunks and generate embeddings
    for (const chunk of chunks) {
      const storedChunk = db.chunks.create({
        document_id: document.id,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: chunk.tokenCount
      })

      const embedding = await generateEmbedding(chunk.content)
      if (embedding) {
        db.embeddings.store(storedChunk.id, embedding)
      }
    }

    db.documents.updateStatus(document.id, 'completed', undefined, extractedText)
    return { success: true, documentId: document.id }
  } catch (error) {
    // Clean up temp file if it exists
    if (existsSync(tempPath)) {
      unlinkSync(tempPath)
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, documentId: '', error: errorMessage }
  }
}
