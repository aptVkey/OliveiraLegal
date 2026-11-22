import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { LiveSearch } from '@/components/live-search'
import { createClient } from '@/lib/supabase/server'
import { eur } from '@/lib/format'
import { PageHead } from '@/components/ui'
import { Kanban } from './kanban'

export const metadata: Metadata = { title: 'Leads' }

export default async function Leads({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireMember()
  const { q = '' } = await searchParams
  const db = await createClient()
  let query = db.from('leads')
    .select('id, name, company, stage, estimated_value, created_at, area:practice_areas(name), owner:profiles!leads_owner_id_fkey(full_name)')
    .order('created_at', { ascending: false })
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, '')}%,company.ilike.%${q.replace(/[%,()]/g, '')}%`)
  const { data: leads } = await query

  const open = (leads ?? []).filter(l => l.stage !== 'ganho' && l.stage !== 'perdido')
  const pipeline = open.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0)

  return (
    <>
      <PageHead
        eyebrow="Crescimento"
        title="Leads"
        desc={`${open.length} em aberto · ${eur(pipeline)} em pipeline`}
        actions={<Link className="btn btn--sm" href="/backoffice/leads/novo">Nova lead</Link>}
      />
      <div className="toolbar">
        <LiveSearch placeholder="Procurar por nome ou empresa" />
      </div>
      <p className="small muted" style={{ marginBottom: '1rem' }}>Arraste os cartões entre colunas para mudar de fase.</p>
      <Kanban leads={(leads ?? []).map(l => ({
        id: l.id, name: l.name, company: l.company, stage: l.stage,
        estimated_value: l.estimated_value, area: (l.area as any)?.name ?? null, owner: (l.owner as any)?.full_name ?? null,
      }))} />
    </>
  )
}
