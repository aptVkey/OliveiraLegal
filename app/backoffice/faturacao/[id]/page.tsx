import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { INVOICE_STATUS, label } from '@/lib/labels'
import { eur, fmtDate, fmtMinutes } from '@/lib/format'
import { SubmitButton } from '@/components/submit-button'
import { PrintButton } from '@/components/print-button'
import { Badge, BackLink, Empty, PageHead } from '@/components/ui'
import { cancelPreInvoice, markIssued } from '../actions'

export const metadata: Metadata = { title: 'Pré-fatura' }

export default async function PreFatura({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember()
  if (!CAN.billing(me.role)) return <Empty title="Sem acesso">A faturação está disponível apenas para sócios e financeiro.</Empty>
  const { id } = await params
  const db = await createClient()
  const [{ data: inv }, { data: lines }] = await Promise.all([
    db.from('invoices').select('*, client:clients(name, nif, address, email)').eq('id', id).maybeSingle(),
    db.from('time_entries').select('id, started_at, minutes, rate, amount, description, member:profiles!time_entries_member_id_fkey(full_name), case:cases(reference, title)')
      .eq('invoice_id', id).order('started_at'),
  ])
  if (!inv) notFound()
  const totalMin = (lines ?? []).reduce((s, l) => s + (l.minutes ?? 0), 0)

  return (
    <>
      <div className="no-print"><BackLink href="/backoffice/faturacao">Faturação</BackLink></div>
      <PageHead
        eyebrow={`Pré-fatura · ${label(INVOICE_STATUS, inv.status)}`}
        title={inv.number}
        desc={`${inv.client?.name}${inv.client?.nif ? ` · NIF ${inv.client.nif}` : ''} · ${fmtDate(inv.created_at)}`}
        actions={<>
          <PrintButton />
          {inv.status === 'rascunho' && <>
            <form action={markIssued}><input type="hidden" name="id" value={inv.id} />
              <SubmitButton className="btn btn--sm" confirm="Confirma que a fatura oficial já foi emitida no software certificado?">Marcar como emitida</SubmitButton></form>
            <form action={cancelPreInvoice}><input type="hidden" name="id" value={inv.id} />
              <SubmitButton className="btn btn--danger btn--sm" confirm="Anular esta pré-fatura? As horas voltam a ficar por faturar.">Anular</SubmitButton></form>
          </>}
        </>}
      />
      {inv.status === 'anulada' && <p className="alert alert--error" style={{ marginBottom: '1rem' }}>Pré-fatura anulada. As horas voltaram a ficar por faturar.</p>}
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Data</th><th>Caso</th><th>Membro</th><th>Descrição</th><th className="num">Tempo</th><th className="num">Taxa/h</th><th className="num">Valor</th></tr></thead>
          <tbody>{(lines ?? []).map(l => (
            <tr key={l.id}>
              <td className="small">{fmtDate(l.started_at)}</td>
              <td className="small"><span className="ref">{(l.case as any)?.reference}</span> {(l.case as any)?.title}</td>
              <td className="small">{(l.member as any)?.full_name ?? '—'}</td>
              <td className="small">{l.description ?? '—'}</td>
              <td className="num">{fmtMinutes(l.minutes)}</td>
              <td className="num">{eur(l.rate)}</td>
              <td className="num">{eur(l.amount)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td colSpan={4}>Total (sem IVA)</td><td className="num">{fmtMinutes(totalMin)}</td><td></td><td className="num">{eur(inv.total)}</td></tr></tfoot>
        </table>
        {inv.notes && <p className="small" style={{ marginTop: '1rem' }}>{inv.notes}</p>}
        {inv.status === 'anulada' && !lines?.length && <p className="small muted" style={{ marginTop: '1rem' }}>Sem linhas.</p>}
      </div>
      {inv.status === 'emitida' && <Badge tone="ok">Fatura oficial emitida</Badge>}
    </>
  )
}
