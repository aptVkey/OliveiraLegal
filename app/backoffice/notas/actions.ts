'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dbError, str, type FormState } from '@/lib/forms'

function refresh() {
  revalidatePath('/backoffice/leads/[id]', 'page')
  revalidatePath('/backoffice/clientes/[id]', 'page')
}

export async function addNote(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const body = str(fd, 'body')
  const lead_id = str(fd, 'lead_id'), client_id = str(fd, 'client_id')
  if (!body) return { error: 'Escreva a nota.' }
  if (body.length > 4000) return { error: 'A nota é demasiado longa (máx. 4000 caracteres).' }
  if (!lead_id && !client_id) return { error: 'Nota sem destino.' }
  const db = await createClient()
  const { error } = await db.from('notes').insert({ body, lead_id, client_id })
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true }
}

export async function updateNote(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const id = str(fd, 'id'), body = str(fd, 'body')
  if (!id || !body) return { error: 'Escreva a nota.' }
  if (body.length > 4000) return { error: 'A nota é demasiado longa (máx. 4000 caracteres).' }
  const db = await createClient()
  const { data, error } = await db.from('notes').update({ body }).eq('id', id).select('id')
  if (error) return { error: dbError(error) }
  if (!data?.length) return { error: 'Só pode editar as suas próprias notas.' }
  refresh()
  return { ok: true, message: 'Nota atualizada.' }
}

export async function deleteNote(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const id = str(fd, 'id')
  if (!id) return {}
  const db = await createClient()
  const { data, error } = await db.from('notes').delete().eq('id', id).select('id')
  if (error) return { error: dbError(error) }
  if (!data?.length) return { error: 'Não pode apagar esta nota.' }
  refresh()
  return { ok: true }
}
