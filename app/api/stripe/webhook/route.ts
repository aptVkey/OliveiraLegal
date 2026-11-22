import type Stripe from 'stripe'
import { bookingDb, isBookingReady, json, stripe, webhookSecret } from '@/lib/booking/server'
import { deliverBookingEmails } from '@/lib/booking/deliver'

export const dynamic = 'force-dynamic'

// Webhook do Stripe: única forma de uma marcação ficar "paga" (assinatura verificada)
export async function POST(req: Request) {
  if (!isBookingReady) return json({ error: 'not configured' }, 503)
  const sig = req.headers.get('stripe-signature')
  if (!sig) return json({ error: 'missing signature' }, 400)
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(raw, sig, webhookSecret)
  } catch {
    return json({ error: 'invalid signature' }, 400)
  }

  const db = bookingDb()
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object
      if (s.payment_status !== 'paid') break // p. ex. Multibanco: aguarda async_payment_succeeded
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id ?? null
      const { data, error } = await db.rpc('booking_mark_paid', { p_session: s.id, p_payment_intent: pi, p_amount: s.amount_total })
      if (error) { console.error('[webhook]', error); return json({ error: 'db' }, 500) } // o Stripe volta a tentar
      const paid = (data as { id: string }[] | null)?.[0]
      if (paid) {
        const r = await deliverBookingEmails(paid.id)
        if (!r.ok) console.error('[webhook] e-mails por enviar', paid.id, r.reason)
      }
      break
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      await db.rpc('booking_expire_session', { p_session: event.data.object.id })
      break
  }
  return json({ received: true })
}
