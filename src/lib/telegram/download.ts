import { TelegramClient } from 'telegram'
import { Api } from 'telegram'
import { sha256 } from './upload'

const PARALLEL_STREAMS = 8

export interface DownloadProgress {
  chunkIndex: number
  totalChunks: number
  bytesDownloaded: number
  totalBytes: number
}

export interface ChunkInfo {
  chunkIndex: number
  telegramMessageId: number
  sha256Hash: string
  size: number
}

/**
 * Download a single message's document from Telegram
 */
export async function downloadTelegramMessage(
  client: TelegramClient,
  chatId: string | number,
  messageId: number
): Promise<Uint8Array> {
  const messages = await client.invoke(
    new Api.channels.GetMessages({
      channel: await client.getInputEntity(chatId),
      id: [new Api.InputMessageID({ id: messageId })],
    })
  )

  const msgList = messages as {
    messages?: Array<{ media?: { document?: object } }>
  }
  const msg = msgList.messages?.[0]

  if (!msg?.media?.document) {
    throw new Error(`Message ${messageId} has no document`)
  }

  const buffer = await client.downloadMedia(msg as object, {
    workers: PARALLEL_STREAMS,
  })

  if (!buffer) throw new Error(`Failed to download message ${messageId}`)
  return buffer instanceof Buffer ? new Uint8Array(buffer) : buffer as Uint8Array
}

/**
 * Download with integrity verification
 */
export async function downloadAndVerifyChunk(
  client: TelegramClient,
  chatId: string | number,
  chunk: ChunkInfo,
  retries = 3
): Promise<Uint8Array> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const data = await downloadTelegramMessage(client, chatId, chunk.telegramMessageId)
      const hash = await sha256(data)

      if (hash !== chunk.sha256Hash) {
        console.warn(
          `Hash mismatch for chunk ${chunk.chunkIndex} (attempt ${attempt + 1}): expected ${chunk.sha256Hash}, got ${hash}`
        )
        if (attempt === retries - 1) {
          throw new Error(`Integrity check failed for chunk ${chunk.chunkIndex} after ${retries} attempts`)
        }
        continue
      }

      return data
    } catch (e) {
      if (attempt === retries - 1) throw e
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw new Error(`Download failed for chunk ${chunk.chunkIndex}`)
}

/**
 * Download all chunks in parallel (batch of 8), verify, and reassemble
 */
export async function downloadFileFromTelegram(
  client: TelegramClient,
  chatId: string | number,
  chunks: ChunkInfo[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<Uint8Array> {
  const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex)
  const totalChunks = sortedChunks.length
  const results: Uint8Array[] = new Array(totalChunks)
  let bytesDownloaded = 0
  const totalBytes = chunks.reduce((sum, c) => sum + c.size, 0)

  // Process in batches of PARALLEL_STREAMS
  for (let i = 0; i < sortedChunks.length; i += PARALLEL_STREAMS) {
    const batch = sortedChunks.slice(i, i + PARALLEL_STREAMS)
    const batchResults = await Promise.all(
      batch.map((chunk) => downloadAndVerifyChunk(client, chatId, chunk))
    )
    batchResults.forEach((data, idx) => {
      const chunkIdx = sortedChunks[i + idx].chunkIndex
      results[chunkIdx] = data
      bytesDownloaded += data.byteLength

      onProgress?.({
        chunkIndex: chunkIdx,
        totalChunks,
        bytesDownloaded,
        totalBytes,
      })
    })
  }

  // Reassemble chunks
  const totalSize = results.reduce((sum, r) => sum + r.byteLength, 0)
  const assembled = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of results) {
    assembled.set(chunk, offset)
    offset += chunk.byteLength
  }

  return assembled
}

/**
 * Stream download - returns an async generator of chunks for streaming
 */
export async function* streamDownload(
  client: TelegramClient,
  chatId: string | number,
  chunks: ChunkInfo[]
): AsyncGenerator<Uint8Array> {
  const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex)

  // Prefetch next batch while yielding current
  for (let i = 0; i < sortedChunks.length; i += PARALLEL_STREAMS) {
    const batch = sortedChunks.slice(i, i + PARALLEL_STREAMS)
    const batchData = await Promise.all(
      batch.map((chunk) => downloadAndVerifyChunk(client, chatId, chunk))
    )
    for (const data of batchData) {
      yield data
    }
  }
}
