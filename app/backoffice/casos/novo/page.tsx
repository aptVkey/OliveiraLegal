import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { getAreas, getClientsLite, getMembers } from '@/lib/queries'
import { todayISO } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { BackLink, Empty, PageHead } from '@/components/ui'
import { createCase } from '../actions'
import { CaseFields } from '../case-fields'

export const metadata: Metadata = { title: 'Novo caso' }

export default async function NovoCaso({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const me = await requireMember()
  const { cliente } = await searchParams
  if (!['socio', 'advogado', 'associado'].includes(me.role)) {
    return <Empty title="Sem permissão">Só sócios, advogados e associados podem abrir casos.</Empty>
  }
  const [clients, members, areas] = await Promise.all([getClientsLite(), getMembers(), getAreas()])
  return (
    <>
      <BackLink href="/backoffice/casos">Casos</BackLink>
      <PageHead eyebrow="Escritório" title={<>Novo <em>caso</em></>} desc="A referência é atribuída automaticamente." />
      <div className="card">
        <ActionForm action={createCase} className="form">
          <CaseFields value={{ client_id: cliente ?? '', responsible_id: me.id, opened_at: todayISO() }} clients={clients} members={members} areas={areas} />
          <div className="form__actions"><SubmitButton>Abrir caso</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  )
}
