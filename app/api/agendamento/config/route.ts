import { bookingDb, isBookingReady, json } from '@/lib/booking/server'

export const dynamic = 'force-dynamic'

// O site só mostra a secção quando o backoffice a ativou e o Stripe está ligado
export async function GET() {
  if (!isBookingReady) return json({ enabled: false })
  const { data, error } = await bookingDb().rpc('booking_public_config')
  if (error || !data) return json({ enabled: false })
  return json(data)
}
