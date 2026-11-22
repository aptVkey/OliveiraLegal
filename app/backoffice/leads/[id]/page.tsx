import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAreas, getMembers } from '@/lib/queries'
import { LEAD_SOURCES, LEAD_STAGES, label } from '@/lib/labels'
import { eur, fmtDate } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, BackLink, PageHead } from '@/components/ui'
import { NotesPanel, type NoteRow } from '../../notas/notes-panel'
import { convertLead, deleteLead, updateLead } from '../actions'
import { LeadFields } from '../lead-fields'
import { BOOKING_STATUS } from '../../agendamentos/labels'
import { MODE_LABEL, money, shortDateTime } from '@/lib/booking/format'

export const metadata: Metadata = { title: 'Lead' }

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember()
  const { id } = await params
  const db = await createClient()
  const [{ data: lead }, members, areas, { data: notes }, { data: bookings }] = await Promise.all([
    db.from('leads').select('*, area:practice_areas(name), owner:profiles!leads_owner_id_fkey(full_name), client:clients(id, name)').eq('id', id).maybeSingle(),
    getMembers(), getAreas(),
    db.from('notes').select('id, body, kind, created_at, edited_at, author_id, lead_id, author:profiles(full_name)')
      .eq('lead_id', id).order('created_at', { ascending: false }),
    db.from('bookings').select('id, reference, status, mode, starts_at, amount_cents, currency')
      .eq('lead_id', id).not('status', 'eq', 'rascunho').order('created_at', { ascending: false }),
  ])
  if (!lead) notFound()

  return (
    <>
      <BackLink href="/backoffice/leads">Leads</BackLink>
      <PageHead
        eyebrow={`Lead · ${label(LEAD_STAGES, lead.stage)}`}
        title={lead.name}
        desc={lead.company ?? undefined}
        actions={lead.client ? (
          <Link className="btn btn--sm" href={`/backoffice/clientes/${lead.client.id}`}>Ver cliente</Link>
        ) : (
          <form action={convertLead}><input type="hidden" name="id" value={lead.id} />
            <SubmitButton className="btn btn--sm" pendingText="A converter…" confirm="Converter esta lead em cliente?">Converter em cliente</SubmitButton></form>
        )}
      />
      <div className="cols">
        <div className="card">
          <h2>Dados da lead</h2>
          <ActionForm action={updateLead} className="form">
            <input type="hidden" name="id" value={lead.id} />
            <LeadFields lead={lead} members={members} areas={areas} />
            <div className="form__actions"><SubmitButton>Guardar</SubmitButton></div>
          </ActionForm>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Resumo</h2>
            <dl className="dl">
              <dt>Fase</dt><dd><Badge>{label(LEAD_STAGES, lead.stage)}</Badge></dd>
              <dt>Origem</dt><dd>{label(LEAD_SOURCES, lead.source)}</dd>
              <dt>Área</dt><dd>{lead.area?.name ?? '—'}</dd>
              <dt>Responsável</dt><dd>{lead.owner?.full_name ?? '—'}</dd>
              <dt>Valor estimado</dt><dd>{eur(lead.estimated_value)}</dd>
              <dt>Criada em</dt><dd>{fmtDate(lead.created_at)}</dd>
              {lead.client && <><dt>Cliente</dt><dd><Link className="link" href={`/backoffice/clientes/${lead.client.id}`}>{lead.client.name}</Link></dd></>}
            </dl>
          </div>
          {!!bookings?.length && (
            <div className="card">
              <h2>Consultas marcadas no site</h2>
              <div className="list">
                {bookings.map(b => {
                  const st = BOOKING_STATUS[b.status] ?? { label: b.status }
                  return (
                    <div className="list__item" key={b.id}>
                      <span>
                        {b.starts_at ? shortDateTime(b.starts_at) : '—'} · {b.mode ? MODE_LABEL[b.mode] : '—'}
                        <div className="small muted">{b.reference}{b.amount_cents != null ? ` · ${money(b.amount_cents, b.currency ?? 'eur')}` : ''}</div>
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <NotesPanel notes={(notes ?? []) as unknown as NoteRow[]} leadId={lead.id} meId={me.id} isSocio={me.role === 'socio'} />
          {me.role === 'socio' && (
            <form action={deleteLead} className="no-print">
              <input type="hidden" name="id" value={lead.id} />
              <SubmitButton className="btn btn--danger btn--sm" pendingText="A apagar…" confirm="Apagar esta lead? Esta ação não pode ser desfeita.">Apagar lead</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
