import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getTelegramClient } from '@/lib/telegram/client'
import { downloadFileFromTelegram } from '@/lib/telegram/download'

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

    // Fetch file + chunks
    const { data: file, error } = await supabase
      .from('files')
      .select(`
        *,
        file_chunks(*)
      `)
      .eq('id', id)
      .single()

    if (error || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Access control
    const hasAccess = file.owner_id === session.userId || (
      file.workspace_id && await checkWorkspaceAccess(file.workspace_id, session.userId, supabase)
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const client = await getTelegramClient(session.telegramSession)

    // Determine chat ID
    let chatId: string | number = 'me'
    if (file.workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('telegram_channel_id, telegram_channel_username')
        .eq('id', file.workspace_id)
        .single()
      if (workspace?.telegram_channel_id) chatId = workspace.telegram_channel_id
      else if (workspace?.telegram_channel_username) chatId = workspace.telegram_channel_username
    }

    // Download with integrity checks
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

    const data = await downloadFileFromTelegram(client, chatId, chunks)

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_name)}"`,
        'Content-Length': data.byteLength.toString(),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: unknown) {
    console.error('Download error:', error)
    const msg = error instanceof Error ? error.message : 'Download failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
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

    const { data: file, error } = await supabase
      .from('files')
      .select('*, workspaces(admin_id)')
      .eq('id', id)
      .single()

    if (error || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Permission: owner can delete, workspace admin can delete
    const isOwner = file.owner_id === session.userId
    const workspace = file.workspaces as { admin_id?: string } | null
    const isWorkspaceAdmin = workspace?.admin_id === session.userId

    if (!isOwner && !isWorkspaceAdmin) {
      return NextResponse.json({ error: 'Only owners or workspace admins can delete files' }, { status: 403 })
    }

    // Soft delete: move to trash
    await supabase.from('trash').insert({
      file_id: id,
      deleted_by: session.userId,
      restore_data: {
        folder_id: file.folder_id,
        workspace_id: file.workspace_id,
        name: file.name,
      },
    })

    await supabase
      .from('files')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function checkWorkspaceAccess(
  workspaceId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<boolean> {
  const { data } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()
  return !!data
}
