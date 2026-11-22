import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getAreas, getClientsLite, getMembers } from '@/lib/queries'
import { BILLING, CASE_STATUS, ENTRY_STATUS, label } from '@/lib/labels'
import { eur, fmtDate, fmtMinutes } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, BackLink, Empty, PageHead } from '@/components/ui'
import { TaskForm } from '../../tarefas/task-form'
import { TaskTable, type TaskRow, type TaskTotal } from '../../tarefas/task-table'
import { addCaseMember, removeCaseMember, updateCase } from '../actions'
import { CaseFields } from '../case-fields'

export const metadata: Metadata = { title: 'Caso' }

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember()
  const { id } = await params
  const db = await createClient()
  const { data: k } = await db.from('cases')
    .select('*, client:clients(id, name), area:practice_areas(name), responsible:profiles!cases_responsible_id_fkey(full_name)')
    .eq('id', id).maybeSingle()
  if (!k) notFound()

  const [{ data: team }, { data: tasks }, { data: entries }, members, clients, areas] = await Promise.all([
    db.from('case_members').select('member_id, member:profiles(full_name, role)').eq('case_id', id),
    db.from('tasks').select('id, title, status, priority, due_date, assignee_id, assignee:profiles!tasks_assignee_id_fkey(full_name)')
      .eq('case_id', id).order('status').order('due_date', { nullsFirst: false }),
    db.from('time_entries').select('id, started_at, minutes, billable, amount, cost_amount, status, description, task:tasks(title), member:profiles!time_entries_member_id_fkey(full_name)')
      .eq('case_id', id).not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(200),
    getMembers(), getClientsLite(), getAreas(),
  ])

  const manager = CAN.billing(me.role)
  const taskIds = (tasks ?? []).map(t => t.id)
  const [{ data: ct }, { data: tt }, { data: running }] = await Promise.all([
    db.from('case_totals').select('*').eq('case_id', id).maybeSingle(),
    taskIds.length ? db.from('task_totals').select('*').in('task_id', taskIds) : Promise.resolve({ data: [] as any[] }),
    db.from('time_entries').select('task_id').eq('member_id', me.id).is('ended_at', null).maybeSingle(),
  ])
  const taskTotals: Record<string, TaskTotal> = Object.fromEntries((tt ?? []).map(t => [t.task_id, { minutes: t.minutes, amount: Number(t.amount), cost: Number(t.cost) }]))
  const billMin = ct?.billable_minutes ?? 0
  const nonBillMin = ct?.nonbillable_minutes ?? 0
  const amount = Number(ct?.amount ?? 0)
  const cost = Number(ct?.cost ?? 0)
  const unbilled = Number(ct?.unbilled ?? 0)
  const teamIds = new Set((team ?? []).map(t => t.member_id))
  const canEdit = me.role === 'socio' || k.responsible_id === me.id || k.created_by === me.id || teamIds.has(me.id)

  return (
    <>
      <BackLink href="/backoffice/casos">Casos</BackLink>
      <PageHead
        eyebrow={`Caso ${k.reference}`}
        title={k.title}
        desc={<><Link className="link" href={`/backoffice/clientes/${k.client?.id}`}>{k.client?.name}</Link>{k.opposing_party ? ` · vs. ${k.opposing_party}` : ''}</>}
        actions={<Link className="btn btn--sm" href={`/backoffice/tempo?caso=${k.id}`}>Registar tempo</Link>}
      />
      <div className="cols">
        <div className="stack">
          <div className="card">
            <h2>Tarefas</h2>
            {canEdit && <div style={{ marginBottom: '1rem' }}><TaskForm members={members} caseId={k.id} meId={me.id} /></div>}
            {tasks?.length ? <TaskTable tasks={tasks as unknown as TaskRow[]} showCase={false} totals={taskTotals} showCost={manager} meId={me.id} runningTaskId={running?.task_id} /> : <p className="small muted">Sem tarefas neste caso.</p>}
            <p className="small muted" style={{ marginTop: '1rem' }}>Cada tarefa tem um responsável. Use ▶ nas suas tarefas para contar o tempo: o valor soma à tarefa, ao caso e ao cliente.</p>
          </div>

          <div className="card">
            <h2>Tempo registado</h2>
            <div className="totals">
              <div><p>Faturável</p><p>{fmtMinutes(billMin)}</p></div>
              <div><p>Não faturável</p><p>{fmtMinutes(nonBillMin)}</p></div>
              <div><p>Valor</p><p>{eur(amount)}</p></div>
              {manager && <div><p>Custo</p><p>{eur(cost)}</p></div>}
              {manager && amount > 0 && <div><p>Margem</p><p>{Math.round(((amount - cost) / amount) * 100)}%</p></div>}
              <div><p>Por faturar</p><p>{eur(unbilled)}</p></div>
            </div>
            {entries?.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Data</th><th>Membro</th><th>Tarefa / descrição</th><th className="num">Tempo</th><th className="num">Valor</th><th>Estado</th></tr></thead>
                  <tbody>{entries.map(e => (
                    <tr key={e.id}>
                      <td className="small">{fmtDate(e.started_at)}</td>
                      <td className="small">{(e.member as any)?.full_name ?? '—'}</td>
                      <td className="small">{(e.task as any)?.title ? <strong style={{ fontWeight: 400 }}>{(e.task as any).title}</strong> : <span className="muted">Direto no caso</span>}{e.description && e.description !== (e.task as any)?.title ? <> — {e.description}</> : null}{!e.billable && <> <Badge tone="off">Não faturável</Badge></>}</td>
                      <td className="num">{fmtMinutes(e.minutes)}</td>
                      <td className="num">{e.billable ? eur(e.amount) : '—'}</td>
                      <td><Badge tone={e.status === 'faturado' ? 'ok' : undefined}>{label(ENTRY_STATUS, e.status)}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="small muted">Sem tempo registado.</p>}
          </div>

          {canEdit && (
            <details className="card">
              <summary>Editar caso</summary>
              <ActionForm action={updateCase} className="form">
                <input type="hidden" name="id" value={k.id} />
                <CaseFields value={k} clients={clients} members={members} areas={areas} />
                <div className="form__actions"><SubmitButton>Guardar</SubmitButton></div>
              </ActionForm>
            </details>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2>Ficha</h2>
            <dl className="dl">
              <dt>Estado</dt><dd><Badge tone={k.status === 'fechado' ? 'off' : undefined}>{label(CASE_STATUS, k.status)}</Badge></dd>
              <dt>Área</dt><dd>{k.area?.name ?? '—'}</dd>
              <dt>Responsável</dt><dd>{k.responsible?.full_name ?? '—'}</dd>
              <dt>Honorários</dt><dd>{label(BILLING, k.billing_type)}{k.fixed_fee != null && k.billing_type !== 'hora' ? ` · ${eur(k.fixed_fee)}` : ''}</dd>
              <dt>Aberto a</dt><dd>{fmtDate(k.opened_at)}</dd>
              {k.closed_at && <><dt>Fechado a</dt><dd>{fmtDate(k.closed_at)}</dd></>}
            </dl>
            {k.description && <p className="small" style={{ marginTop: '1rem', whiteSpace: 'pre-line' }}>{k.description}</p>}
          </div>

          <div className="card">
            <h2>Equipa do caso</h2>
            <p className="small muted" style={{ marginBottom: '.9rem' }}>Só a equipa, sócios e financeiro têm acesso a este caso.</p>
            {team?.length ? (
              <div className="chips">
                {team.map(t => (
                  <span className="chip" key={t.member_id}>
                    {(t.member as any)?.full_name || '—'}
                    {canEdit && t.member_id !== k.responsible_id && (
                      <form action={removeCaseMember}>
                        <input type="hidden" name="case_id" value={k.id} />
                        <input type="hidden" name="member_id" value={t.member_id} />
                        <button type="submit" aria-label={`Remover ${(t.member as any)?.full_name}`}>×</button>
                      </form>
                    )}
                  </span>
                ))}
              </div>
            ) : <Empty title="Sem equipa" />}
            {canEdit && (
              <ActionForm action={addCaseMember} className="inline-form" resetOnSuccess>
                <input type="hidden" name="case_id" value={k.id} />
                <div className="field" style={{ marginTop: '1rem' }}><label htmlFor="member_id">Adicionar membro</label>
                  <select id="member_id" name="member_id" required defaultValue="">
                    <option value="">Escolher…</option>
                    {members.filter(m => !teamIds.has(m.id)).map(m => <option key={m.id} value={m.id}>{m.full_name || '—'}</option>)}
                  </select></div>
                <SubmitButton className="btn btn--sm" pendingText="…">Adicionar</SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
