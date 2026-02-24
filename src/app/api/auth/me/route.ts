import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    const supabase = createAdminClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, phone, username, first_name, last_name, telegram_user_id')
      .eq('id', session.userId)
      .single()

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
