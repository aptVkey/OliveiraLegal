import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { LiveSearch } from '@/components/live-search'
import { CAN } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_KIND, label } from '@/lib/labels'
import { eur, fmtMinutes } from '@/lib/format'
import { Avatars } from '@/components/avatars'
import { Badge, Empty, PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Clientes' }

type Totals = { cases_total: number; cases_open: number; billable_minutes: number; amount: number; cost: number; unbilled: number }

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; arquivo?: string }> }) {
  const me = await requireMember()
  const manager = CAN.billing(me.role)
  const { q = '', arquivo } = await searchParams
  const archived = arquivo === '1'
  const db = await createClient()
  let query = db.from('clients')
    .select('id, kind, name, nif, email, phone, rgpd_consent, team:client_members(member:profiles(full_name))')
    .eq('archived', archived).order('name')
  const term = q.replace(/[%,()]/g, '')
  if (term) query = query.or(`name.ilike.%${term}%,nif.ilike.%${term}%,email.ilike.%${term}%`)
  // Lista e totais em paralelo (os totais são poucos e filtrados aqui para os clientes listados)
  const [{ data: clients }, { data: totalsRows }] = await Promise.all([query, db.from('client_totals').select('*')])

  const ids = new Set((clients ?? []).map(c => c.id))
  const totals = new Map<string, Totals>((totalsRows ?? []).filter(t => ids.has(t.client_id)).map(t => [t.client_id, t]))
  const sum = (k: keyof Totals) => [...totals.values()].reduce((s, t) => s + Number(t[k] ?? 0), 0)
  const qs = (extra: string) => [extra, q && `q=${encodeURIComponent(q)}`].filter(Boolean).join('&')

  return (
    <>
      <PageHead
        eyebrow="Escritório"
        title="Clientes"
        desc={`${clients?.length ?? 0} ${archived ? 'arquivados' : 'ativos'}`}
        actions={<Link className="btn btn--sm" href="/backoffice/clientes/novo">Novo cliente</Link>}
      />

      {!!clients?.length && (
        <div className="totals">
          <div><p>Casos ativos</p><p>{sum('cases_open')}</p></div>
          <div><p>Horas faturáveis</p><p>{fmtMinutes(sum('billable_minutes'))}</p></div>
          <div><p>Valor</p><p>{eur(sum('amount'))}</p></div>
          {manager && <div><p>Custo</p><p>{eur(sum('cost'))}</p></div>}
          {manager && <div><p>Por faturar</p><p>{eur(sum('unbilled'))}</p></div>}
        </div>
      )}

      <div className="toolbar">
        <LiveSearch placeholder="Nome, NIF ou e-mail" />
        <nav className="tabs" aria-label="Estado">
          <Link href={`/backoffice/clientes${q ? `?${qs('')}` : ''}`} aria-current={!archived ? 'page' : undefined}>Ativos</Link>
          <Link href={`/backoffice/clientes?${qs('arquivo=1')}`} aria-current={archived ? 'page' : undefined}>Arquivados</Link>
        </nav>
      </div>

      {!clients?.length ? (
        <Empty title={q ? 'Sem resultados' : archived ? 'Sem clientes arquivados' : 'Ainda sem clientes'}>
          {q ? 'Experimente outra pesquisa.' : archived ? '' : 'Crie o primeiro cliente ou converta uma lead.'}
        </Empty>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr>
              <th>Cliente</th><th>Equipa</th><th className="num">Casos</th><th className="num">Horas</th><th className="num">Valor</th>
              {manager && <th className="num">Custo</th>}{manager && <th className="num">Por faturar</th>}<th>RGPD</th>
            </tr></thead>
            <tbody>
              {clients.map(c => {
                const t = totals.get(c.id)
                const team = ((c.team as any[]) ?? []).map(m => m.member?.full_name).filter(Boolean)
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="row-link" href={`/backoffice/clientes/${c.id}`}>{c.name}</Link>
                      <div className="small muted">{[label(CLIENT_KIND, c.kind), c.nif && `NIF ${c.nif}`].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><Avatars names={team} /></td>
                    <td className="num">{t ? <>{t.cases_open}<span className="muted small"> / {t.cases_total}</span></> : 0}</td>
                    <td className="num">{fmtMinutes(t?.billable_minutes ?? 0)}</td>
                    <td className="num">{eur(t?.amount ?? 0)}</td>
                    {manager && <td className="num">{eur(t?.cost ?? 0)}</td>}
                    {manager && <td className="num">{eur(t?.unbilled ?? 0)}</td>}
                    <td>{c.rgpd_consent ? <Badge tone="ok">Sim</Badge> : <Badge tone="warn">Em falta</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
