'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSocio, type Member } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { authRedirect } from '@/lib/site'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { bool, dbError, num, str, type FormState } from '@/lib/forms'
import { passwordProblem } from '@/lib/password'
import { ROLES } from '@/lib/roles'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const BAN_FOREVER = '876000h' // ~100 anos
const NO_ADMIN: FormState = { error: 'Falta configurar a chave secreta no servidor (SUPABASE_SECRET_KEY).' }

// Cada ação confirma na base de dados que quem pede é sócio
async function socio(): Promise<Member | FormState> {
  try { return await requireSocio() } catch { return { error: 'Só um sócio pode gerir utilizadores.' } }
}
const denied = (x: Member | FormState): x is FormState => !('id' in x)

function adminError(e: { message?: string; status?: number; code?: string } | null) {
  const m = (e?.message ?? '').toLowerCase()
  if (e?.code === 'email_exists' || m.includes('already') || m.includes('registered')) return 'Já existe um utilizador com este e-mail.'
  if (e?.code === 'weak_password') return 'Palavra-passe demasiado fraca.'
  if (m.includes('rate limit')) return 'Limite de envio de e-mails atingido. Tente mais tarde.'
  if (e?.status === 401 || e?.status === 403) return 'A chave secreta do servidor é inválida.'
  console.error('[admin]', e)
  return 'Não foi possível concluir. Tente novamente.'
}

function refresh(id?: string) {
  revalidatePath('/backoffice/equipa')
  if (id) revalidatePath(`/backoffice/equipa/${id}`)
}

function readProfile(fd: FormData) {
  return {
    full_name: str(fd, 'full_name'),
    email: str(fd, 'email')?.toLowerCase() ?? null,
    role: str(fd, 'role') ?? 'assistente',
    hourly_rate: num(fd, 'hourly_rate'),
    cost_rate: num(fd, 'cost_rate'),
  }
}

function invalid(p: ReturnType<typeof readProfile>): string | null {
  if (!p.full_name) return 'Indique o nome.'
  if (!p.email || !EMAIL.test(p.email)) return 'Indique um e-mail válido.'
  if (!(p.role in ROLES)) return 'Papel inválido.'
  if ((p.hourly_rate ?? 0) < 0 || (p.cost_rate ?? 0) < 0) return 'As taxas não podem ser negativas.'
  return null
}

// Novo utilizador: por convite (recomendado) ou com palavra-passe inicial, que tem de trocar no 1.º acesso
export async function createMember(_: FormState, fd: FormData): Promise<FormState> {
  const me = await socio(); if (denied(me)) return me
  if (!isAdminConfigured) return NO_ADMIN
  const p = readProfile(fd)
  const bad = invalid(p); if (bad) return { error: bad }
  const mode = str(fd, 'mode') === 'password' ? 'password' : 'invite'
  const admin = createAdminClient()

  let userId: string
  if (mode === 'password') {
    const password = String(fd.get('password') ?? '')
    const pb = passwordProblem(password); if (pb) return { error: pb }
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email!, password, email_confirm: true,
      user_metadata: { full_name: p.full_name },
      app_metadata: { must_change_password: true },
    })
    if (error || !data.user) return { error: adminError(error) }
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(p.email!, { data: { full_name: p.full_name }, redirectTo: await authRedirect() })
    if (error || !data.user) return { error: adminError(error) }
    userId = data.user.id
  }

  // Papel e taxas gravados com a sessão do sócio (RLS, proteção e auditoria aplicam-se)
  const db = await createClient()
  const { error } = await db.from('profiles')
    .update({ full_name: p.full_name, role: p.role, hourly_rate: p.hourly_rate, cost_rate: p.cost_rate })
    .eq('id', userId)
  if (error) return { error: `Utilizador criado, mas o papel não foi guardado: ${dbError(error)}` }
  refresh()
  redirect(`/backoffice/equipa/${userId}?criado=${mode}`)
}

