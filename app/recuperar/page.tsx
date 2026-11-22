import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { AuthShell } from '@/components/auth-shell'
import { requestReset } from './actions'

export const metadata: Metadata = { title: 'Recuperar acesso' }

export default function Recuperar() {
  return (
    <AuthShell eyebrow="Área reservada" title={<>Recuperar <em>acesso.</em></>}>
      <p className="small muted">Indique o seu e-mail. Enviamos um link para definir uma nova palavra-passe.</p>
      <ActionForm action={requestReset} className="auth__form">
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
        <SubmitButton pendingText="A enviar…">Enviar link</SubmitButton>
      </ActionForm>
      <p className="auth__note"><Link className="link" href="/login">Voltar ao login</Link></p>
    </AuthShell>
  )
}
