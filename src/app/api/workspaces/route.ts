import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()

    // Get workspaces user is admin of or member of
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(*)')
      .eq('user_id', session.userId)

    const workspaces = memberships?.map((m) => ({
      ...m.workspaces,
      role: m.role,
    })) || []

    return NextResponse.json({ workspaces })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name,
        description: description || null,
        admin_id: session.userId,
      })
      .select()
      .single()

    if (error || !workspace) {
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
    }

    // Add creator as admin member
    await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: session.userId,
      role: 'admin',
    })

    return NextResponse.json({ workspace })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
