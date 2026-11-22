import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { BackLink, PageHead } from '@/components/ui'
import { createClientRecord } from '../actions'
import { ClientFields } from '../client-fields'

export const metadata: Metadata = { title: 'Novo cliente' }

export default async function NovoCliente() {
  await requireMember()
  return (
    <>
      <BackLink href="/backoffice/clientes">Clientes</BackLink>
      <PageHead eyebrow="Escritório" title={<>Novo <em>cliente</em></>} desc="Verifique conflitos de interesses antes de abrir um processo." />
      <div className="card">
        <ActionForm action={createClientRecord} className="form">
          <ClientFields client={null} />
          <div className="form__actions"><SubmitButton>Criar cliente</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  )
}
