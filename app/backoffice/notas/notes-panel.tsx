import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { initials } from '@/components/avatars'
import { addNote, deleteNote, updateNote } from './actions'

export type NoteRow = {
  id: string; body: string; kind: string; created_at: string; edited_at: string | null
  author_id: string | null; lead_id: string | null
  author?: { full_name: string } | null
}

// Cronologia de notas: usada na lead e no cliente (as da lead continuam visíveis no cliente)
export function NotesPanel({ notes, leadId, clientId, meId, isSocio, showOrigin = false }: {
  notes: NoteRow[]; leadId?: string; clientId?: string; meId: string; isSocio: boolean; showOrigin?: boolean
}) {
  return (
    <div className="card notes">
      <h2>Notas da equipa</h2>
      <ActionForm action={addNote} className="notes__form" resetOnSuccess>
        {leadId && <input type="hidden" name="lead_id" value={leadId} />}
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        <label className="sr-only" htmlFor={`note-${leadId ?? clientId}`}>Nova nota</label>
        <textarea id={`note-${leadId ?? clientId}`} name="body" rows={3} maxLength={4000} required placeholder="Escreva uma nota para a equipa…" />
        <div className="notes__actions"><SubmitButton className="btn btn--sm" pendingText="A guardar…">Adicionar nota</SubmitButton></div>
      </ActionForm>

      {!notes.length ? <p className="small muted" style={{ marginTop: '1rem' }}>Ainda sem notas.</p> : (
        <ol className="notes__list">
          {notes.map(n => {
            const system = n.kind === 'sistema'
            const mine = n.author_id === meId
            return (
              <li key={n.id} className={`note${system ? ' note--system' : ''}`}>
                {!system && <span className="avatar note__avatar" aria-hidden="true">{initials(n.author?.full_name)}</span>}
                <div className="note__main">
                  <p className="note__meta">
                    {!system && <strong>{n.author?.full_name ?? 'Utilizador removido'}</strong>}
                    <span>{fmtDateTime(n.created_at)}{n.edited_at ? ' · editada' : ''}</span>
                    {showOrigin && n.lead_id && <Badge tone="off">Da lead</Badge>}
                    {system && n.author?.full_name && <span>· {n.author.full_name}</span>}
                  </p>
                  {system ? <p className="note__system">{n.body}</p> : (
                    <p className="note__body">{n.body}</p>
                  )}
                  {!system && (mine || isSocio) && (
                    <div className="note__tools">
                      {mine && (
                        <details className="note__editor">
                          <summary>Editar</summary>
                          <ActionForm action={updateNote} className="notes__form">
                            <input type="hidden" name="id" value={n.id} />
                            <textarea name="body" rows={3} maxLength={4000} required defaultValue={n.body} aria-label="Editar nota" />
                            <div className="notes__actions"><SubmitButton className="btn btn--sm" pendingText="…">Guardar</SubmitButton></div>
                          </ActionForm>
                        </details>
                      )}
                      <ActionForm action={deleteNote}>
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton className="note__delete" pendingText="…" confirm="Apagar esta nota?">Apagar</SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
