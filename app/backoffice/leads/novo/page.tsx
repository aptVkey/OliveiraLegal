import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { getAreas, getMembers } from '@/lib/queries'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { BackLink, PageHead } from '@/components/ui'
import { createLead } from '../actions'
import { LeadFields } from '../lead-fields'

export const metadata: Metadata = { title: 'Nova lead' }

export default async function NovaLead() {
  const me = await requireMember()
  const [members, areas] = await Promise.all([getMembers(), getAreas()])
  return (
    <>
      <BackLink href="/backoffice/leads">Leads</BackLink>
      <PageHead eyebrow="Crescimento" title={<>Nova <em>lead</em></>} />
      <div className="card">
        <ActionForm action={createLead} className="form">
          <LeadFields lead={{ owner_id: me.id, source: 'site' }} members={members} areas={areas} />
          <div className="form__actions"><SubmitButton>Criar lead</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  )
}
