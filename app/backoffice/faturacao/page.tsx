import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { INVOICE_STATUS, label } from '@/lib/labels'
import { eur, fmtDate, fmtMinutes } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, Empty, PageHead } from '@/components/ui'
import { createPreInvoice } from './actions'

export const metadata: Metadata = { title: 'Faturação' }

export default async function Faturacao() {
  const me = await requireMember()
  if (!CAN.billing(me.role)) return <Empty title="Sem acesso">A faturação está disponível apenas para sócios e financeiro.</Empty>

  const db = await createClient()
  const [{ data: entries }, { data: invoices }] = await Promise.all([
    db.from('time_entries').select('minutes, amount, case:cases!inner(client_id, client:clients(id, name))')
      .eq('status', 'por_faturar').eq('billable', true).not('ended_at', 'is', null),
    db.from('invoices').select('id, number, status, total, created_at, client:clients(name)').order('created_at', { ascending: false }).limit(100),
  ])

  const byClient = new Map<string, { id: string; name: string; minutes: number; amount: number; count: number }>()
  for (const e of entries ?? []) {
    const c = (e.case as any)?.client
    if (!c) continue
    const row = byClient.get(c.id) ?? { id: c.id, name: c.name, minutes: 0, amount: 0, count: 0 }
    row.minutes += e.minutes ?? 0; row.amount += Number(e.amount ?? 0); row.count++
    byClient.set(c.id, row)
  }
  const pending = [...byClient.values()].sort((a, b) => b.amount - a.amount)
  const totalPending = pending.reduce((s, r) => s + r.amount, 0)

  return (
    <>
      <PageHead eyebrow="Escritório" title="Faturação"
        desc="Pré-faturas com as horas faturáveis. A fatura oficial é emitida no software certificado pela AT." />

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h2>Por faturar · {eur(totalPending)}</h2>
        {!pending.length ? <p className="small muted">Não há horas faturáveis por faturar.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Cliente</th><th className="num">Registos</th><th className="num">Tempo</th><th className="num">Valor</th><th></th></tr></thead>
              <tbody>{pending.map(r => (
                <tr key={r.id}>
                  <td><Link className="row-link" href={`/backoffice/clientes/${r.id}`}>{r.name}</Link></td>
                  <td className="num">{r.count}</td>
                  <td className="num">{fmtMinutes(r.minutes)}</td>
                  <td className="num">{eur(r.amount)}</td>
                  <td className="num">
                    <ActionForm action={createPreInvoice}>
                      <input type="hidden" name="client_id" value={r.id} />
                      <SubmitButton className="btn btn--sm" pendingText="A criar…" confirm={`Criar pré-fatura para ${r.name} (${eur(r.amount)})?`}>Criar pré-fatura</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Pré-faturas</h2>
        {!invoices?.length ? <p className="small muted">Ainda não há pré-faturas.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th className="num">Total</th><th>Estado</th></tr></thead>
              <tbody>{invoices.map(i => (
                <tr key={i.id}>
                  <td><Link className="row-link" href={`/backoffice/faturacao/${i.id}`}>{i.number}</Link></td>
                  <td>{(i.client as any)?.name ?? '—'}</td>
                  <td className="small">{fmtDate(i.created_at)}</td>
                  <td className="num">{eur(i.total)}</td>
                  <td><Badge tone={i.status === 'emitida' ? 'ok' : i.status === 'anulada' ? 'off' : undefined}>{label(INVOICE_STATUS, i.status)}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
