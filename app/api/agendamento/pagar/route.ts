import { bookingDb, isBookingReady, json, publicError, sameOrigin, siteUrl, stripe, UUID } from '@/lib/booking/server'
import { MODE_LABEL, hour, longDate } from '@/lib/booking/format'

export const dynamic = 'force-dynamic'

type Checkout = { id: string; reference: string; name: string; email: string; amount_cents: number; currency: string
  starts_at: string; ends_at: string; mode: 'presencial' | 'online'; hold_until: string }

// Último passo: reserva o horário e abre o Stripe Checkout
export async function POST(req: Request) {
  if (!isBookingReady) return json({ error: 'As marcações online estão temporariamente indisponíveis.' }, 503)
  if (!sameOrigin(req)) return json({ error: 'Pedido inválido.' }, 403)
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const token = typeof body?.token === 'string' ? body.token : ''
  const startsAt = typeof body?.startsAt === 'string' ? body.startsAt : ''
  const mode = body?.mode === 'presencial' || body?.mode === 'online' ? body.mode : null
  const area = typeof body?.areaId === 'string' && UUID.test(body.areaId) ? body.areaId : null
  const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 1500) : ''
  if (!UUID.test(token)) return json({ error: 'A sessão expirou. Recomece, por favor.' }, 400)
  if (!mode) return json({ error: 'Escolha se prefere uma reunião presencial ou online.' }, 400)
  if (Number.isNaN(Date.parse(startsAt))) return json({ error: 'Escolha o dia e a hora.' }, 400)

  const db = bookingDb()
  const { data, error } = await db.rpc('booking_checkout', {
    p_token: token, p_starts_at: startsAt, p_mode: mode, p_area: area, p_topic: topic || null,
  })
  const b = (data as Checkout[] | null)?.[0]
  if (error || !b) return json({ error: publicError(error) }, 409)

  const base = siteUrl(req)
  const label = `Consulta jurídica ${MODE_LABEL[b.mode].toLowerCase()} · ${longDate(b.starts_at)}, ${hour(b.starts_at)}`
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'pt',
      customer_email: b.email,
      client_reference_id: b.id,
      metadata: { booking_id: b.id, reference: b.reference },
      payment_intent_data: { description: `${b.reference} · ${label}`, metadata: { booking_id: b.id, reference: b.reference } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: b.currency,
          unit_amount: b.amount_cents,
          product_data: { name: label, description: `Oliveira Legal · Referência ${b.reference}` },
        },
      }],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // a reserva do horário dura 40 min
      success_url: `${base}/?agendamento=sucesso#agendar`,
      cancel_url: `${base}/?agendamento=cancelado#agendar`,
    }, { idempotencyKey: `booking-${b.id}-${b.hold_until}` })
    await db.rpc('booking_attach_session', { p_id: b.id, p_session: session.id })
    return json({ url: session.url, reference: b.reference })
  } catch (e) {
    console.error('[stripe]', e)
    return json({ error: 'Não foi possível abrir o pagamento. Tente novamente dentro de instantes.' }, 502)
  }
}
