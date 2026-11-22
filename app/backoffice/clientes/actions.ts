'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bool, dbError, str, type FormState } from '@/lib/forms'

function clientFields(fd: FormData) {
  const consent = bool(fd, 'rgpd_consent')
  return {
    kind: str(fd, 'kind') ?? 'particular',
    name: str(fd, 'name'),
    nif: str(fd, 'nif'),
    email: str(fd, 'email'),
    phone: str(fd, 'phone'),
    address: str(fd, 'address'),
    notes: str(fd, 'notes'),
    rgpd_consent: consent,
  }
}

function validNif(nif: string | null) {
  return !nif || /^[0-9A-Z]{6,14}$/i.test(nif.replace(/\s/g, ''))
}

export async function createClientRecord(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const f = clientFields(fd)
  if (!f.name) return { error: 'Indique o nome do cliente.' }
  if (!validNif(f.nif)) return { error: 'O NIF parece inválido.' }
  const db = await createClient()
  const { data, error } = await db.from('clients')
    .insert({ ...f, consent_at: f.rgpd_consent ? new Date().toISOString() : null })
    .select('id').single()
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/clientes')
  redirect(`/backoffice/clientes/${data.id}`)
}

export async function updateClientRecord(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const id = str(fd, 'id')
  const f = clientFields(fd)
  if (!id || !f.name) return { error: 'Indique o nome do cliente.' }
  if (!validNif(f.nif)) return { error: 'O NIF parece inválido.' }
  const db = await createClient()
  const { data: prev } = await db.from('clients').select('rgpd_consent').eq('id', id).single()
  const consent_at = f.rgpd_consent && !prev?.rgpd_consent ? new Date().toISOString()
    : !f.rgpd_consent ? null : undefined
  const { error } = await db.from('clients').update({ ...f, ...(consent_at !== undefined ? { consent_at } : {}) }).eq('id', id)
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/clientes')
  revalidatePath(`/backoffice/clientes/${id}`)
  return { ok: true, message: 'Cliente atualizado.' }
}

export async function toggleArchiveClient(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { error } = await db.from('clients').update({ archived: bool(fd, 'archived') }).eq('id', id)
  if (error) throw new Error(dbError(error))
  revalidatePath('/backoffice/clientes')
  revalidatePath(`/backoffice/clientes/${id}`)
}

export async function addClientMember(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const client_id = str(fd, 'client_id'), member_id = str(fd, 'member_id')
  if (!client_id || !member_id) return { error: 'Escolha um membro.' }
  const db = await createClient()
  const { error } = await db.from('client_members').insert({ client_id, member_id })
  if (error) return { error: error.code === '23505' ? 'Este membro já está associado.' : dbError(error) }
  revalidatePath(`/backoffice/clientes/${client_id}`)
  revalidatePath('/backoffice/clientes')
  return { ok: true }
}

export async function removeClientMember(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const client_id = str(fd, 'client_id'), member_id = str(fd, 'member_id')
  if (!client_id || !member_id) return {}
  const db = await createClient()
  const { error } = await db.from('client_members').delete().eq('client_id', client_id).eq('member_id', member_id)
  if (error) return { error: dbError(error) }
  revalidatePath(`/backoffice/clientes/${client_id}`)
  revalidatePath('/backoffice/clientes')
  return { ok: true }
}
