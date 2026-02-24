import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { Api } from 'telegram'

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0')
const API_HASH = process.env.TELEGRAM_API_HASH || ''

// In-memory store for active clients (server-side, per-request lifecycle)
const clientCache = new Map<string, TelegramClient>()

export async function getTelegramClient(sessionString: string): Promise<TelegramClient> {
  const cacheKey = sessionString.substring(0, 32)

  if (clientCache.has(cacheKey)) {
    const cached = clientCache.get(cacheKey)!
    if (cached.connected) return cached
  }

  const session = new StringSession(sessionString)
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: false,
  })

  await client.connect()
  clientCache.set(cacheKey, client)

  return client
}

export async function createTempClient(): Promise<TelegramClient> {
  const session = new StringSession('')
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: false,
  })
  await client.connect()
  return client
}

// Store temp clients by phone for OTP flow
const pendingAuthClients = new Map<string, TelegramClient>()
const pendingPhoneCodeHash = new Map<string, string>()

export function storePendingClient(phone: string, client: TelegramClient) {
  pendingAuthClients.set(phone, client)
}

export function getPendingClient(phone: string): TelegramClient | undefined {
  return pendingAuthClients.get(phone)
}

export function deletePendingClient(phone: string) {
  pendingAuthClients.delete(phone)
}

export function storePendingHash(phone: string, hash: string) {
  pendingPhoneCodeHash.set(phone, hash)
}

export function getPendingHash(phone: string): string | undefined {
  return pendingPhoneCodeHash.get(phone)
}

export function deletePendingHash(phone: string) {
  pendingPhoneCodeHash.delete(phone)
}

export { Api }
