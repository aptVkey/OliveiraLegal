import 'server-only'
import { bookingDb } from './server'
import { sendBookingEmails, type EmailContext } from './email'

// Envia os e-mails de uma marcação paga e regista o envio (usado pelo webhook e pelo backoffice)
export async function deliverBookingEmails(id: string): Promise<{ ok: boolean; reason?: string }> {
  const db = bookingDb()
  const { data, error } = await db.rpc('booking_email_context', { p_id: id })
  if (error || !data) return { ok: false, reason: 'Marcação não encontrada ou ainda não paga.' }
  const sent = await sendBookingEmails(data as EmailContext)
  if (!sent.client || !sent.office) return { ok: false, reason: 'O envio de e-mail não está configurado ou falhou.' }
  await db.rpc('booking_mark_emailed', { p_id: id })
  return { ok: true }
}
