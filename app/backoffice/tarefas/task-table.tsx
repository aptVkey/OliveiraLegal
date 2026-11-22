import Link from 'next/link'
import { PRIORITY, TASK_STATUS, label } from '@/lib/labels'
import { eur, fmtDate, fmtMinutes, isOverdue } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge } from '@/components/ui'
import { startTaskTimer } from '../tempo/actions'
import { setTaskStatus } from './actions'

export type TaskRow = {
  id: string; title: string; status: string; priority: string; due_date: string | null
  assignee_id?: string | null
  assignee?: { full_name: string } | null; case?: { id: string; reference: string; title: string } | null
}
export type TaskTotal = { minutes: number; amount: number; cost: number }

export function TaskTable({ tasks, showCase = true, totals, meId, showCost = false, runningTaskId }: {
  tasks: TaskRow[]; showCase?: boolean
  totals?: Record<string, TaskTotal>; meId?: string; showCost?: boolean; runningTaskId?: string | null
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          <th style={{ width: '2.5rem' }}></th><th>Tarefa</th>{showCase && <th>Caso</th>}<th>Responsável</th><th>Prazo</th><th>Prioridade</th>
          {totals && <th className="num">Tempo</th>}{totals && <th className="num">Valor</th>}{totals && showCost && <th className="num">Custo</th>}
          {meId && <th style={{ width: '3rem' }}></th>}
        </tr></thead>
        <tbody>
          {tasks.map(t => {
            const done = t.status === 'concluida'
            const late = !done && isOverdue(t.due_date)
            const tt = totals?.[t.id]
            const mine = !!meId && t.assignee_id === meId
            return (
              <tr key={t.id} className={done ? 'is-done' : undefined}>
                <td>
                  <form action={setTaskStatus}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={done ? 'por_fazer' : 'concluida'} />
                    <button className={`icon-btn${done ? ' is-on' : ''}`} type="submit" aria-label={done ? 'Reabrir tarefa' : 'Marcar como concluída'}>✓</button>
                  </form>
                </td>
                <td>
                  <span className="task-title">{t.title}</span>
                  {t.status === 'em_curso' && <> <Badge>{label(TASK_STATUS, t.status)}</Badge></>}
                  {runningTaskId === t.id && <> <Badge tone="ok"><span className="dot-live" />A contar</Badge></>}
                </td>
                {showCase && <td className="small">{t.case ? <Link className="row-link" href={`/backoffice/casos/${t.case.id}`}><span className="ref">{t.case.reference}</span> {t.case.title}</Link> : <span className="muted">Interna</span>}</td>}
                <td className="small">{t.assignee?.full_name ?? '—'}</td>
                <td className="small">{late ? <Badge tone="danger">{fmtDate(t.due_date)}</Badge> : fmtDate(t.due_date)}</td>
                <td><Badge tone={t.priority === 'alta' ? 'warn' : t.priority === 'baixa' ? 'off' : undefined}>{label(PRIORITY, t.priority)}</Badge></td>
                {totals && <td className="num small">{tt ? fmtMinutes(tt.minutes) : '—'}</td>}
                {totals && <td className="num small">{tt ? eur(tt.amount) : '—'}</td>}
                {totals && showCost && <td className="num small">{tt ? eur(tt.cost) : '—'}</td>}
                {meId && (
                  <td>
                    {mine && !done && runningTaskId !== t.id && (
                      <ActionForm action={startTaskTimer}>
                        <input type="hidden" name="task_id" value={t.id} />
                        <SubmitButton className="icon-btn" pendingText="…">▶</SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
