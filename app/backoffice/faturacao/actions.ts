'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { dbError, str, type FormState } from '@/lib/forms'

async function requireManager() {
  const me = await requireMember()
  if (!CAN.billing(me.role)) throw new Error('Não tem permissão para faturar.')
  return me
}

export async function createPreInvoice(_: FormState, fd: FormData): Promise<FormState> {
  await requireManager()
  const client = str(fd, 'client_id')
  if (!client) return { error: 'Cliente em falta.' }
  const db = await createClient()
  const { data, error } = await db.rpc('create_pre_invoice', { p_client: client, p_notes: str(fd, 'notes') })
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice', 'layout')
  redirect(`/backoffice/faturacao/${data}`)
}

export async function markIssued(fd: FormData) {
  await requireManager()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { error } = await db.from('invoices').update({ status: 'emitida' }).eq('id', id).eq('status', 'rascunho')
  if (error) throw new Error(dbError(error))
  revalidatePath('/backoffice/faturacao')
  revalidatePath(`/backoffice/faturacao/${id}`)
}

export async function cancelPreInvoice(fd: FormData) {
  await requireManager()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { error } = await db.rpc('cancel_pre_invoice', { p_invoice: id })
  if (error) throw new Error(dbError(error))
  revalidatePath('/backoffice', 'layout')
}
