import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from './config'

// Chave secreta: só no servidor (nunca NEXT_PUBLIC_), usada apenas depois de confirmar que quem pede é sócio.
const secret = process.env.SUPABASE_SECRET_KEY ?? ''
export const isAdminConfigured = Boolean(supabaseUrl && secret && !secret.includes('•') && secret.length > 30)

export function createAdminClient() {
  if (!isAdminConfigured) throw new Error('A gestão de utilizadores ainda não está configurada no servidor.')
  return createClient(supabaseUrl, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
