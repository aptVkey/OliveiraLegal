'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export type LoginState = { error?: string }

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : ''
  return next === '/backoffice' || next.startsWith('/backoffice/') ? next : '/backoffice'
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured) return { error: 'O acesso ainda não está configurado.' }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Preencha o e-mail e a palavra-passe.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  // Mensagem genérica: não revela se o e-mail existe
  if (error) return { error: 'E-mail ou palavra-passe incorretos.' }

  redirect(safeNext(formData.get('next')))
}
