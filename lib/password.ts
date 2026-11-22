// Regras de palavra-passe partilhadas (definição pelo próprio e palavra-passe inicial)
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'A palavra-passe precisa de pelo menos 10 caracteres.'
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'A palavra-passe tem de combinar letras e números.'
  return null
}
