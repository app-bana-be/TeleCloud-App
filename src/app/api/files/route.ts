import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getTelegramClient } from '@/lib/telegram/client'
import { uploadFileToTelegram } from '@/lib/telegram/upload'

export const maxDuration = 300 // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null
    const workspaceId = formData.get('workspaceId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Determine which Telegram channel to upload to
    let chatId: string | number = 'me' // Default: user's saved messages

    if (workspaceId) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('telegram_channel_id, telegram_channel_username')
        .eq('id', workspaceId)
        .single()

      if (workspace?.telegram_channel_id) {
        chatId = workspace.telegram_channel_id
      } else if (workspace?.telegram_channel_username) {
        chatId = workspace.telegram_channel_username
      }
    }

    // Get Telegram client for this user
    const client = await getTelegramClient(session.telegramSession)

    // Create file record in DB (status: uploading)
    const { data: fileRecord, error: insertError } = await supabase
      .from('files')
      .insert({
        name: file.name,
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size: file.size,
        folder_id: folderId || null,
        owner_id: session.userId,
        workspace_id: workspaceId || null,
        status: 'uploading',
      })
      .select()
      .single()

    if (insertError || !fileRecord) {
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    // Upload to Telegram
    const uploadedChunks = await uploadFileToTelegram(
      client,
      file,
      file.name,
      file.type || 'application/octet-stream',
      chatId
    )

    // Store chunk records in DB
    const chunkInserts = uploadedChunks.map((chunk) => ({
      file_id: fileRecord.id,
      chunk_index: chunk.chunkIndex,
      telegram_message_id: chunk.telegramMessageId,
      telegram_file_id: chunk.telegramFileId,
      sha256_hash: chunk.sha256Hash,
      size: chunk.size,
      status: 'ready',
    }))

    await supabase.from('file_chunks').insert(chunkInserts)

    // Update file record to ready
    await supabase
      .from('files')
      .update({
        status: 'ready',
        total_chunks: uploadedChunks.length,
        is_chunked: uploadedChunks.length > 1,
        telegram_message_ids: uploadedChunks.map((c) => c.telegramMessageId),
        telegram_file_ids: uploadedChunks.map((c) => c.telegramFileId),
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileRecord.id)

    return NextResponse.json({
      success: true,
      file: {
        ...fileRecord,
        status: 'ready',
        totalChunks: uploadedChunks.length,
      },
    })
  } catch (error: unknown) {
    console.error('Upload error:', error)
    const msg = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get('folderId')
    const workspaceId = searchParams.get('workspaceId')
    const view = searchParams.get('view') || 'all' // all, recent, trash

    const supabase = createAdminClient()

    let query = supabase
      .from('files')
      .select(`
        *,
        file_chunks(chunk_index, sha256_hash, size, status)
      `)

    if (view === 'trash') {
      query = query.eq('status', 'deleted')
    } else {
      query = query.neq('status', 'deleted')
    }

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    } else {
      query = query.eq('owner_id', session.userId).is('workspace_id', null)
    }

    if (folderId) {
      query = query.eq('folder_id', folderId)
    } else if (!workspaceId) {
      query = query.is('folder_id', null)
    }

    if (view === 'recent') {
      query = query.order('created_at', { ascending: false }).limit(20)
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data: files, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ files: files || [] })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to list files'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
