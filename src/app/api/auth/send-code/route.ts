import { NextRequest, NextResponse } from 'next/server'
import {
  createTempClient,
  storePendingClient,
  storePendingHash,
} from '@/lib/telegram/client'

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0')
    const apiHash = process.env.TELEGRAM_API_HASH || ''

    if (!apiId || !apiHash) {
      return NextResponse.json(
        { error: 'Telegram API credentials not configured' },
        { status: 500 }
      )
    }

    const client = await createTempClient()

    const result = await client.invoke(
      new (await import('telegram')).Api.auth.SendCode({
        phoneNumber: phone,
        apiId,
        apiHash,
        settings: new (await import('telegram')).Api.CodeSettings({}),
      })
    )

    const phoneCodeHash = (result as { phoneCodeHash: string }).phoneCodeHash

    storePendingClient(phone, client)
    storePendingHash(phone, phoneCodeHash)

    return NextResponse.json({
      success: true,
      phoneCodeHash,
      message: 'Code sent to your Telegram app or SMS',
    })
  } catch (error: unknown) {
    console.error('Send code error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to send code'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
