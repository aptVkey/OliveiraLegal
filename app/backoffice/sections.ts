import type { Role } from '@/lib/roles'

export type Section = { slug: string; label: string; group: string; icon: string; roles?: Role[] }

// Ícones: traços simples (viewBox 0 0 24 24)
export const SECTIONS: Section[] = [
  { slug: '', label: 'Painel', group: 'Geral', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z' },
  { slug: 'leads', label: 'Leads', group: 'Crescimento', icon: 'M3 5h18l-7 8v6l-4-2v-4z' },
  { slug: 'clientes', label: 'Clientes', group: 'Escritório', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5' },
  { slug: 'casos', label: 'Casos', group: 'Escritório', icon: 'M4 7h16v12H4zM9 7V5h6v2' },
  { slug: 'tarefas', label: 'Tarefas', group: 'Escritório', icon: 'M5 12l4 4L19 6' },
  { slug: 'tempo', label: 'Tempo', group: 'Escritório', icon: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
  { slug: 'faturacao', label: 'Faturação', group: 'Escritório', roles: ['socio', 'financeiro'], icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  { slug: 'equipa', label: 'Equipa', group: 'Administração', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11a3 3 0 1 0 0-6M3 20c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5M15.5 15.6c2.3.2 4.3 1.6 5.5 4.4' },
  { slug: 'definicoes', label: 'Definições', group: 'Administração', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z' },
]
