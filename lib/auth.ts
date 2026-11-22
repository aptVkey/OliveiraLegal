import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { Role } from '@/lib/roles'

export type Member = {
  id: string
  email: string
  fullName: string
  role: Role
  active: boolean
  mustChangePassword: boolean
}

// Verificação no servidor, em cada página do backoffice (não depende só do proxy).
export const getMember = cache(async (): Promise<Member | null> => {
  await connection() // nunca pré-renderizar páginas protegidas
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .single()
  if (!profile || !profile.active) return null
  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile.full_name || user.email || '',
    role: profile.role as Role,
    active: profile.active,
    // Definido só pelo servidor (app_metadata) quando um sócio cria a conta com palavra-passe inicial
    mustChangePassword: user.app_metadata?.must_change_password === true,
  }
})

export async function requireMember(): Promise<Member> {
  const member = await getMember()
  // ?erro evita um ciclo /login ↔ /backoffice quando há sessão mas a conta está inativa
  if (!member) redirect('/login?erro=acesso')
  if (member.mustChangePassword) redirect('/definir-palavra-passe')
  return member
}

// Sócio confirmado na base de dados a cada pedido (não confia no que vem do browser)
export async function requireSocio(): Promise<Member> {
  const member = await requireMember()
  if (member.role !== 'socio') throw new Error('Só um sócio pode gerir utilizadores.')
  return member
}
