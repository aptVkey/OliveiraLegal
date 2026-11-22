'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bool, dbError, num, str, type FormState } from '@/lib/forms'
import { CAN, ROLES } from '@/lib/roles'

export async function saveRoleRates(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireMember()
  if (!CAN.manageRates(me.role)) return { error: 'Sem permissão para alterar taxas.' }
  const rows = Object.keys(ROLES).map(role => ({ role, hourly_rate: num(fd, `rate_${role}`) ?? 0 }))
  if (rows.some(r => r.hourly_rate < 0)) return { error: 'As taxas não podem ser negativas.' }
  const db = await createClient()
  const { error } = await db.from('role_rates').upsert(rows)
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice', 'layout')
  return { ok: true, message: 'Taxas guardadas. Aplicam-se aos novos registos de tempo.' }
}

export async function saveIncrement(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireMember()
  if (me.role !== 'socio') return { error: 'Só um sócio pode alterar esta definição.' }
  const inc = num(fd, 'time_increment')
  if (!inc || inc < 1 || inc > 60) return { error: 'Indique um valor entre 1 e 60 minutos.' }
  const db = await createClient()
  const { error } = await db.from('office_settings').update({ time_increment: Math.round(inc) }).eq('id', 1)
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/definicoes')
  return { ok: true, message: 'Guardado.' }
}

export async function addArea(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireMember()
  if (me.role !== 'socio') return { error: 'Só um sócio pode gerir as áreas.' }
  const name = str(fd, 'name')
  if (!name) return { error: 'Indique o nome da área.' }
  const db = await createClient()
  const { error } = await db.from('practice_areas').insert({ name })
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/definicoes')
  return { ok: true }
}

export async function toggleArea(fd: FormData) {
  const me = await requireMember()
  if (me.role !== 'socio') return
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { error } = await db.from('practice_areas').update({ active: bool(fd, 'active') }).eq('id', id)
  if (error) throw new Error(dbError(error))
  revalidatePath('/backoffice/definicoes')
}
