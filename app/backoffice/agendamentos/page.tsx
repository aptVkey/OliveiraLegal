import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { MODE_LABEL, money, shortDateTime } from '@/lib/booking/format'
import { isBookingReady } from '@/lib/booking/server'
import { isEmailConfigured } from '@/lib/booking/email'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, Empty, PageHead } from '@/components/ui'
import { cancelBooking, resendBookingEmails } from './actions'
import { BOOKING_STATUS } from './labels'

export const metadata: Metadata = { title: 'Agendamentos' }

const VIEWS = {
  proximas: { label: 'Próximas', status: ['pago', 'conflito'] },
  pendentes: { label: 'Por concluir', status: ['rascunho', 'pendente', 'expirado'] },
  passadas: { label: 'Realizadas', status: ['pago'] },
  canceladas: { label: 'Canceladas', status: ['cancelado'] },
} as const
type View = keyof typeof VIEWS

type Row = {
  id: string; reference: string; name: string; email: string; phone: string | null; mode: 'presencial' | 'online' | null
  topic: string | null; starts_at: string | null; status: string; amount_cents: number | null; currency: string | null
  paid_at: string | null; emails_sent_at: string | null; created_at: string; lead_id: string | null
  area: { name: string } | null
}

export default async function Agendamentos({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const me = await requireMember()
  const { ver } = await searchParams
  const view: View = ver && ver in VIEWS ? (ver as View) : 'proximas'
  const db = await createClient()
  const now = new Date().toISOString()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  let q = db.from('bookings')
    .select('id, reference, name, email, phone, mode, topic, starts_at, status, amount_cents, currency, paid_at, emails_sent_at, created_at, lead_id, area:practice_areas(name)')
    .in('status', [...VIEWS[view].status]).limit(200)
  if (view === 'proximas') q = q.gte('starts_at', now).order('starts_at')
  else if (view === 'passadas') q = q.lt('starts_at', now).order('starts_at', { ascending: false })
  else q = q.order('created_at', { ascending: false })

  const [{ data }, { data: settings }, { count: upcoming }, { data: monthPaid }, { count: abandoned }] = await Promise.all([
    q,
    db.from('booking_settings').select('enabled').eq('id', 1).maybeSingle(),
    db.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pago', 'conflito']).gte('starts_at', now),
    db.from('bookings').select('amount_cents').in('status', ['pago', 'conflito']).gte('paid_at', monthStart),
    db.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['rascunho', 'expirado']).gte('created_at', monthStart),
  ])
  const rows = (data ?? []) as unknown as Row[]
  const revenue = (monthPaid ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const live = !!settings?.enabled && isBookingReady

  return (
    <>
      <PageHead
        eyebrow="Crescimento"
        title="Agendamentos"
        desc={live ? 'A marcação online está ativa no site.' : 'A marcação online não está visível no site.'}
        actions={<Link className="btn btn--sm btn--ghost" href="/backoffice/agendamentos/definicoes">{me.role === 'socio' ? 'Configurar agenda' : 'Ver definições'}</Link>}
      />

      {!live && (
        <p className="alert alert--info" style={{ marginBottom: '1.25rem' }}>
          {!settings?.enabled ? 'A secção de marcações está desligada.' : 'Falta configurar o Stripe no servidor.'}{' '}
          <Link className="link" href="/backoffice/agendamentos/definicoes">Ver o que falta</Link>
        </p>
      )}
      {live && !isEmailConfigured && (
        <p className="alert alert--error" style={{ marginBottom: '1.25rem' }}>
          Os e-mails de confirmação ainda não estão configurados — os clientes pagam, mas não recebem o convite. <Link className="link" href="/backoffice/agendamentos/definicoes">Configurar</Link>
        </p>
      )}

      <div className="totals">
        <div><p>Próximas consultas</p><p>{upcoming ?? 0}</p></div>
        <div><p>Recebido este mês</p><p>{money(revenue)}</p></div>
        <div><p>Abandonadas este mês</p><p>{abandoned ?? 0}</p></div>
      </div>

      <div className="toolbar">
        <nav className="tabs" aria-label="Vista">
          {(Object.keys(VIEWS) as View[]).map(k => (
            <Link key={k} href={`/backoffice/agendamentos${k === 'proximas' ? '' : `?ver=${k}`}`} aria-current={view === k ? 'page' : undefined}>{VIEWS[k].label}</Link>
          ))}
        </nav>
      </div>

      {!rows.length ? (
        <Empty title={view === 'proximas' ? 'Sem consultas marcadas' : 'Nada por aqui'}>
          {view === 'proximas' ? 'As consultas pagas no site aparecem aqui e na lead correspondente.' : ''}
        </Empty>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr>
              <th>{view === 'pendentes' ? 'Criada' : 'Data'}</th><th>Cliente</th><th>Formato</th><th>Área / assunto</th>
              <th className="num">Valor</th><th>Estado</th><th aria-label="Ações"></th>
            </tr></thead>
            <tbody>
              {rows.map(b => {
                const st = BOOKING_STATUS[b.status] ?? { label: b.status }
                const paid = b.status === 'pago' || b.status === 'conflito'
                return (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {b.starts_at && view !== 'pendentes' ? shortDateTime(b.starts_at) : shortDateTime(b.created_at)}
                      <div className="small muted">{b.reference}</div>
                    </td>
                    <td>
                      {b.lead_id ? <Link className="row-link" href={`/backoffice/leads/${b.lead_id}`}>{b.name}</Link> : b.name}
                      <div className="small muted">{b.email}{b.phone ? ` · ${b.phone}` : ''}</div>
                    </td>
                    <td>{b.mode ? MODE_LABEL[b.mode] : '—'}</td>
                    <td style={{ maxWidth: '18rem' }}>
                      {b.area?.name ?? '—'}
                      {b.topic && <div className="small muted" style={{ whiteSpace: 'pre-line' }}>{b.topic.length > 140 ? `${b.topic.slice(0, 140)}…` : b.topic}</div>}
                    </td>
                    <td className="num">{b.amount_cents != null ? money(b.amount_cents, b.currency ?? 'eur') : '—'}</td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {paid && !b.emails_sent_at && <div className="small" style={{ color: 'var(--danger)', marginTop: '.3rem' }}>E-mails por enviar</div>}
                      {b.status === 'pendente' && b.starts_at && <div className="small muted">{shortDateTime(b.starts_at)}</div>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {paid && (
                          <ActionForm action={resendBookingEmails} className="inline-form">
                            <input type="hidden" name="id" value={b.id} />
                            <SubmitButton className="btn btn--sm btn--ghost" pendingText="A enviar…">{b.emails_sent_at ? 'Reenviar e-mails' : 'Enviar e-mails'}</SubmitButton>
                          </ActionForm>
                        )}
                        {paid && b.starts_at && b.starts_at > now && (
                          <form action={cancelBooking}>
                            <input type="hidden" name="id" value={b.id} />
                            <SubmitButton className="btn btn--sm btn--danger" pendingText="A cancelar…"
                              confirm="Cancelar esta consulta? O horário fica livre no site. O reembolso, se houver, faz-se no painel do Stripe.">Cancelar</SubmitButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginTop: '1rem' }}>
        Cancelar uma consulta não devolve o pagamento automaticamente — faça o reembolso no painel do Stripe.
      </p>
    </>
  )
}
