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
  // getClaims verifica a assinatura do token (chaves assimétricas: localmente, sem ida ao servidor de Auth;
  // chave simétrica: confirma no servidor). O estado "ativo" é sempre confirmado na base de dados abaixo,
  // por isso um membro desativado perde o acesso no pedido seguinte.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', claims.sub)
    .single()
  if (!profile || !profile.active) return null
  const email = typeof claims.email === 'string' ? claims.email : ''
  return {
    id: claims.sub,
    email,
    fullName: profile.full_name || email,
    role: profile.role as Role,
    active: profile.active,
    // Definido só pelo servidor (app_metadata) quando um sócio cria a conta com palavra-passe inicial
    mustChangePassword: (claims.app_metadata as Record<string, unknown> | undefined)?.must_change_password === true,
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
