import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getMembers } from '@/lib/queries'
import { CASE_STATUS, CLIENT_KIND, label } from '@/lib/labels'
import { eur, fmtDate, fmtMinutes } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, BackLink, Empty, PageHead, Stat } from '@/components/ui'
import { NotesPanel, type NoteRow } from '../../notas/notes-panel'
import { addClientMember, removeClientMember, toggleArchiveClient, updateClientRecord } from '../actions'
import { ClientFields } from '../client-fields'

export const metadata: Metadata = { title: 'Cliente' }

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember()
  const manager = CAN.billing(me.role)
  const canTeam = ['socio', 'advogado', 'associado'].includes(me.role)
  const { id } = await params
  const db = await createClient()
  const casesQ = db.from('cases').select('id, reference, title, status, opened_at, responsible:profiles!cases_responsible_id_fkey(full_name)')
    .eq('client_id', id).order('opened_at', { ascending: false }).then(r => r)
  const [{ data: client }, { data: cases }, { data: team }, { data: totals }, members, { data: notes }, { data: caseTotals }] = await Promise.all([
    db.from('clients').select('*').eq('id', id).maybeSingle(),
    casesQ,
    db.from('client_members').select('member_id, member:profiles(full_name, role)').eq('client_id', id),
    db.from('client_totals').select('*').eq('client_id', id).maybeSingle(),
    getMembers(),
    db.from('notes').select('id, body, kind, created_at, edited_at, author_id, lead_id, author:profiles(full_name)')
      .eq('client_id', id).order('created_at', { ascending: false }),
    (async () => {
      const ids = ((await casesQ).data ?? []).map(k => k.id)
      return { data: ids.length ? ((await db.from('case_totals').select('*').in('case_id', ids)).data ?? []) as any[] : [] }
    })(),
  ])
  if (!client) notFound()

  const ct = new Map((caseTotals ?? []).map(t => [t.case_id, t]))
  const teamIds = new Set((team ?? []).map(t => t.member_id))
  const amount = Number(totals?.amount ?? 0), cost = Number(totals?.cost ?? 0)

  return (
    <>
      <BackLink href="/backoffice/clientes">Clientes</BackLink>
      <PageHead
        eyebrow={`Cliente · ${label(CLIENT_KIND, client.kind)}${client.archived ? ' · Arquivado' : ''}`}
        title={client.name}
        desc={[client.nif && `NIF ${client.nif}`, client.email, client.phone].filter(Boolean).join(' · ') || undefined}
        actions={<Link className="btn btn--sm" href={`/backoffice/casos/novo?cliente=${client.id}`}>Novo caso</Link>}
      />

      <section className="grid" aria-label="Resumo do cliente" style={{ marginBottom: '1.25rem' }}>
        <Stat label="Casos" value={totals?.cases_open ?? 0} hint={`${totals?.cases_total ?? 0} no total`} />
        <Stat label="Horas faturáveis" value={fmtMinutes(totals?.billable_minutes ?? 0)} hint={`${fmtMinutes(totals?.nonbillable_minutes ?? 0)} não faturáveis`} />
        <Stat label="Valor do trabalho" value={eur(amount)} hint={manager ? `${eur(totals?.unbilled ?? 0)} por faturar` : 'Soma das tarefas e casos'} />
        {manager
          ? <Stat label="Custo interno" value={eur(cost)} hint={amount ? `Margem ${eur(amount - cost)} (${Math.round(((amount - cost) / amount) * 100)}%)` : 'Sem horas faturáveis'} />
          : <Stat label="Equipa" value={teamIds.size} hint="Membros associados" />}
      </section>

      <div className="cols">
        <div className="stack">
          <div className="card">
            <h2>Casos</h2>
            {!cases?.length ? <Empty title="Sem casos">Abra o primeiro caso deste cliente.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Ref.</th><th>Assunto</th><th>Responsável</th><th className="num">Horas</th><th className="num">Valor</th>{manager && <th className="num">Custo</th>}<th>Estado</th></tr></thead>
                  <tbody>
                    {cases.map(k => {
                      const t = ct.get(k.id)
                      return (
                        <tr key={k.id}>
                          <td className="ref">{k.reference}</td>
                          <td><Link className="row-link" href={`/backoffice/casos/${k.id}`}>{k.title}</Link><div className="small muted">Aberto a {fmtDate(k.opened_at)}</div></td>
                          <td className="small">{(k.responsible as any)?.full_name ?? '—'}</td>
                          <td className="num">{fmtMinutes((t?.billable_minutes ?? 0) + (t?.nonbillable_minutes ?? 0))}</td>
                          <td className="num">{eur(t?.amount ?? 0)}</td>
                          {manager && <td className="num">{eur(t?.cost ?? 0)}</td>}
                          <td><Badge tone={k.status === 'fechado' ? 'off' : undefined}>{label(CASE_STATUS, k.status)}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {cases.length > 1 && (
                    <tfoot><tr><td colSpan={3}>Total do cliente</td>
                      <td className="num">{fmtMinutes((totals?.billable_minutes ?? 0) + (totals?.nonbillable_minutes ?? 0))}</td>
                      <td className="num">{eur(amount)}</td>{manager && <td className="num">{eur(cost)}</td>}<td></td></tr></tfoot>
                  )}
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: '1rem' }}>O valor de cada caso é a soma do tempo das suas tarefas e do tempo registado diretamente no caso.</p>
          </div>

          <NotesPanel notes={(notes ?? []) as unknown as NoteRow[]} clientId={client.id} meId={me.id} isSocio={me.role === 'socio'} showOrigin />

          <details className="card">
            <summary>Editar dados do cliente</summary>
            <ActionForm action={updateClientRecord} className="form">
              <input type="hidden" name="id" value={client.id} />
              <ClientFields client={client} />
              <div className="form__actions"><SubmitButton>Guardar</SubmitButton></div>
            </ActionForm>
          </details>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Equipa do cliente</h2>
            <p className="small muted" style={{ marginBottom: '.9rem' }}>Quem entra na equipa de um caso fica associado automaticamente.</p>
            {team?.length ? (
              <div className="chips">
                {team.map(t => (
                  <span className="chip" key={t.member_id}>
                    {(t.member as any)?.full_name || '—'}
                    {canTeam && (
                      <ActionForm action={removeClientMember}>
                        <input type="hidden" name="client_id" value={client.id} />
                        <input type="hidden" name="member_id" value={t.member_id} />
                        <button type="submit" aria-label={`Remover ${(t.member as any)?.full_name}`}>×</button>
                      </ActionForm>
                    )}
                  </span>
                ))}
              </div>
            ) : <p className="small muted">Ainda sem membros associados.</p>}
            {canTeam && (
              <ActionForm action={addClientMember} className="inline-form" resetOnSuccess>
                <input type="hidden" name="client_id" value={client.id} />
                <div className="field" style={{ marginTop: '1rem' }}><label htmlFor="cm">Associar membro</label>
                  <select id="cm" name="member_id" required defaultValue="">
                    <option value="">Escolher…</option>
                    {members.filter(m => !teamIds.has(m.id)).map(m => <option key={m.id} value={m.id}>{m.full_name || '—'}</option>)}
                  </select></div>
                <SubmitButton className="btn btn--sm" pendingText="…">Associar</SubmitButton>
              </ActionForm>
            )}
          </div>

          <div className="card">
            <h2>Ficha</h2>
            <dl className="dl">
              <dt>Tipo</dt><dd>{label(CLIENT_KIND, client.kind)}</dd>
              <dt>NIF</dt><dd>{client.nif ?? '—'}</dd>
              <dt>E-mail</dt><dd>{client.email ? <a className="link" href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd>
              <dt>Telefone</dt><dd>{client.phone ? <a className="link" href={`tel:${client.phone}`}>{client.phone}</a> : '—'}</dd>
              <dt>Morada</dt><dd>{client.address ?? '—'}</dd>
              <dt>RGPD</dt><dd>{client.rgpd_consent ? `Autorizado a ${fmtDate(client.consent_at)}` : <Badge tone="warn">Consentimento em falta</Badge>}</dd>
              <dt>Cliente desde</dt><dd>{fmtDate(client.created_at)}</dd>
            </dl>
            {client.notes && <p className="small" style={{ marginTop: '1rem', whiteSpace: 'pre-line' }}>{client.notes}</p>}
          </div>

          <form action={toggleArchiveClient}>
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="archived" value={client.archived ? 'false' : 'true'} />
            <SubmitButton className="btn btn--ghost btn--sm" pendingText="A atualizar…">{client.archived ? 'Reativar cliente' : 'Arquivar cliente'}</SubmitButton>
          </form>
        </div>
      </div>
    </>
  )
}
