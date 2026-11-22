'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adoptSession, exchangeCode, verifyLink } from './actions'

type Props = { tokenHash?: string; type?: string; code?: string }

export function ConfirmHandler({ tokenHash, type, code }: Props) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>(tokenHash ? 'idle' : 'working')

  useEffect(() => {
    if (tokenHash) return
    const hash = new URLSearchParams(window.location.hash.slice(1))
    // Retira os tokens da barra de endereço e do histórico
    if (window.location.hash) history.replaceState(null, '', window.location.pathname)
    const access = hash.get('access_token'), refresh = hash.get('refresh_token')
    if (access && refresh) { adoptSession(access, refresh); return }
    if (code) { exchangeCode(code); return }
    setState('error')
  }, [tokenHash, code])

  if (state === 'error') return (
    <>
      <p className="alert alert--error" role="alert">Este link expirou ou já foi utilizado.</p>
      <p className="small muted">Peça a um sócio para reenviar o convite, ou use <Link className="link" href="/recuperar">Recuperar palavra-passe</Link>.</p>
    </>
  )
  if (state === 'working') return <p className="small muted" aria-live="polite">A validar o link…</p>
  return (
    <form action={verifyLink} className="auth__form" onSubmit={() => setState('working')}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <p className="small muted">Carregue em continuar para definir a sua palavra-passe.</p>
      <button className="btn" type="submit">Continuar</button>
    </form>
  )
}
