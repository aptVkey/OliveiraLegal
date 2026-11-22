import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MODE_LABEL, TZ, hour } from '@/lib/booking/format'
import { BOOKING_STATUS } from './labels'

type Ev = {
  id: string; reference: string; name: string; mode: 'presencial' | 'online' | null
  starts_at: string; ends_at: string | null; status: string; lead_id: string | null
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const pad = (n: number) => String(n).padStart(2, '0')
// Dia no fuso de Lisboa (AAAA-MM-DD), para não trocar de dia perto da meia-noite
const lisbonDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

function parseMonth(mes?: string) {
  const today = lisbonDay(new Date())
  const m = mes?.match(/^(\d{4})-(\d{2})$/)
  const y = m ? Number(m[1]) : Number(today.slice(0, 4))
  const mo = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? Number(m[2]) : Number(today.slice(5, 7))
  return { y, mo, today }
}
const monthKey = (y: number, mo: number) => {
  const d = new Date(Date.UTC(y, mo - 1, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export async function BookingCalendar({ mes }: { mes?: string }) {
  const { y, mo, today } = parseMonth(mes)
  const first = new Date(Date.UTC(y, mo - 1, 1))
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7 // segunda = 0
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7

  // Margem de um dia de cada lado por causa do fuso horário
  const from = new Date(Date.UTC(y, mo - 1, 1) - 864e5).toISOString()
  const to = new Date(Date.UTC(y, mo, 1) + 864e5).toISOString()
  const db = await createClient()
  const { data } = await db.from('bookings')
    .select('id, reference, name, mode, starts_at, ends_at, status, lead_id')
    .in('status', ['pago', 'conflito', 'pendente'])
    .gte('starts_at', from).lt('starts_at', to)
    .order('starts_at').limit(500)

  const byDay = new Map<string, Ev[]>()
  for (const e of (data ?? []) as Ev[]) {
    const k = lisbonDay(new Date(e.starts_at))
    byDay.set(k, [...(byDay.get(k) ?? []), e])
  }
  const prefix = `${y}-${pad(mo)}-`
  const total = [...byDay.entries()].filter(([k]) => k.startsWith(prefix)).reduce((s, [, v]) => s + v.filter(e => e.status !== 'pendente').length, 0)
  const href = (k: string) => `/backoffice/agendamentos?ver=calendario&mes=${k}`
  const isCurrent = today.startsWith(`${y}-${pad(mo)}`)

  const event = (e: Ev) => {
    const st = BOOKING_STATUS[e.status]
    const body = (
      <>
        <span className="cal__time">{hour(e.starts_at)}</span>
        <span className="cal__name">{e.name}</span>
        <span className="cal__meta">{e.mode ? MODE_LABEL[e.mode] : ''}{e.status !== 'pago' && st ? ` · ${st.label}` : ''}</span>
      </>
    )
    const cls = `cal__ev cal__ev--${e.mode ?? 'online'}${e.status !== 'pago' ? ` cal__ev--${e.status}` : ''}`
    const title = `${hour(e.starts_at)}${e.ends_at ? `–${hour(e.ends_at)}` : ''} · ${e.name} · ${e.reference}`
    return e.lead_id
      ? <Link key={e.id} className={cls} href={`/backoffice/leads/${e.lead_id}`} title={title}>{body}</Link>
      : <div key={e.id} className={cls} title={title}>{body}</div>
  }

  return (
    <div className="card cal">
      <div className="cal__head">
        <h2 className="cal__title">{MONTHS[mo - 1]} <span>{y}</span></h2>
        <p className="small muted">{total ? `${total} ${total === 1 ? 'consulta' : 'consultas'} este mês` : 'Sem consultas este mês'}</p>
        <div className="cal__nav">
          {!isCurrent && <Link className="btn btn--sm btn--ghost" href={href(today.slice(0, 7))}>Hoje</Link>}
          <Link className="cal__arrow" href={href(monthKey(y, mo - 1))} aria-label="Mês anterior">‹</Link>
          <Link className="cal__arrow" href={href(monthKey(y, mo + 1))} aria-label="Mês seguinte">›</Link>
        </div>
      </div>

      <div className="cal__grid" role="grid" aria-label={`Consultas de ${MONTHS[mo - 1]} de ${y}`}>
        {DOW.map(d => <div key={d} className="cal__dow" role="columnheader">{d}</div>)}
        {Array.from({ length: cells }, (_, i) => {
          const day = i - lead + 1
          if (day < 1 || day > daysInMonth) return <div key={i} className="cal__cell cal__cell--out" aria-hidden="true" />
          const k = `${prefix}${pad(day)}`
          const evs = byDay.get(k) ?? []
          const weekend = i % 7 >= 5
          return (
            <div key={i} role="gridcell" className={`cal__cell${k === today ? ' is-today' : ''}${k < today ? ' is-past' : ''}${weekend ? ' is-weekend' : ''}${evs.length ? ' has-ev' : ''}`}>
              <span className="cal__day">{day}</span>
              {evs.map(event)}
            </div>
          )
        })}
      </div>

      <div className="cal__legend small muted">
        <span><i className="cal__dot cal__dot--presencial" />Presencial</span>
        <span><i className="cal__dot cal__dot--online" />Online</span>
        <span><i className="cal__dot cal__dot--pendente" />A pagar</span>
      </div>
    </div>
  )
}
