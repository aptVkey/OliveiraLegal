'use server'

import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config'
import { authRedirect } from '@/lib/site'
import type { FormState } from '@/lib/forms'

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Indique um e-mail válido.' }
  if (isSupabaseConfigured) {
    // Link sem PKCE: funciona mesmo que o e-mail seja aberto noutro dispositivo
    const db = createClient(supabaseUrl, supabaseAnonKey, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false } })
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: await authRedirect() })
    if (error?.status === 429) return { error: 'Demasiados pedidos. Tente daqui a alguns minutos.' }
  }
  // Resposta igual quer o e-mail exista ou não
  return { ok: true, message: 'Se este e-mail tiver acesso, vai receber um link para definir uma nova palavra-passe.' }
}
