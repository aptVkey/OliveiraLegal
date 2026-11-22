import type { Metadata } from 'next'
import Link from 'next/link'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { AuthShell } from '@/components/auth-shell'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar' }

const ERRORS: Record<string, string> = {
  acesso: 'A sua conta não tem acesso ativo ao backoffice. Contacte um sócio.',
  link: 'O link expirou ou já foi usado. Peça um novo.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string; ok?: string }> }) {
  const { next = '/backoffice', erro, ok } = await searchParams
  return (
    <AuthShell eyebrow="Área reservada" title={<>Bem-vindo <em>de volta.</em></>}>
      {!isSupabaseConfigured && (
        <p className="alert alert--info">
          O acesso ainda não está ligado à base de dados. Preencha <code>.env.local</code> com as chaves do Supabase (ver <code>.env.example</code>).
        </p>
      )}
      {erro && ERRORS[erro] && <p className="alert alert--error" role="alert">{ERRORS[erro]}</p>}
      {ok === 'palavra-passe' && <p className="alert alert--info" role="status">Palavra-passe definida. Já pode entrar.</p>}
      <LoginForm next={next} disabled={!isSupabaseConfigured} />
      <p className="auth__note"><Link className="link" href="/recuperar">Esqueci-me da palavra-passe</Link></p>
      <p className="auth__note">Acesso exclusivo à equipa.</p>
    </AuthShell>
  )
}
