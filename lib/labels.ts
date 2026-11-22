export const LEAD_STAGES = { novo: 'Novo', contactado: 'Contactado', reuniao: 'Reunião', proposta: 'Proposta', ganho: 'Ganho', perdido: 'Perdido' } as const
export const LEAD_SOURCES = { site: 'Site', indicacao: 'Indicação', redes_sociais: 'Redes sociais', telefone: 'Telefone', outro: 'Outro' } as const
export const CASE_STATUS = { aberto: 'Aberto', em_curso: 'Em curso', suspenso: 'Suspenso', fechado: 'Fechado' } as const
export const BILLING = { hora: 'À hora', fixo: 'Valor fixo', avenca: 'Avença' } as const
export const PRIORITY = { baixa: 'Baixa', media: 'Média', alta: 'Alta' } as const
export const TASK_STATUS = { por_fazer: 'Por fazer', em_curso: 'Em curso', concluida: 'Concluída' } as const
export const ENTRY_STATUS = { por_faturar: 'Por faturar', faturado: 'Faturado' } as const
export const INVOICE_STATUS = { rascunho: 'Rascunho', emitida: 'Emitida', anulada: 'Anulada' } as const
export const CLIENT_KIND = { particular: 'Particular', empresa: 'Empresa' } as const

export function label(map: Record<string, string>, key: string | null | undefined) {
  return key ? map[key] ?? key : '—'
}
