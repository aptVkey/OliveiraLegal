export const ROLES = {
  socio: 'Sócio',
  advogado: 'Advogado',
  associado: 'Associado',
  estagiario: 'Estagiário',
  assistente: 'Assistente',
  financeiro: 'Financeiro',
} as const

export type Role = keyof typeof ROLES

// Permissões base por papel. A base de dados (RLS) aplica as mesmas regras.
export const CAN = {
  manageTeam: (r: Role) => r === 'socio',
  manageRates: (r: Role) => r === 'socio' || r === 'financeiro',
  seeAllCases: (r: Role) => r === 'socio' || r === 'financeiro',
  billing: (r: Role) => r === 'socio' || r === 'financeiro',
}
