import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth-shell'
import { ConfirmHandler } from './handler'

export const metadata: Metadata = { title: 'Confirmar acesso' }

// Destino dos links de convite e de recuperação de palavra-passe
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; code?: string }> }) {
  const { token_hash, type, code } = await searchParams
  const title = type === 'recovery' ? <>Nova <em>palavra-passe.</em></> : <>Bem-vindo à <em>equipa.</em></>
  return (
    <AuthShell eyebrow="Área reservada" title={title}>
      <ConfirmHandler tokenHash={token_hash} type={type} code={code} />
    </AuthShell>
  )
}
