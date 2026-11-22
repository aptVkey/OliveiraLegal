'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { bool, dbError, str, type FormState } from '@/lib/forms'

function refresh() {
  revalidatePath('/backoffice', 'layout')
}

// "1:30", "1h30", "90m" ou "1,5" → minutos
function parseDuration(v: string | null): number | null {
  if (!v) return null
  const t = v.trim().toLowerCase().replace(',', '.')
  let m = t.match(/^(\d+)\s*[:h]\s*(\d{1,2})\s*m?$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = t.match(/^(\d+)\s*m(in)?$/)
  if (m) return Number(m[1])
  m = t.match(/^(\d+(\.\d+)?)\s*h?$/)
  if (m) return Math.round(Number(m[1]) * 60)
  return null
}

export async function startTimer(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const task_id = str(fd, 'task_id')
  const case_id = task_id ? null : str(fd, 'case_id') // com tarefa, o caso vem da tarefa (no servidor)
  const billable = bool(fd, 'billable')
  if (billable && !case_id && !task_id) return { error: 'Para horas faturáveis, escolha um caso ou uma tarefa.' }
  const db = await createClient()
  const { error } = await db.from('time_entries').insert({ case_id, task_id, billable, description: str(fd, 'description') })
  if (error) return { error: error.code === '23505' ? 'Já tem um cronómetro a correr.' : dbError(error) }
  if (task_id) await db.from('tasks').update({ status: 'em_curso' }).eq('id', task_id).eq('status', 'por_fazer')
  refresh()
  return { ok: true }
}

// Botão ▶ numa tarefa: o tempo conta para a tarefa, o caso e o cliente
export async function startTaskTimer(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const task_id = str(fd, 'task_id')
  if (!task_id) return { error: 'Tarefa em falta.' }
  const db = await createClient()
  const { data: task } = await db.from('tasks').select('id, title, case_id, status').eq('id', task_id).maybeSingle()
  if (!task) return { error: 'Tarefa não encontrada.' }
  const { error } = await db.from('time_entries').insert({ task_id, billable: !!task.case_id, description: task.title })
  if (error) return { error: error.code === '23505' ? 'Já tem um cronómetro a correr. Pare-o primeiro.' : dbError(error) }
  if (task.status === 'por_fazer') await db.from('tasks').update({ status: 'em_curso' }).eq('id', task_id)
  refresh()
  return { ok: true }
}

export async function stopTimer() {
  const me = await requireMember()
  const db = await createClient()
  const { error } = await db.from('time_entries').update({ ended_at: new Date().toISOString() })
    .eq('member_id', me.id).is('ended_at', null)
  if (error) throw new Error(dbError(error))
  refresh()
}

export async function addManualEntry(_: FormState, fd: FormData): Promise<FormState> {
  await requireMember()
  const date = str(fd, 'date')
  const minutes = parseDuration(str(fd, 'duration'))
  const task_id = str(fd, 'task_id')
  const case_id = task_id ? null : str(fd, 'case_id')
  const billable = bool(fd, 'billable')
  if (!date) return { error: 'Indique a data.' }
  if (!minutes || minutes <= 0 || minutes > 24 * 60) return { error: 'Duração inválida. Use, por exemplo, 1:30 ou 1,5.' }
  if (billable && !case_id && !task_id) return { error: 'Para horas faturáveis, escolha um caso ou uma tarefa.' }
  const start = new Date(`${date}T09:00:00Z`)
  const end = new Date(start.getTime() + minutes * 60000)
  const db = await createClient()
  const { error } = await db.from('time_entries').insert({
    case_id, task_id, billable, description: str(fd, 'description'),
    started_at: start.toISOString(), ended_at: end.toISOString(),
  })
  if (error) return { error: dbError(error) }
  refresh()
  return { ok: true, message: 'Tempo registado.' }
}

export async function deleteEntry(fd: FormData) {
  await requireMember()
  const id = str(fd, 'id')
  if (!id) return
  const db = await createClient()
  const { error } = await db.from('time_entries').delete().eq('id', id)
  if (error) throw new Error(dbError(error))
  refresh()
}
