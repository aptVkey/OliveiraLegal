import { bookingDb, isBookingReady, json, publicError } from '@/lib/booking/server'

export const dynamic = 'force-dynamic'
const DAY = /^\d{4}-\d{2}-\d{2}$/

// Horários livres (hora de Lisboa) entre ?de= e ?ate=
export async function GET(req: Request) {
  if (!isBookingReady) return json({ error: 'Indisponível' }, 503)
  const u = new URL(req.url)
  const from = u.searchParams.get('de') ?? '', to = u.searchParams.get('ate') ?? ''
  if (!DAY.test(from) || !DAY.test(to)) return json({ error: 'Datas inválidas' }, 400)
  const { data, error } = await bookingDb().rpc('booking_slots', { p_from: from, p_to: to })
  if (error) return json({ error: publicError(error) }, 400)
  const days: Record<string, { t: string; at: string }[]> = {}
  for (const s of (data ?? []) as { starts_at: string; day: string; hour: string }[]) {
    (days[s.day] ??= []).push({ t: s.hour, at: s.starts_at })
  }
  return json({ days })
}
