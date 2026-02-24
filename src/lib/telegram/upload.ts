import { TelegramClient } from 'telegram'
import { Api } from 'telegram'

const CHUNK_SIZE = 512 * 1024 // 512KB per Telegram upload part
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB per Telegram file limit
const PARALLEL_STREAMS = 8

export interface UploadProgress {
  chunkIndex: number
  totalChunks: number
  bytesUploaded: number
  totalBytes: number
  speed?: number
}

export interface UploadedChunk {
  chunkIndex: number
  telegramMessageId: number
  telegramFileId: string
  sha256Hash: string
  size: number
}

/**
 * Compute SHA-256 hash of a Uint8Array
 */
export async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Split an ArrayBuffer into 1GB chunks for large files
 */
export function splitIntoFileChunks(buffer: ArrayBuffer): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = []
  let offset = 0
  while (offset < buffer.byteLength) {
    const end = Math.min(offset + MAX_FILE_SIZE, buffer.byteLength)
    chunks.push(buffer.slice(offset, end))
    offset = end
  }
  return chunks
}

/**
 * Upload a single file chunk (<= 1GB) to Telegram as a document.
 * Returns the message ID and file reference.
 */
export async function uploadSingleChunk(
  client: TelegramClient,
  data: Uint8Array,
  fileName: string,
  mimeType: string,
  chatId: string | number,
  caption: string = ''
): Promise<{ messageId: number; fileId: string }> {
  const totalParts = Math.ceil(data.byteLength / CHUNK_SIZE)
  const fileId = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

  // Upload all parts with parallel streams
  const partIndices = Array.from({ length: totalParts }, (_, i) => i)

  // Process in batches of PARALLEL_STREAMS
  for (let i = 0; i < partIndices.length; i += PARALLEL_STREAMS) {
    const batch = partIndices.slice(i, i + PARALLEL_STREAMS)
    await Promise.all(
      batch.map(async (partIdx) => {
        const start = partIdx * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, data.byteLength)
        const part = data.slice(start, end)

        await client.invoke(
          new Api.upload.SaveFilePart({
            fileId,
            filePart: partIdx,
            bytes: Buffer.from(part),
          })
        )
      })
    )
  }

  // Send as document to the chat
  const inputFile = new Api.InputFile({
    id: fileId,
    parts: totalParts,
    name: fileName,
    md5Checksum: '',
  })

  const result = await client.invoke(
    new Api.messages.SendMedia({
      peer: await client.getInputEntity(chatId),
      media: new Api.InputMediaUploadedDocument({
        file: inputFile,
        mimeType,
        attributes: [
          new Api.DocumentAttributeFilename({ fileName }),
        ],
        nosoundVideo: false,
        forceFile: true,
      }),
      message: caption,
      randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    })
  )

  const updates = result as {
    updates?: Array<{ message?: { id: number; media?: { document?: { id?: { toString: () => string } } } } }>
    id?: number
  }

  let messageId = 0
  let documentId = ''

  if (updates.updates) {
    for (const update of updates.updates) {
      if (update.message?.id) {
        messageId = update.message.id
        if (update.message.media?.document?.id) {
          documentId = update.message.media.document.id.toString()
        }
        break
      }
    }
  }

  return { messageId, fileId: documentId }
}

/**
 * Full upload engine: handles chunking, hashing, parallel uploads
 */
export async function uploadFileToTelegram(
  client: TelegramClient,
  file: File | ArrayBuffer,
  fileName: string,
  mimeType: string,
  chatId: string | number,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedChunk[]> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file
  const fileChunks = splitIntoFileChunks(buffer)
  const totalChunks = fileChunks.length
  const uploadedChunks: UploadedChunk[] = []
  let bytesUploaded = 0

  for (let i = 0; i < fileChunks.length; i++) {
    const chunkData = new Uint8Array(fileChunks[i])
    const hash = await sha256(chunkData)

    const chunkFileName =
      totalChunks > 1 ? `${fileName}.part${i + 1}of${totalChunks}` : fileName
    const caption = JSON.stringify({
      telecloud: true,
      fileName,
      chunkIndex: i,
      totalChunks,
      sha256: hash,
    })

    const startTime = Date.now()
    const { messageId, fileId } = await uploadSingleChunk(
      client,
      chunkData,
      chunkFileName,
      mimeType,
      chatId,
      caption
    )

    bytesUploaded += chunkData.byteLength
    const elapsed = (Date.now() - startTime) / 1000
    const speed = chunkData.byteLength / elapsed

    uploadedChunks.push({
      chunkIndex: i,
      telegramMessageId: messageId,
      telegramFileId: fileId,
      sha256Hash: hash,
      size: chunkData.byteLength,
    })

    onProgress?.({
      chunkIndex: i,
      totalChunks,
      bytesUploaded,
      totalBytes: buffer.byteLength,
      speed,
    })
  }

  return uploadedChunks
}
