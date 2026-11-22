import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { LiveSearch } from '@/components/live-search'
import { createClient } from '@/lib/supabase/server'
import { CASE_STATUS, BILLING, label } from '@/lib/labels'
import { fmtDate } from '@/lib/format'
import { Badge, Empty, PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Casos' }

const FILTERS = { ativos: 'Ativos', fechado: 'Fechados', todos: 'Todos' } as const

export default async function Casos({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const me = await requireMember()
  const { q = '', estado = 'ativos' } = await searchParams
  const db = await createClient()
  let query = db.from('cases')
    .select('id, reference, title, status, billing_type, opened_at, opposing_party, client:clients(id, name), area:practice_areas(name), responsible:profiles!cases_responsible_id_fkey(full_name)')
    .order('opened_at', { ascending: false })
  if (estado === 'ativos') query = query.neq('status', 'fechado')
  else if (estado === 'fechado') query = query.eq('status', 'fechado')
  const term = q.replace(/[%,()]/g, '')
  if (term) query = query.or(`title.ilike.%${term}%,reference.ilike.%${term}%,opposing_party.ilike.%${term}%`)
  const { data: cases } = await query
  const canCreate = ['socio', 'advogado', 'associado'].includes(me.role)

  return (
    <>
      <PageHead eyebrow="Escritório" title="Casos" desc={`${cases?.length ?? 0} ${label(FILTERS, estado).toLowerCase()}`}
        actions={canCreate ? <Link className="btn btn--sm" href="/backoffice/casos/novo">Novo caso</Link> : undefined} />
      <div className="toolbar">
        <LiveSearch placeholder="Assunto, referência ou parte contrária" />
        <nav className="tabs" aria-label="Estado">
          {Object.entries(FILTERS).map(([k, v]) => (
            <Link key={k} href={`/backoffice/casos?estado=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`} aria-current={estado === k ? 'page' : undefined}>{v}</Link>
          ))}
        </nav>
      </div>
      {!cases?.length ? (
        <Empty title="Sem casos">{me.role === 'socio' || me.role === 'financeiro' ? 'Ainda não há casos.' : 'Só vê os casos em que faz parte da equipa.'}</Empty>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Ref.</th><th>Assunto</th><th>Cliente</th><th>Responsável</th><th>Honorários</th><th>Estado</th></tr></thead>
            <tbody>
              {cases.map(k => (
                <tr key={k.id}>
                  <td className="ref">{k.reference}</td>
                  <td><Link className="row-link" href={`/backoffice/casos/${k.id}`}>{k.title}</Link>
                    <div className="small muted">{[(k.area as any)?.name, k.opposing_party && `vs. ${k.opposing_party}`].filter(Boolean).join(' · ') || `Aberto a ${fmtDate(k.opened_at)}`}</div></td>
                  <td>{(k.client as any) ? <Link className="row-link" href={`/backoffice/clientes/${(k.client as any).id}`}>{(k.client as any).name}</Link> : '—'}</td>
                  <td>{(k.responsible as any)?.full_name ?? '—'}</td>
                  <td className="small">{label(BILLING, k.billing_type)}</td>
                  <td><Badge tone={k.status === 'fechado' ? 'off' : k.status === 'suspenso' ? 'warn' : undefined}>{label(CASE_STATUS, k.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
