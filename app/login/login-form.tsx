'use client'

import { useActionState } from 'react'
import { signIn, type LoginState } from './actions'

export function LoginForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {})

  return (
    <form className="auth__form" action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required disabled={disabled} />
      </div>
      <div className="field">
        <label htmlFor="password">Palavra-passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={disabled} />
      </div>
      {state.error && <p className="alert alert--error" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending || disabled}>
        {pending ? 'A entrar…' : 'Entrar'}
      </button>
    </form>
  )
}
