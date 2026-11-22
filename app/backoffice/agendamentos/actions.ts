'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bool, dbError, num, str, type FormState } from '@/lib/forms'
import { deliverBookingEmails } from '@/lib/booking/deliver'
import { isAdminConfigured } from '@/lib/supabase/admin'

const PATH = '/backoffice/agendamentos'
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

async function socio() {
  const me = await requireMember()
  return me.role === 'socio' ? me : null
}

export async function saveBookingSettings(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await socio())) return { error: 'Só um sócio pode alterar a agenda.' }
  const cents = (k: string) => { const v = num(fd, k); return v == null ? null : Math.round(v * 100) }
  const row = {
    enabled: bool(fd, 'enabled'),
    title: str(fd, 'title') ?? 'Marque a sua consulta',
    intro: str(fd, 'intro'),
    duration_min: num(fd, 'duration_min'),
    step_min: num(fd, 'step_min'),
    min_notice_hours: num(fd, 'min_notice_hours'),
    max_days_ahead: num(fd, 'max_days_ahead'),
    presencial_enabled: bool(fd, 'presencial_enabled'),
    online_enabled: bool(fd, 'online_enabled'),
    price_presencial: cents('price_presencial'),
    price_online: cents('price_online'),
    address: str(fd, 'address'),
    online_instructions: str(fd, 'online_instructions'),
    notify_email: str(fd, 'notify_email')?.toLowerCase() ?? null,
  }
  if (!row.presencial_enabled && !row.online_enabled) return { error: 'Ative pelo menos um formato (presencial ou online).' }
  if (row.price_presencial == null || row.price_online == null || row.price_presencial < 50 || row.price_online < 50)
    return { error: 'Os preços têm de ser de pelo menos 0,50 €.' }
  if ([row.duration_min, row.step_min, row.min_notice_hours, row.max_days_ahead].some(v => v == null))
    return { error: 'Preencha a duração, o intervalo, a antecedência e o horizonte.' }
  const db = await createClient()
  const { error } = await db.from('booking_settings').update(row).eq('id', 1)
  if (error) return { error: dbError(error) }
  revalidatePath(PATH, 'layout')
  return { ok: true, message: row.enabled ? 'Guardado. A marcação online está ativa no site.' : 'Guardado. A marcação online está desligada.' }
}

export async function addHours(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await socio())) return { error: 'Só um sócio pode alterar o horário.' }
  const weekday = num(fd, 'weekday'), start = str(fd, 'start_time'), end = str(fd, 'end_time')
  if (!weekday || weekday < 1 || weekday > 7) return { error: 'Escolha o dia da semana.' }
  if (!start || !end || !TIME.test(start) || !TIME.test(end)) return { error: 'Indique as horas no formato 09:30.' }
  if (end <= start) return { error: 'A hora de fim tem de ser depois da hora de início.' }
  const db = await createClient()
  const { error } = await db.from('booking_hours').insert({ weekday, start_time: start, end_time: end })
  if (error) return { error: dbError(error) }
  revalidatePath(`${PATH}/definicoes`)
  return { ok: true }
}

export async function removeHours(fd: FormData) {
  if (!(await socio())) return
  const id = str(fd, 'id'); if (!id) return
  const db = await createClient()
  const { error } = await db.from('booking_hours').delete().eq('id', id)
  if (error) throw new Error(dbError(error))
  revalidatePath(`${PATH}/definicoes`)
}

export async function addBlocked(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await socio())) return { error: 'Só um sócio pode bloquear dias.' }
  const from = str(fd, 'day'), to = str(fd, 'until') ?? from, reason = str(fd, 'reason')
  if (!from || !DAY.test(from) || !to || !DAY.test(to) || to < from) return { error: 'Indique datas válidas.' }
  const rows: { day: string; reason: string | null }[] = []
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to && rows.length < 120; d.setUTCDate(d.getUTCDate() + 1))
    rows.push({ day: d.toISOString().slice(0, 10), reason })
  const db = await createClient()
  const { error } = await db.from('booking_blocked').upsert(rows)
  if (error) return { error: dbError(error) }
  revalidatePath(`${PATH}/definicoes`)
  return { ok: true, message: rows.length > 1 ? `${rows.length} dias bloqueados.` : 'Dia bloqueado.' }
}

export async function removeBlocked(fd: FormData) {
  if (!(await socio())) return
  const day = str(fd, 'day'); if (!day || !DAY.test(day)) return
  const db = await createClient()
  const { error } = await db.from('booking_blocked').delete().eq('day', day)
  if (error) throw new Error(dbError(error))
  revalidatePath(`${PATH}/definicoes`)
}

export async function cancelBooking(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id'); if (!id) return
  const db = await createClient()
  const { error } = await db.rpc('booking_cancel', { p_id: id })
  if (error) throw new Error(dbError(error))
  revalidatePath(PATH)
}

export async function resendBookingEmails(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const id = str(fd, 'id'); if (!id) return { error: 'Marcação inválida.' }
  if (!isAdminConfigured) return { error: 'O servidor ainda não tem a chave secreta configurada.' }
  // Confirma com a sessão do membro (RLS) que a marcação existe e está paga
  const db = await createClient()
  const { data } = await db.from('bookings').select('id, status').eq('id', id).maybeSingle()
  if (!data || !['pago', 'conflito'].includes(data.status)) return { error: 'Só é possível enviar e-mails de marcações pagas.' }
  const r = await deliverBookingEmails(id)
  revalidatePath(PATH)
  return r.ok ? { ok: true, message: 'E-mails enviados ao cliente e ao escritório.' } : { error: r.reason }
}
