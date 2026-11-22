import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getMembers, getOpenCasesLite } from '@/lib/queries'
import { Empty, PageHead } from '@/components/ui'
import { TaskForm } from './task-form'
import { TaskTable, type TaskRow, type TaskTotal } from './task-table'
import { CAN } from '@/lib/roles'

export const metadata: Metadata = { title: 'Tarefas' }

const VIEWS = { minhas: 'As minhas', equipa: 'Toda a equipa' } as const
const STATES = { abertas: 'Por fazer', concluidas: 'Concluídas' } as const

export default async function Tarefas({ searchParams }: { searchParams: Promise<{ vista?: string; estado?: string }> }) {
  const me = await requireMember()
  const { vista = 'minhas', estado = 'abertas' } = await searchParams
  const db = await createClient()
  let query = db.from('tasks')
    .select('id, title, status, priority, due_date, assignee_id, assignee:profiles!tasks_assignee_id_fkey(full_name), case:cases(id, reference, title)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (vista === 'minhas') query = query.eq('assignee_id', me.id)
  query = estado === 'concluidas' ? query.eq('status', 'concluida') : query.neq('status', 'concluida')
  const [{ data: tasks }, members, cases] = await Promise.all([query.limit(300), getMembers(), getOpenCasesLite()])

  const ids = (tasks ?? []).map(t => t.id)
  const [{ data: tt }, { data: running }] = await Promise.all([
    ids.length ? db.from('task_totals').select('*').in('task_id', ids) : Promise.resolve({ data: [] as any[] }),
    db.from('time_entries').select('task_id').eq('member_id', me.id).is('ended_at', null).maybeSingle(),
  ])
  const totals: Record<string, TaskTotal> = Object.fromEntries((tt ?? []).map(t => [t.task_id, { minutes: t.minutes, amount: Number(t.amount), cost: Number(t.cost) }]))
  const link = (v: string, e: string) => `/backoffice/tarefas?vista=${v}&estado=${e}`
  return (
    <>
      <PageHead eyebrow="Escritório" title="Tarefas" desc={`${tasks?.length ?? 0} ${estado === 'concluidas' ? 'concluídas' : 'por fazer'}`} />
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <TaskForm members={members} cases={cases} meId={me.id} />
      </div>
      <div className="toolbar">
        <nav className="tabs" aria-label="Vista">
          {Object.entries(VIEWS).map(([k, v]) => <Link key={k} href={link(k, estado)} aria-current={vista === k ? 'page' : undefined}>{v}</Link>)}
        </nav>
        <nav className="tabs" aria-label="Estado">
          {Object.entries(STATES).map(([k, v]) => <Link key={k} href={link(vista, k)} aria-current={estado === k ? 'page' : undefined}>{v}</Link>)}
        </nav>
      </div>
      {!tasks?.length ? <Empty title="Nada por aqui">{estado === 'abertas' ? 'Sem tarefas pendentes.' : 'Ainda sem tarefas concluídas.'}</Empty>
        : <div className="card"><TaskTable tasks={tasks as unknown as TaskRow[]} totals={totals} showCost={CAN.billing(me.role)} meId={me.id} runningTaskId={running?.task_id} /></div>}
    </>
  )
}
