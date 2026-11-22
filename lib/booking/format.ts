export const TZ = 'Europe/Lisbon'
export const MODE_LABEL: Record<string, string> = { presencial: 'Presencial', online: 'Online' }

export const money = (cents: number, currency = 'eur') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

export const longDate = (d: string | Date) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d))

export const hour = (d: string | Date) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d))

export const shortDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