export async function updateMember(_: FormState, fd: FormData): Promise<FormState> {
  const me = await socio(); if (denied(me)) return me
  const id = str(fd, 'id')
  const p = readProfile(fd)
  if (!id) return { error: 'Membro em falta.' }
  const bad = invalid(p); if (bad) return { error: bad }
  const active = bool(fd, 'active')
  if (id === me.id && (p.role !== 'socio' || !active)) return { error: 'Não pode retirar o seu próprio acesso de sócio.' }

  const db = await createClient()
  const { data: prev } = await db.from('profiles').select('active').eq('id', id).single()
  const { error } = await db.from('profiles').update({
    full_name: p.full_name, role: p.role, hourly_rate: p.hourly_rate, cost_rate: p.cost_rate, active,
  }).eq('id', id)
  if (error) return { error: dbError(error) }

  if (isAdminConfigured) {
    const admin = createAdminClient()
    const { data: u } = await admin.auth.admin.getUserById(id)
    const changes: Record<string, unknown> = {}
    if (u.user && p.email !== u.user.email) Object.assign(changes, { email: p.email, email_confirm: true })
    // Desativar também bloqueia o login e a renovação de sessões
    if (prev && prev.active !== active) changes.ban_duration = active ? 'none' : BAN_FOREVER
    if (Object.keys(changes).length) {
      const { error: e2 } = await admin.auth.admin.updateUserById(id, changes)
      if (e2) return { error: `Dados guardados, mas o acesso não foi atualizado: ${adminError(e2)}` }
    }
  }
  refresh(id)
  return { ok: true, message: active ? 'Alterações guardadas.' : 'Alterações guardadas. Acesso desativado.' }
}

// Envia ao membro um e-mail para definir nova palavra-passe (o sócio nunca a vê)
export async function sendPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const me = await socio(); if (denied(me)) return me
  if (!isAdminConfigured) return NO_ADMIN
  const id = str(fd, 'id'); if (!id) return { error: 'Membro em falta.' }
  const { data, error } = await createAdminClient().auth.admin.getUserById(id)
  if (error || !data.user?.email) return { error: adminError(error) }
  const db = await createClient()
  const { error: e2 } = await createAdminClient().auth.resetPasswordForEmail(data.user.email, { redirectTo: await authRedirect() })
  if (e2) return { error: adminError(e2) }
  return { ok: true, message: `Link de nova palavra-passe enviado para ${data.user.email}.` }
}

export async function resendInvite(_: FormState, fd: FormData): Promise<FormState> {
  const me = await socio(); if (denied(me)) return me
  if (!isAdminConfigured) return NO_ADMIN
  const id = str(fd, 'id'); if (!id) return { error: 'Membro em falta.' }
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user?.email) return { error: adminError(error) }
  if (data.user.last_sign_in_at) return { error: 'Este membro já aceitou o convite.' }
  const { error: e2 } = await admin.auth.admin.inviteUserByEmail(data.user.email, { redirectTo: await authRedirect() })
  if (e2) return { error: adminError(e2) }
  return { ok: true, message: `Convite reenviado para ${data.user.email}.` }
}

// Apagar: só quem não tem tempo registado; sempre fica pelo menos um sócio ativo
export async function deleteMember(_: FormState, fd: FormData): Promise<FormState> {
  const me = await socio(); if (denied(me)) return me
  if (!isAdminConfigured) return NO_ADMIN
  const id = str(fd, 'id')
  if (!id) return { error: 'Membro em falta.' }
  if (id === me.id) return { error: 'Não pode apagar a sua própria conta.' }

  const db = await createClient()
  const [{ data: target }, { count: entries }, { count: socios }] = await Promise.all([
    db.from('profiles').select('role').eq('id', id).single(),
    db.from('time_entries').select('id', { count: 'exact', head: true }).eq('member_id', id),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'socio').eq('active', true),
  ])
  if (!target) return { error: 'Membro não encontrado.' }
  if (target.role === 'socio' && (socios ?? 0) <= 1) return { error: 'Tem de existir pelo menos um sócio ativo.' }
  if ((entries ?? 0) > 0) return { error: `Este membro tem ${entries} registos de tempo. Para manter o histórico, desative o acesso em vez de apagar.` }

  const { error } = await createAdminClient().auth.admin.deleteUser(id)
  if (error) return { error: `${adminError(error)} Se tiver dados associados, desative o acesso em vez de apagar.` }
  refresh()
  redirect('/backoffice/equipa?apagado=1')
}
