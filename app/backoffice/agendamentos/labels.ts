export const BOOKING_STATUS: Record<string, { label: string; tone?: 'off' | 'warn' | 'ok' | 'danger' }> = {
  rascunho: { label: 'Incompleta', tone: 'off' },
  pendente: { label: 'A pagar', tone: 'warn' },
  pago: { label: 'Paga', tone: 'ok' },
  conflito: { label: 'Reagendar', tone: 'danger' },
  expirado: { label: 'Abandonada', tone: 'off' },
  cancelado: { label: 'Cancelada', tone: 'off' },
}
export const WEEKDAYS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
