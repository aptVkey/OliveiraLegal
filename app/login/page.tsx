import type { Metadata } from 'next'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/backoffice' } = await searchParams

  return (
    <main className="auth">
      <section className="auth__art" aria-hidden="true">
        <p className="auth__quote">Rigor, clareza e proximidade.</p>
        <div className="auth__arch" />
        <img className="auth__mono" src="/assets/brand/novos-logos/monograma-marfim.svg" alt="" />
        <a className="auth__back" href="/" tabIndex={-1}>← Voltar ao site</a>
      </section>

      <section className="auth__panel">
        <div className="auth__form">
          <p className="eyebrow">Área reservada</p>
          <h1 className="auth__title">Bem-vindo <em>de volta.</em></h1>
          {!isSupabaseConfigured && (
            <p className="alert alert--info">
              O acesso ainda não está ligado à base de dados. Preencha <code>.env.local</code> com as chaves do Supabase
              (ver <code>.env.example</code>).
            </p>
          )}
          <LoginForm next={next} disabled={!isSupabaseConfigured} />
          <p className="auth__note">Acesso exclusivo à equipa. Para recuperar o acesso, contacte um sócio.</p>
        </div>
      </section>
    </main>
  )
}
