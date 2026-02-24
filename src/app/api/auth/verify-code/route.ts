import { NextRequest, NextResponse } from 'next/server'
import {
  getPendingClient,
  getPendingHash,
  deletePendingClient,
  deletePendingHash,
} from '@/lib/telegram/client'
import { createAdminClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/session'
import { StringSession } from 'telegram/sessions'
import { Api } from 'telegram'

export async function POST(req: NextRequest) {
  try {
    const { phone, code, phoneCodeHash, password, firstName, lastName } = await req.json()

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 })
    }

    const client = getPendingClient(phone)
    const storedHash = getPendingHash(phone)

    if (!client) {
      return NextResponse.json(
        { error: 'Auth session expired. Please request a new code.' },
        { status: 400 }
      )
    }

    const hash = phoneCodeHash || storedHash

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash: hash,
          phoneCode: code,
        })
      )
    } catch (e: unknown) {
      const err = e as { errorMessage?: string; message?: string }
      const errMsg = err.errorMessage || err.message || ''

      if (errMsg === 'SESSION_PASSWORD_NEEDED') {
        if (!password) {
          return NextResponse.json({ require2FA: true }, { status: 200 })
        }
        // Handle 2FA
        const { computeCheck } = await import('telegram/Password')
        const passwordSrp = await client.invoke(new Api.account.GetPassword())
        const check = await computeCheck(passwordSrp, password)
        await client.invoke(new Api.auth.CheckPassword({ password: check }))
      } else if (errMsg.includes('PHONE_NUMBER_UNOCCUPIED')) {
        // New user signup
        await client.invoke(
          new Api.auth.SignUp({
            phoneNumber: phone,
            phoneCodeHash: hash,
            firstName: firstName || 'User',
            lastName: lastName || '',
          })
        )
      } else {
        throw e
      }
    }

    // Get session string
    const sessionString = (client.session as StringSession).save()

    // Get Telegram user info
    const me = await client.getMe()
    const tgUser = me as {
      id?: { toJSNumber?: () => number; valueOf?: () => number } | number
      username?: string
      firstName?: string
      lastName?: string
    }

    const telegramUserId =
      typeof tgUser.id === 'object' && tgUser.id
        ? (tgUser.id.toJSNumber?.() ?? tgUser.id.valueOf?.() ?? 0)
        : (tgUser.id as number) ?? 0

    // Upsert user in Supabase
    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        {
          phone,
          telegram_session: sessionString,
          telegram_user_id: telegramUserId,
          username: tgUser.username || null,
          first_name: tgUser.firstName || null,
          last_name: tgUser.lastName || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
      .select()
      .single()

    if (error || !user) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: 'Failed to save user' }, { status: 500 })
    }

    // Create JWT session
    await createSession({
      userId: user.id,
      phone,
      telegramSession: sessionString,
    })

    // Cleanup pending auth state
    deletePendingClient(phone)
    deletePendingHash(phone)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    })
  } catch (error: unknown) {
    console.error('Verify code error:', error)
    const msg = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
