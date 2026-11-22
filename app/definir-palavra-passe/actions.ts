'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { passwordProblem } from '@/lib/password'
import type { FormState } from '@/lib/forms'

export async function setPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get('password') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  const pb = passwordProblem(password); if (pb) return { error: pb }
  if (password !== confirm) return { error: 'As palavras-passe não coincidem.' }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'O link expirou. Peça um novo convite ou recuperação.' }
  const { error } = await db.auth.updateUser({ password })
  if (error) {
    if (error.code === 'same_password') return { error: 'Escolha uma palavra-passe diferente da anterior.' }
    if (error.code === 'weak_password') return { error: 'Palavra-passe demasiado fraca. Escolha outra.' }
    return { error: 'Não foi possível guardar. Tente novamente.' }
  }
  // Palavra-passe inicial trocada: retira a obrigação (só o servidor pode alterar app_metadata)
  if (user.app_metadata?.must_change_password && isAdminConfigured) {
    await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { must_change_password: false } })
    await db.auth.refreshSession()
  }
  redirect('/backoffice')
}
