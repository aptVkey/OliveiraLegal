'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { FormState } from '@/lib/forms'

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Indique um e-mail válido.' }
  if (isSupabaseConfigured) {
    const db = await createClient()
    const { error } = await db.auth.resetPasswordForEmail(email)
    if (error?.status === 429) return { error: 'Demasiados pedidos. Tente daqui a alguns minutos.' }
  }
  // Resposta igual quer o e-mail exista ou não
  return { ok: true, message: 'Se este e-mail tiver acesso, vai receber um link para definir uma nova palavra-passe.' }
}
