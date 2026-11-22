import { PRIORITY } from '@/lib/labels'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Options } from '@/components/ui'
import { createTask } from './actions'

export function TaskForm({ members, cases, caseId, meId }: {
  members: { id: string; full_name: string }[]
  cases?: { id: string; reference: string; title: string }[]
  caseId?: string
  meId: string
}) {
  return (
    <ActionForm action={createTask} className="inline-form" resetOnSuccess>
      {caseId && <input type="hidden" name="case_id" value={caseId} />}
      <div className="field field--grow"><label htmlFor="t-title">Nova tarefa</label><input id="t-title" name="title" required placeholder="O que é preciso fazer?" /></div>
      {!caseId && cases && (
        <div className="field"><label htmlFor="t-case">Caso</label>
          <select id="t-case" name="case_id" defaultValue="">
            <option value="">Interna</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.reference} · {c.title}</option>)}
          </select></div>
      )}
      <div className="field"><label htmlFor="t-assignee">Responsável</label>
        <select id="t-assignee" name="assignee_id" defaultValue={meId}>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || '—'}</option>)}
        </select></div>
      <div className="field"><label htmlFor="t-due">Prazo</label><input id="t-due" name="due_date" type="date" /></div>
      <div className="field"><label htmlFor="t-priority">Prioridade</label>
        <select id="t-priority" name="priority" defaultValue="media"><Options map={PRIORITY} /></select></div>
      <SubmitButton className="btn" pendingText="A criar…">Adicionar</SubmitButton>
    </ActionForm>
  )
}
