'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dbError, str, type FormState } from '@/lib/forms'

function refresh(caseId?: string | null) {
  revalidatePath('/backoffice/tarefas')
  revalidatePath('/backoffice')
  if (caseId) revalidatePath(`/backoffice/casos/${caseId}`)
}

export async function createTask(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireMember()
  const title = str(fd, 'title')
  if (!title) return { error: 'Indique a tarefa.' }
  const case_id = str(fd, 'case_id')
  const db = await createClient()
  const { error } = await db.from('tasks').insert({
    title,
    case_id,
    description: str(fd, 'description'),
    assignee_id: str(fd, 'assignee_id') ?? me.id,
    due_date: str(fd, 'due_date'),
    priority: str(fd, 'priority') ?? 'media',
    created_by: me.id,
  })
  if (error) return { error: dbError(error) }
  refresh(case_id)
  return { ok: true, message: 'Tarefa criada.' }
}

export async function setTaskStatus(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id'), status = str(fd, 'status')
  if (!id || !status) return
  const db = await createClient()
  const { data, error } = await db.from('tasks').update({ status }).eq('id', id).select('case_id').single()
  if (error) throw new Error(dbError(error))
  refresh(data?.case_id)
}

export async function deleteTask(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { data } = await db.from('tasks').select('case_id').eq('id', id).single()
  const { error } = await db.from('tasks').delete().eq('id', id)
  if (error) throw new Error(dbError(error))
  refresh(data?.case_id)
}
