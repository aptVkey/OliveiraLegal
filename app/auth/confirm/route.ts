import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Destino dos links de convite e de recuperação (modelos de e-mail com token_hash)
const ALLOWED: EmailOtpType[] = ['invite', 'recovery']

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const token_hash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null

  if (token_hash && type && ALLOWED.includes(type)) {
    const db = await createClient()
    const { error } = await db.auth.verifyOtp({ type, token_hash })
    if (!error) redirect('/definir-palavra-passe')
  }
  redirect('/login?erro=link')
}
