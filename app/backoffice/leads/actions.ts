'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dbError, num, str, type FormState } from '@/lib/forms'

function leadFields(fd: FormData) {
  return {
    name: str(fd, 'name'),
    company: str(fd, 'company'),
    email: str(fd, 'email'),
    phone: str(fd, 'phone'),
    source: str(fd, 'source') ?? 'outro',
    stage: str(fd, 'stage') ?? 'novo',
    area_id: str(fd, 'area_id'),
    owner_id: str(fd, 'owner_id'),
    estimated_value: num(fd, 'estimated_value'),
    notes: str(fd, 'notes'),
    lost_reason: str(fd, 'lost_reason'),
  }
}

export async function createLead(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const fields = leadFields(fd)
  if (!fields.name) return { error: 'Indique o nome do contacto.' }
  const db = await createClient()
  const { data, error } = await db.from('leads').insert(fields).select('id').single()
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/leads')
  redirect(`/backoffice/leads/${data.id}`)
}

export async function updateLead(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const id = str(fd, 'id')
  const fields = leadFields(fd)
  if (!id || !fields.name) return { error: 'Indique o nome do contacto.' }
  const db = await createClient()
  const { error } = await db.from('leads').update(fields).eq('id', id)
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/leads')
  revalidatePath(`/backoffice/leads/${id}`)
  return { ok: true, message: 'Lead atualizada.' }
}

const STAGES = ['novo', 'contactado', 'reuniao', 'proposta', 'ganho', 'perdido']

// Chamado pelo Kanban ao largar um cartão noutra coluna
export async function moveLead(id: string, stage: string): Promise<FormState> {
  await requireMember()
  if (!id || !STAGES.includes(stage)) return { error: 'Fase inválida.' }
  const db = await createClient()
  const { error } = await db.from('leads').update({ stage }).eq('id', id)
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/leads')
  revalidatePath(`/backoffice/leads/${id}`)
  revalidatePath('/backoffice')
  return { ok: true }
}

// Converte a lead em cliente numa só operação na base de dados:
// cria o cliente e passa para ele todas as notas da lead (sem duplicar se já estiver convertida)
export async function convertLead(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { data, error } = await db.rpc('convert_lead', { p_lead: id })
  if (error || !data) throw new Error(dbError(error))
  revalidatePath('/backoffice/leads')
  revalidatePath('/backoffice/clientes')
  redirect(`/backoffice/clientes/${data}`)
}

export async function deleteLead(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { error } = await db.from('leads').delete().eq('id', id)
  if (error) throw new Error(dbError(error))
  revalidatePath('/backoffice/leads')
  redirect('/backoffice/leads')
}
