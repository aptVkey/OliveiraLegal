import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'

export const metadata: Metadata = { title: 'Painel' }

const STATS = [
  { label: 'Leads em aberto', hint: 'Disponível na Fase 3' },
  { label: 'Casos ativos', hint: 'Disponível na Fase 1' },
  { label: 'Tarefas desta semana', hint: 'Disponível na Fase 1' },
  { label: 'Horas faturáveis (mês)', hint: 'Disponível na Fase 2' },
]

export default async function Painel() {
  const member = await requireMember()
  const first = member.fullName.split(' ')[0]
  const hour = Number(new Intl.DateTimeFormat('pt-PT', { hour: 'numeric', hour12: false, timeZone: 'Europe/Lisbon' }).format(new Date()))
  const greeting = hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite'

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>{greeting}, <em>{first}.</em></h1>
        </div>
      </header>
      <section className="grid" aria-label="Indicadores">
        {STATS.map(s => (
          <article className="card" key={s.label}>
            <p className="stat__label">{s.label}</p>
            <p className="stat__value">—</p>
            <p className="stat__hint">{s.hint}</p>
          </article>
        ))}
      </section>
    </>
  )
}
