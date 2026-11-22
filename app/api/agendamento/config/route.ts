import { bookingDb, isBookingReady, json } from '@/lib/booking/server'

export const dynamic = 'force-dynamic'

// O site só mostra a secção quando o backoffice a ativou e o Stripe está ligado
export async function GET() {
  if (!isBookingReady) return cached({ enabled: false })
  const { data, error } = await bookingDb().rpc('booking_public_config')
  if (error || !data) return json({ enabled: false }) // erros não ficam em cache
  return cached(data)
}

// Dados públicos e iguais para todos: a CDN da Vercel responde sem acordar o servidor nem a base de dados.
// Uma alteração no backoffice aparece no site em até 1 minuto.
function cached(data: unknown) {
  return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' } })
}
