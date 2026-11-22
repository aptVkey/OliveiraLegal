const TZ = 'Europe/Lisbon'
const eurFmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export const eur = (v: unknown) => (v == null || v === '' ? '—' : eurFmt.format(Number(v)))

export function fmtDate(v: string | null | undefined) {
  if (!v) return '—'
  const isDay = v.length === 10
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: isDay ? 'UTC' : TZ })
    .format(new Date(isDay ? `${v}T00:00:00Z` : v))
}

export function fmtDateTime(v: string | null | undefined) {
  if (!v) return '—'
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(v))
}

export function fmtMinutes(m: number | null | undefined) {
  if (m == null) return '—'
  const h = Math.floor(m / 60), r = m % 60
  return h ? `${h}h${r ? ` ${String(r).padStart(2, '0')}m` : ''}` : `${r}m`
}

// Data de hoje em Lisboa (AAAA-MM-DD)
export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}

export function isOverdue(due: string | null | undefined) {
  return !!due && due < todayISO()
}
