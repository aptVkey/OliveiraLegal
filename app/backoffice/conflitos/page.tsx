import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { LiveSearch } from '@/components/live-search'
import { createClient } from '@/lib/supabase/server'
import { Badge, Empty, PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Verificação de conflitos' }

export default async function Conflitos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireMember()
  const { q = '' } = await searchParams
  const term = q.trim()
  let results: { kind: string; label: string; detail: string }[] = []
  if (term.length >= 3) {
    const db = await createClient()
    const { data } = await db.rpc('conflict_check', { q: term })
    results = data ?? []
  }

  return (
    <>
      <PageHead eyebrow="Escritório" title={<>Verificação de <em>conflitos</em></>}
        desc="Procura o nome ou NIF em clientes, leads e partes contrárias de todos os processos." />
      <div className="toolbar">
        <LiveSearch placeholder="Nome, empresa ou NIF (mín. 3 caracteres)" autoFocus />
      </div>
      {term.length < 3 ? (
        <Empty title="Indique um nome">Pesquise a pessoa ou empresa antes de aceitar um novo assunto.</Empty>
      ) : results.length === 0 ? (
        <div className="empty"><h2>Sem coincidências</h2><p>Não foi encontrado “{term}” em clientes, leads ou partes contrárias.</p><Badge tone="ok">Sem conflito aparente</Badge></div>
      ) : (
        <div className="card table-wrap">
          <p className="alert alert--error" style={{ marginBottom: '1rem' }}>Foram encontradas {results.length} coincidências. Analise antes de avançar.</p>
          <table className="table">
            <thead><tr><th>Encontrado em</th><th>Nome</th><th>Detalhe</th></tr></thead>
            <tbody>{results.map((r, i) => (
              <tr key={i}><td><Badge tone={r.kind === 'Parte contrária' ? 'danger' : undefined}>{r.kind}</Badge></td><td>{r.label}</td><td className="small muted">{r.detail || '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  )
}
