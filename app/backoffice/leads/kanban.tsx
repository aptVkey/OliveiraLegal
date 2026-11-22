'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { LEAD_STAGES } from '@/lib/labels'
import { eur } from '@/lib/format'
import { moveLead } from './actions'

export type KanbanLead = {
  id: string; name: string; company: string | null; stage: string
  estimated_value: number | null; area: string | null; owner: string | null
}

const TONES: Record<string, string> = { ganho: 'ok', perdido: 'off' }

export function Kanban({ leads }: { leads: KanbanLead[] }) {
  const [items, setStage] = useOptimistic(leads, (state, { id, stage }: { id: string; stage: string }) =>
    state.map(l => (l.id === id ? { ...l, stage } : l)))
  const [, startTransition] = useTransition()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function move(id: string, stage: string) {
    const lead = items.find(l => l.id === id)
    if (!lead || lead.stage === stage) return
    setError(null)
    startTransition(async () => {
      setStage({ id, stage })
      const res = await moveLead(id, stage)
      if (res.error) setError(res.error) // a vista volta ao estado do servidor
    })
  }

  return (
    <>
      {error && <p className="alert alert--error" role="alert" style={{ marginBottom: '1rem' }}>{error}</p>}
      <div className="kanban">
        {Object.entries(LEAD_STAGES).map(([stage, name]) => {
          const col = items.filter(l => l.stage === stage)
          const total = col.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0)
          return (
            <section
              key={stage}
              className={`kanban__col kanban__col--${TONES[stage] ?? 'open'}${over === stage ? ' is-over' : ''}`}
              aria-label={name}
              onDragOver={e => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(stage) } }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(o => (o === stage ? null : o)) }}
              onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; setOver(null); setDragId(null); if (id) move(id, stage) }}
            >
              <header className="kanban__head">
                <strong>{name}</strong>
                <span className="kanban__count">{col.length}</span>
              </header>
              <p className="kanban__total">{total ? eur(total) : '—'}</p>
              <div className="kanban__cards">
                {col.map(l => (
                  <article
                    key={l.id}
                    className={`lead-card${dragId === l.id ? ' is-dragging' : ''}`}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id) }}
                    onDragEnd={() => { setDragId(null); setOver(null) }}
                  >
                    <Link href={`/backoffice/leads/${l.id}`} draggable={false} className="lead-card__link">
                      <strong>{l.name}</strong>
                      {(l.company || l.area) && <p>{[l.company, l.area].filter(Boolean).join(' · ')}</p>}
                    </Link>
                    <div className="lead-card__foot">
                      <span className="lead-card__owner" title={l.owner ?? 'Sem responsável'}>
                        {l.owner ? l.owner.split(' ').map(w => w[0]).slice(0, 2).join('') : '—'}
                      </span>
                      {l.estimated_value != null && <span>{eur(l.estimated_value)}</span>}
                    </div>
                    <label className="lead-card__move">
                      <span className="sr-only">Mover {l.name} para</span>
                      <select value={l.stage} onChange={e => move(l.id, e.target.value)}>
                        {Object.entries(LEAD_STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
                {!col.length && <p className="kanban__empty">{dragId ? 'Largar aqui' : 'Sem leads'}</p>}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
