import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { eur, fmtMinutes, todayISO } from '@/lib/format'
import { PageHead, Stat } from '@/components/ui'
import { TaskTable, type TaskRow } from './tarefas/task-table'

export const metadata: Metadata = { title: 'Painel' }

export default async function Painel() {
  const me = await requireMember()
  const db = await createClient()
  const today = todayISO()
  const monthStart = `${today.slice(0, 8)}01T00:00:00Z`
  const inAWeek = todayISO(7)

  const [leads, cases, myTasks, myTime, unbilled] = await Promise.all([
    db.from('leads').select('estimated_value').not('stage', 'in', '(ganho,perdido)'),
    db.from('cases').select('id', { count: 'exact', head: true }).neq('status', 'fechado'),
    db.from('tasks').select('id, title, status, priority, due_date, assignee_id, assignee:profiles!tasks_assignee_id_fkey(full_name), case:cases(id, reference, title)')
      .eq('assignee_id', me.id).neq('status', 'concluida').order('due_date', { ascending: true, nullsFirst: false }).limit(8),
    db.from('time_entries').select('minutes, billable, amount').eq('member_id', me.id).not('ended_at', 'is', null).gte('started_at', monthStart),
    CAN.billing(me.role)
      ? db.from('time_entries').select('amount').eq('status', 'por_faturar').eq('billable', true).not('ended_at', 'is', null)
      : Promise.resolve({ data: null }),
  ])

  const openLeads = leads.data ?? []
  const pipeline = openLeads.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0)
  const tasks = (myTasks.data ?? []) as unknown as TaskRow[]
  const dueSoon = tasks.filter(t => t.due_date && t.due_date <= inAWeek).length
  const billMin = (myTime.data ?? []).filter(e => e.billable).reduce((s, e) => s + (e.minutes ?? 0), 0)
  const billAmount = (myTime.data ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const unbilledAmount = (unbilled.data ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)

  const first = me.fullName.split(' ')[0]
  const hour = Number(new Intl.DateTimeFormat('pt-PT', { hour: 'numeric', hour12: false, timeZone: 'Europe/Lisbon' }).format(new Date()))
  const greeting = hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite'

  return (
    <>
      <PageHead eyebrow="Painel" title={<>{greeting}, <em>{first}.</em></>}
        actions={<><Link className="btn btn--ghost btn--sm" href="/backoffice/tempo">Iniciar cronómetro</Link><Link className="btn btn--sm" href="/backoffice/leads/novo">Nova lead</Link></>} />
      <section className="grid" aria-label="Indicadores">
        <Stat label="Leads em aberto" value={openLeads.length} hint={`${eur(pipeline)} em pipeline`} href="/backoffice/leads" />
        <Stat label="Casos ativos" value={cases.count ?? 0} hint="Dos casos a que tem acesso" href="/backoffice/casos" />
        <Stat label="As minhas tarefas" value={tasks.length} hint={`${dueSoon} com prazo nos próximos 7 dias`} href="/backoffice/tarefas" />
        {CAN.billing(me.role)
          ? <Stat label="Por faturar (escritório)" value={eur(unbilledAmount)} hint={`As minhas horas este mês: ${fmtMinutes(billMin)}`} href="/backoffice/faturacao" />
          : <Stat label="Horas faturáveis (mês)" value={fmtMinutes(billMin)} hint={eur(billAmount)} href="/backoffice/tempo?periodo=mes" />}
      </section>

      <h2 className="section-title">As minhas próximas tarefas</h2>
      {tasks.length ? <div className="card"><TaskTable tasks={tasks} meId={me.id} /></div>
        : <div className="empty"><h2>Tudo em dia</h2><p>Não tem tarefas pendentes.</p></div>}
    </>
  )
}
