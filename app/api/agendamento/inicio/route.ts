import { bookingDb, ipHash, isBookingReady, json, publicError, sameOrigin, UUID } from '@/lib/booking/server'

export const dynamic = 'force-dynamic'

// Passo 1: dados de contacto → a lead fica guardada no backoffice
export async function POST(req: Request) {
  if (!isBookingReady) return json({ error: 'As marcações online estão temporariamente indisponíveis.' }, 503)
  if (!sameOrigin(req)) return json({ error: 'Pedido inválido.' }, 403)
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return json({ error: 'Pedido inválido.' }, 400)
  const s = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '')

  if (s('website', 200)) return json({ token: crypto.randomUUID() }) // armadilha para robôs
  if (body.consent !== true) return json({ error: 'É necessário autorizar o tratamento dos dados.' }, 400)
  const name = s('name', 120), email = s('email', 200), phone = s('phone', 40)
  if (name.length < 2) return json({ error: 'Indique o seu nome.' }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Indique um e-mail válido.' }, 400)
  if (phone && !/^[+()\d\s.-]{6,40}$/.test(phone)) return json({ error: 'Indique um telefone válido.' }, 400)
  const token = s('token', 40)

  const { data, error } = await bookingDb().rpc('booking_start', {
    p_name: name, p_email: email, p_phone: phone || null, p_ip_hash: ipHash(req), p_token: UUID.test(token) ? token : null,
  })
  if (error || !data) return json({ error: publicError(error) }, 400)
  return json({ token: data })
}
