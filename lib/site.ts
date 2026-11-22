import 'server-only'
import { headers } from 'next/headers'

// Endereço público do site, para links enviados por e-mail (convites, recuperação)
export async function appUrl(): Promise<string> {
  const env = process.env.SITE_URL?.replace(/\/$/, '')
  if (env) return env
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export const authRedirect = async () => `${await appUrl()}/auth/confirm`
