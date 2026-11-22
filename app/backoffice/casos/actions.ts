'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dbError, num, str, type FormState } from '@/lib/forms'

function caseFields(fd: FormData) {
  const status = str(fd, 'status') ?? 'aberto'
  return {
    title: str(fd, 'title'),
    client_id: str(fd, 'client_id'),
    area_id: str(fd, 'area_id'),
    opposing_party: str(fd, 'opposing_party'),
    status,
    billing_type: str(fd, 'billing_type') ?? 'hora',
    fixed_fee: num(fd, 'fixed_fee'),
    responsible_id: str(fd, 'responsible_id'),
    description: str(fd, 'description'),
    opened_at: str(fd, 'opened_at') ?? undefined,
    closed_at: status === 'fechado' ? str(fd, 'closed_at') ?? new Date().toISOString().slice(0, 10) : null,
  }
}

export async function createCase(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const f = caseFields(fd)
  if (!f.title) return { error: 'Indique o assunto do caso.' }
  if (!f.client_id) return { error: 'Escolha o cliente.' }
  const db = await createClient()
  const { data, error } = await db.from('cases').insert(f).select('id').single()
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/casos')
  redirect(`/backoffice/casos/${data.id}`)
}

export async function updateCase(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const id = str(fd, 'id')
  const f = caseFields(fd)
  if (!id || !f.title || !f.client_id) return { error: 'Preencha o assunto e o cliente.' }
  const db = await createClient()
  const { error } = await db.from('cases').update(f).eq('id', id)
  if (error) return { error: dbError(error) }
  revalidatePath('/backoffice/casos')
  revalidatePath(`/backoffice/casos/${id}`)
  return { ok: true, message: 'Caso atualizado.' }
}

export async function addCaseMember(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const case_id = str(fd, 'case_id'), member_id = str(fd, 'member_id')
  if (!case_id || !member_id) return { error: 'Escolha um membro.' }
  const db = await createClient()
  const { error } = await db.from('case_members').insert({ case_id, member_id })
  if (error) return { error: error.code === '23505' ? 'Este membro já está na equipa.' : dbError(error) }
  revalidatePath(`/backoffice/casos/${case_id}`)
  return { ok: true }
}

export async function removeCaseMember(fd: FormData) {
  await requireMember()
  const case_id = str(fd, 'case_id'), member_id = str(fd, 'member_id')
  if (!case_id || !member_id) return
  const db = await createClient()
  const { error } = await db.from('case_members').delete().eq('case_id', case_id).eq('member_id', member_id)
  if (error) throw new Error(dbError(error))
  revalidatePath(`/backoffice/casos/${case_id}`)
}
