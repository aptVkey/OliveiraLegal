import 'server-only'
import Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'

// Chaves só no servidor (Vercel → Environment Variables). Nunca guardadas na base de dados.
const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
export const isStripeConfigured = /^(sk|rk)_(test|live)_/.test(stripeKey)
export const isWebhookConfigured = webhookSecret.startsWith('whsec_')
export const stripeMode: 'teste' | 'produção' | null = !isStripeConfigured ? null : stripeKey.includes('_live_') ? 'produção' : 'teste'
export const isBookingReady = isAdminConfigured && isStripeConfigured && isWebhookConfigured

let _stripe: Stripe | null = null
export function stripe(): Stripe {
  if (!isStripeConfigured) throw new Error('Stripe não configurado')
  return (_stripe ??= new Stripe(stripeKey, { maxNetworkRetries: 2, appInfo: { name: 'Oliveira Legal' } }))
}

// Funções da base de dados reservadas ao servidor (service_role, sem acesso às tabelas)
export const bookingDb = () => createAdminClient()

export function siteUrl(req: Request): string {
  const env = process.env.SITE_URL?.replace(/\/$/, '')
  return env || new URL(req.url).origin
}

// Pedido vindo do próprio site (bloqueia formulários de outros domínios)
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? new URL(req.url).host) } catch { return false }
}

// IP em hash diário (não guardamos o IP real) — usado só para limitar abusos
export function ipHash(req: Request): string | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
  if (!ip) return null
  return createHash('sha256').update(`${ip}|${new Date().toISOString().slice(0, 10)}|ol-booking`).digest('hex').slice(0, 32)
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

// Erros de negócio vindos da base de dados (P0001) podem ser mostrados; o resto não
export function publicError(error: { code?: string; message?: string } | null | undefined, fallback = 'Não foi possível concluir o pedido. Tente novamente.') {
  if (error?.code === 'P0001' && error.message) return error.message
  if (error) console.error('[agendamento]', error)
  return fallback
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
