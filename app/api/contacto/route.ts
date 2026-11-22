import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { ipHash, json, publicError, sameOrigin } from '@/lib/booking/server'
import { sendContactEmails } from '@/lib/booking/email'

export const dynamic = 'force-dynamic'

// Formulário de contacto: guarda a lead (origem "site") e envia os e-mails
export async function POST(req: Request) {
  if (!isAdminConfigured) return json({ error: 'O envio está temporariamente indisponível.' }, 503)
  if (!sameOrigin(req)) return json({ error: 'Pedido inválido.' }, 403)
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return json({ error: 'Pedido inválido.' }, 400)
  const s = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '')

  if (s('website', 200)) return json({ ok: true }) // armadilha para robôs
  if (body.consent !== true) return json({ error: 'É necessário autorizar o tratamento dos dados.' }, 400)
  const name = s('name', 120), email = s('email', 200), subject = s('subject', 80), message = s('message', 4000)
  if (name.length < 2) return json({ error: 'Indique o seu nome.' }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Indique um e-mail válido.' }, 400)
  if (message.length < 5) return json({ error: 'Escreva uma mensagem.' }, 400)

  const { error } = await createAdminClient().rpc('contact_submit', {
    p_name: name, p_email: email, p_area: subject, p_message: message, p_ip_hash: ipHash(req),
  })
  if (error) return json({ error: publicError(error) }, error.code === 'P0001' ? 400 : 500)

  // A lead já está guardada; se o e-mail falhar, o pedido não se perde
  const sent = await sendContactEmails({ name, email, subject, message })
  if (!sent.office) console.error('[contacto] e-mail para o escritório não enviado')
  return json({ ok: true })
}
