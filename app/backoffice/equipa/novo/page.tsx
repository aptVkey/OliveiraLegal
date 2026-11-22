import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { isAdminConfigured } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { BackLink, Empty, PageHead } from '@/components/ui'
import { createMember } from '../actions'
import { MemberFields } from '../member-fields'

export const metadata: Metadata = { title: 'Novo utilizador' }

export default async function NovoUtilizador() {
  const me = await requireMember()
  if (me.role !== 'socio') return <Empty title="Sem acesso">Só um sócio pode criar utilizadores.</Empty>
  return (
    <>
      <BackLink href="/backoffice/equipa">Equipa</BackLink>
      <PageHead eyebrow="Administração" title={<>Novo <em>utilizador</em></>} />
      {!isAdminConfigured ? (
        <p className="alert alert--info">Adicione <code>SUPABASE_SECRET_KEY</code> ao servidor para criar utilizadores.</p>
      ) : (
        <div className="card">
          <ActionForm action={createMember} className="form member-form">
            <MemberFields value={null} />
            <fieldset className="full mode">
              <legend className="eyebrow">Acesso</legend>
              <label className="check"><input type="radio" name="mode" value="invite" defaultChecked />
                <span><strong>Enviar convite por e-mail</strong> <span className="small muted">— recomendado: o membro define a sua palavra-passe.</span></span></label>
              <label className="check"><input type="radio" name="mode" value="password" />
                <span><strong>Definir palavra-passe inicial</strong> <span className="small muted">— o membro tem de a trocar no primeiro acesso.</span></span></label>
            </fieldset>
            <div className="field pw-field"><label htmlFor="password">Palavra-passe inicial</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} />
              <span className="small muted">Mínimo 10 caracteres, com letras e números. Entregue-a ao membro por um canal seguro.</span></div>
            <div className="form__actions"><SubmitButton pendingText="A criar…">Criar utilizador</SubmitButton></div>
          </ActionForm>
        </div>
      )}
    </>
  )
}
