import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { AuthShell } from '@/components/auth-shell'
import { setPassword } from './actions'

export const metadata: Metadata = { title: 'Definir palavra-passe' }

export default async function DefinirPalavraPasse() {
  if (!isSupabaseConfigured) redirect('/login')
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login?erro=link')

  return (
    <AuthShell eyebrow="Área reservada" title={<>Defina a sua <em>palavra-passe.</em></>}>
      <p className="small muted">Conta: {user.email}</p>
      {user.app_metadata?.must_change_password && <p className="alert alert--info">Por segurança, troque a palavra-passe inicial antes de continuar.</p>}
      <ActionForm action={setPassword} className="auth__form">
        <div className="field"><label htmlFor="password">Nova palavra-passe</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
        <div className="field"><label htmlFor="confirm">Repetir palavra-passe</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></div>
        <p className="small muted">Mínimo de 10 caracteres, com letras e números.</p>
        <SubmitButton pendingText="A guardar…">Guardar e entrar</SubmitButton>
      </ActionForm>
    </AuthShell>
  )
}
