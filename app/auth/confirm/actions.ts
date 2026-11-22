'use server'

import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ALLOWED: EmailOtpType[] = ['invite', 'recovery']
const NEXT = '/definir-palavra-passe'
const FAIL = '/login?erro=link'

// Modelo de e-mail com token_hash: só é validado quando a pessoa carrega no botão
// (os antivírus de e-mail que abrem links automaticamente não gastam o convite)
export async function verifyLink(fd: FormData) {
  const token_hash = String(fd.get('token_hash') ?? '')
  const type = String(fd.get('type') ?? '') as EmailOtpType
  if (!token_hash || !ALLOWED.includes(type)) redirect(FAIL)
  const db = await createClient()
  const { error } = await db.auth.verifyOtp({ type, token_hash })
  redirect(error ? FAIL : NEXT)
}

// Modelo de e-mail por defeito do Supabase (link com ?code=, pedido feito neste browser)
export async function exchangeCode(code: string) {
  const db = await createClient()
  const { error } = await db.auth.exchangeCodeForSession(code)
  redirect(error ? FAIL : NEXT)
}

// Modelo de e-mail por defeito do Supabase (sessão no #fragmento do link).
// O Supabase valida o token antes de aceitar a sessão; a sessão fica em cookies httpOnly.
export async function adoptSession(access_token: string, refresh_token: string) {
  if (!access_token || !refresh_token) redirect(FAIL)
  const db = await createClient()
  const { error } = await db.auth.setSession({ access_token, refresh_token })
  redirect(error ? FAIL : NEXT)
}
