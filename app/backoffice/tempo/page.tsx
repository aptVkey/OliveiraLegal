import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getMembers, getOpenCasesLite } from '@/lib/queries'
import { ENTRY_STATUS, label } from '@/lib/labels'
import { eur, fmtDate, fmtMinutes, todayISO } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Elapsed } from '@/components/elapsed'
import { Badge, Empty, PageHead } from '@/components/ui'
import { addManualEntry, deleteEntry, startTimer, stopTimer } from './actions'

export const metadata: Metadata = { title: 'Tempo' }

const PERIODS = { semana: 'Esta semana', mes: 'Este mês', anterior: 'Mês anterior' } as const

function periodRange(p: string): [string, string | null] {
  const today = new Date(`${todayISO()}T00:00:00Z`)
  if (p === 'mes') return [new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString(), null]
  if (p === 'anterior') return [
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString(),
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString(),
  ]
  const dow = (today.getUTCDay() + 6) % 7
  return [new Date(today.getTime() - dow * 86400000).toISOString(), null]
}

export default async function Tempo({ searchParams }: { searchParams: Promise<{ periodo?: string; membro?: string; caso?: string; tarefa?: string }> }) {
  const me = await requireMember()
  const { periodo = 'semana', membro, caso, tarefa } = await searchParams
  const manager = CAN.billing(me.role)
  const who = manager && membro ? membro : manager && membro === undefined ? me.id : me.id
  const db = await createClient()
  const [from, to] = periodRange(periodo)

  let q = db.from('time_entries')
    .select('id, started_at, minutes, billable, rate, amount, status, description, member_id, task:tasks(title), case:cases(id, reference, title), member:profiles!time_entries_member_id_fkey(full_name)')
    .not('ended_at', 'is', null).gte('started_at', from).order('started_at', { ascending: false }).limit(500)
  if (to) q = q.lt('started_at', to)
  if (!(manager && membro === 'todos')) q = q.eq('member_id', who)

  const [{ data: running }, { data: entries }, cases, members, { data: myTasks }] = await Promise.all([
    db.from('time_entries').select('id, started_at, description, billable, task:tasks(title), case:cases(id, reference, title)').eq('member_id', me.id).is('ended_at', null).maybeSingle(),
    q, getOpenCasesLite(), manager ? getMembers() : Promise.resolve([]),
    db.from('tasks').select('id, title, case:cases(reference)').eq('assignee_id', me.id).neq('status', 'concluida').order('due_date', { nullsFirst: false }).limit(100),
  ])
  const taskOptions = (myTasks ?? []).map(t => (
    <option key={t.id} value={t.id}>{(t.case as any)?.reference ? `${(t.case as any).reference} · ` : ''}{t.title}</option>
  ))

  const sum = (f: (e: any) => boolean, k: 'minutes' | 'amount') => (entries ?? []).filter(f).reduce((s, e) => s + Number(e[k] ?? 0), 0)
  const memberParam = manager && membro ? `&membro=${membro}` : ''

  return (
    <>
      <PageHead eyebrow="Escritório" title="Tempo" desc="Cronómetro e registo de horas faturáveis e não faturáveis." />

      {running ? (
        <div className="timer" style={{ marginBottom: '1.25rem' }}>
          <div>
            <p className="timer__meta"><span className="dot-live" />A contar desde {new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' }).format(new Date(running.started_at))}</p>
            <p className="timer__time"><Elapsed since={running.started_at} /></p>
            <p className="timer__meta">
              {(running.task as any)?.title ? `Tarefa: ${(running.task as any).title} · ` : ''}
              {(running.case as any) ? `${(running.case as any).reference} · ${(running.case as any).title}` : 'Tempo interno'}
              {running.description ? ` — ${running.description}` : ''} · {running.billable ? 'Faturável' : 'Não faturável'}
            </p>
          </div>
          <form action={stopTimer}><SubmitButton className="btn" pendingText="A parar…">Parar e guardar</SubmitButton></form>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>Iniciar cronómetro</h2>
          <ActionForm action={startTimer} className="inline-form">
            <div className="field"><label htmlFor="s-task">Tarefa</label>
              <select id="s-task" name="task_id" defaultValue={tarefa ?? ''}>
                <option value="">— Sem tarefa —</option>{taskOptions}
              </select></div>
            <div className="field"><label htmlFor="s-case">Caso (se não houver tarefa)</label>
              <select id="s-case" name="case_id" defaultValue={caso ?? ''}>
                <option value="">Tempo interno (sem caso)</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>)}
              </select></div>
            <div className="field field--grow"><label htmlFor="s-desc">Descrição</label><input id="s-desc" name="description" placeholder="Ex.: Análise do contrato" /></div>
            <label className="check" style={{ height: '3rem' }}><input type="checkbox" name="billable" defaultChecked /> Faturável</label>
            <SubmitButton className="btn" pendingText="A iniciar…">Iniciar</SubmitButton>
          </ActionForm>
        </div>
      )}

      <details className="card" style={{ marginBottom: '1.25rem' }}>
        <summary>Registar tempo manualmente</summary>
        <ActionForm action={addManualEntry} className="inline-form" resetOnSuccess>
          <div className="field"><label htmlFor="m-date">Data</label><input id="m-date" name="date" type="date" required defaultValue={todayISO()} /></div>
          <div className="field"><label htmlFor="m-dur">Duração</label><input id="m-dur" name="duration" required placeholder="1:30" /></div>
          <div className="field"><label htmlFor="m-task">Tarefa</label>
            <select id="m-task" name="task_id" defaultValue={tarefa ?? ''}>
              <option value="">— Sem tarefa —</option>{taskOptions}
            </select></div>
          <div className="field"><label htmlFor="m-case">Caso (se não houver tarefa)</label>
            <select id="m-case" name="case_id" defaultValue={caso ?? ''}>
              <option value="">Tempo interno (sem caso)</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>)}
            </select></div>
          <div className="field field--grow"><label htmlFor="m-desc">Descrição</label><input id="m-desc" name="description" /></div>
          <label className="check" style={{ height: '3rem' }}><input type="checkbox" name="billable" defaultChecked /> Faturável</label>
          <SubmitButton className="btn" pendingText="A guardar…">Registar</SubmitButton>
        </ActionForm>
      </details>

      <div className="toolbar">
        <nav className="tabs" aria-label="Período">
          {Object.entries(PERIODS).map(([k, v]) => <Link key={k} href={`/backoffice/tempo?periodo=${k}${memberParam}`} aria-current={periodo === k ? 'page' : undefined}>{v}</Link>)}
        </nav>
        {manager && (
          <form>
            <input type="hidden" name="periodo" value={periodo} />
            <select name="membro" defaultValue={membro ?? me.id} aria-label="Membro">
              <option value="todos">Toda a equipa</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name || '—'}</option>)}
            </select>
            <button className="btn btn--ghost btn--sm" type="submit" style={{ marginLeft: '.5rem' }}>Ver</button>
          </form>
        )}
      </div>

      <div className="totals">
        <div><p>Faturável</p><p>{fmtMinutes(sum(e => e.billable, 'minutes'))}</p></div>
        <div><p>Não faturável</p><p>{fmtMinutes(sum(e => !e.billable, 'minutes'))}</p></div>
        <div><p>Valor faturável</p><p>{eur(sum(() => true, 'amount'))}</p></div>
      </div>

      {!entries?.length ? <Empty title="Sem registos neste período" /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Data</th>{manager && <th>Membro</th>}<th>Caso</th><th>Tarefa / descrição</th><th className="num">Tempo</th><th className="num">Taxa</th><th className="num">Valor</th><th>Estado</th><th></th></tr></thead>
            <tbody>{entries.map(e => (
              <tr key={e.id}>
                <td className="small">{fmtDate(e.started_at)}</td>
                {manager && <td className="small">{(e.member as any)?.full_name ?? '—'}</td>}
                <td className="small">{(e.case as any) ? <Link className="row-link" href={`/backoffice/casos/${(e.case as any).id}`}><span className="ref">{(e.case as any).reference}</span></Link> : <span className="muted">Interno</span>}</td>
                <td className="small">{(e.task as any)?.title && <strong style={{ fontWeight: 400 }}>{(e.task as any).title}</strong>}{e.description && e.description !== (e.task as any)?.title ? <>{(e.task as any)?.title ? ' — ' : ''}{e.description}</> : !(e.task as any)?.title ? '—' : null}{!e.billable && <> <Badge tone="off">Não faturável</Badge></>}</td>
                <td className="num">{fmtMinutes(e.minutes)}</td>
                <td className="num small">{e.billable ? eur(e.rate) : '—'}</td>
                <td className="num">{e.billable ? eur(e.amount) : '—'}</td>
                <td><Badge tone={e.status === 'faturado' ? 'ok' : undefined}>{label(ENTRY_STATUS, e.status)}</Badge></td>
                <td>{e.status === 'por_faturar' && (e.member_id === me.id || me.role === 'socio') && (
                  <form action={deleteEntry}><input type="hidden" name="id" value={e.id} />
                    <SubmitButton className="icon-btn" pendingText="…" confirm="Apagar este registo de tempo?">×</SubmitButton></form>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  )
}
