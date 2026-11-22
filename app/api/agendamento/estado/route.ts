import { bookingDb, isBookingReady, json, sameOrigin, UUID } from '@/lib/booking/server'

export const dynamic = 'force-dynamic'

// Estado da marcação no regresso do Stripe (o token vem no corpo, nunca no URL)
export async function POST(req: Request) {
  if (!isBookingReady || !sameOrigin(req)) return json({ error: 'Indisponível' }, 400)
  const body = await req.json().catch(() => null) as { token?: string } | null
  if (!body?.token || !UUID.test(body.token)) return json({ error: 'Pedido inválido.' }, 400)
  const { data } = await bookingDb().rpc('booking_public_status', { p_token: body.token })
  if (!data) return json({ error: 'Marcação não encontrada.' }, 404)
  return json(data)
}
