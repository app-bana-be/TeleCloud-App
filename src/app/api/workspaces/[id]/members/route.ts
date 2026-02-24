import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    const supabase = createAdminClient()

    // Check requester is workspace admin
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.userId)
      .single()

    if (membership?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite members' }, { status: 403 })
    }

    // Find invited user by phone
    const { data: invitedUser } = await supabase
      .from('users')
      .select('id, phone, first_name, last_name')
      .eq('phone', phone)
      .single()

    if (!invitedUser) {
      return NextResponse.json({ error: 'User with this phone number not found. They must sign in to TeleCloud first.' }, { status: 404 })
    }

    // Add member
    const { error } = await supabase.from('workspace_members').upsert({
      workspace_id: workspaceId,
      user_id: invitedUser.id,
      role: 'member',
    }, { onConflict: 'workspace_id,user_id' })

    if (error) {
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: invitedUser })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: members } = await supabase
      .from('workspace_members')
      .select('*, users(id, phone, username, first_name, last_name)')
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ members: members || [] })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
