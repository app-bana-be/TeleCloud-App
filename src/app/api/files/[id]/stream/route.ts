import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getTelegramClient } from '@/lib/telegram/client'
import { streamDownload } from '@/lib/telegram/download'

export const maxDuration = 300

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: file } = await supabase
      .from('files')
      .select('*, file_chunks(*)')
      .eq('id', id)
      .single()

    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const client = await getTelegramClient(session.telegramSession)

    let chatId: string | number = 'me'
    if (file.workspace_id) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('telegram_channel_id')
        .eq('id', file.workspace_id)
        .single()
      if (ws?.telegram_channel_id) chatId = ws.telegram_channel_id
    }

    const chunks = (file.file_chunks as Array<{
      chunk_index: number
      telegram_message_id: number
      sha256_hash: string
      size: number
    }>).map((c) => ({
      chunkIndex: c.chunk_index,
      telegramMessageId: c.telegram_message_id,
      sha256Hash: c.sha256_hash,
      size: c.size,
    }))

    // Create ReadableStream from async generator
    const generator = streamDownload(client, chatId, chunks)

    const readable = new ReadableStream({
      async pull(controller) {
        const { value, done } = await generator.next()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      },
    })

    const rangeHeader = req.headers.get('range')
    const totalSize = file.size || chunks.reduce((s: number, c: { size: number }) => s + c.size, 0)

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : totalSize - 1

        return new NextResponse(readable, {
          status: 206,
          headers: {
            'Content-Type': file.mime_type || 'application/octet-stream',
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': (end - start + 1).toString(),
          },
        })
      }
    }

    return new NextResponse(readable, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Content-Length': totalSize.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: unknown) {
    console.error('Stream error:', error)
    const msg = error instanceof Error ? error.message : 'Stream failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
