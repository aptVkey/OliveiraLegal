export type FormState = { error?: string; ok?: boolean; message?: string }

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key)
  if (v == null) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export const bool = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true'

// Mensagens claras em português, sem expor detalhes internos
export function dbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Ocorreu um erro. Tente novamente.'
  switch (error.code) {
    case '42501': return 'Não tem permissão para esta ação.'
    case 'P0001': return error.message ?? 'Operação não permitida.'
    case '23505': return 'Já existe um registo com estes dados.'
    case '23503': return 'Este registo está ligado a outros dados e não pode ser removido.'
    case '23514': return 'Há valores inválidos no formulário.'
    case '22P02': return 'Há valores com formato inválido.'
    default:
      console.error('[db]', error)
      return 'Ocorreu um erro. Tente novamente.'
  }
}
