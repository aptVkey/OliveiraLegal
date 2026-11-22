import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { ROLES, type Role } from '@/lib/roles'
import { fmtDateTime } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, BackLink, Empty, PageHead } from '@/components/ui'
import { deleteMember, resendInvite, sendPasswordReset, updateMember } from '../actions'
import { MemberFields } from '../member-fields'

export const metadata: Metadata = { title: 'Editar utilizador' }

export default async function EditarUtilizador({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }>
}) {
  const me = await requireMember()
  if (me.role !== 'socio') return <Empty title="Sem acesso">Só um sócio pode gerir utilizadores.</Empty>
  const { id } = await params
  const { criado } = await searchParams
  const db = await createClient()
  const [{ data: m }, { count: entries }] = await Promise.all([
    db.from('profiles').select('id, full_name, role, hourly_rate, cost_rate, active, created_at').eq('id', id).maybeSingle(),
    db.from('time_entries').select('id', { count: 'exact', head: true }).eq('member_id', id),
  ])
  if (!m) notFound()
  const { data: rate } = await db.from('role_rates').select('hourly_rate').eq('role', m.role).maybeSingle()
  const u = isAdminConfigured ? (await createAdminClient().auth.admin.getUserById(id)).data.user : null
  const pending = !!u && !u.last_sign_in_at
  const self = m.id === me.id

  return (
    <>
      <BackLink href="/backoffice/equipa">Equipa</BackLink>
      <PageHead eyebrow={`Utilizador · ${ROLES[m.role as Role]}`} title={m.full_name || 'Sem nome'}
        desc={<>{u?.email ?? '—'} · {!m.active ? <Badge tone="off">Inativo</Badge> : pending ? <Badge tone="warn">Convite pendente</Badge> : <Badge tone="ok">Ativo</Badge>}</>} />

      {criado === 'invite' && <p className="alert alert--info" style={{ marginBottom: '1rem' }}>Utilizador criado e convite enviado para {u?.email}.</p>}
      {criado === 'password' && <p className="alert alert--info" style={{ marginBottom: '1rem' }}>Utilizador criado. Vai ter de trocar a palavra-passe inicial no primeiro acesso.</p>}

      <div className="cols">
        <div className="card">
          <h2>Dados e permissões</h2>
          <ActionForm action={updateMember} className="form">
            <input type="hidden" name="id" value={m.id} />
            <MemberFields value={{ ...m, email: u?.email ?? '' }} roleRate={rate?.hourly_rate != null ? Number(rate.hourly_rate) : undefined} />
            <label className="check full"><input type="checkbox" name="active" defaultChecked={m.active} disabled={self} />
              Acesso ativo ao backoffice {self && <span className="small muted">(não pode desativar a sua própria conta)</span>}</label>
            {self && <input type="hidden" name="active" value="on" />}
            <div className="form__actions"><SubmitButton>Guardar alterações</SubmitButton></div>
          </ActionForm>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Acesso</h2>
            <dl className="dl" style={{ marginBottom: '1rem' }}>
              <dt>Último acesso</dt><dd>{u?.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : 'Nunca'}</dd>
              <dt>Criado em</dt><dd>{fmtDateTime(m.created_at)}</dd>
              <dt>Tempo registado</dt><dd>{entries ?? 0} registos</dd>
            </dl>
            <div className="stack" style={{ gap: '.6rem' }}>
              {pending ? (
                <ActionForm action={resendInvite}><input type="hidden" name="id" value={m.id} />
                  <SubmitButton className="btn btn--ghost btn--sm" pendingText="A enviar…">Reenviar convite</SubmitButton></ActionForm>
              ) : (
                <ActionForm action={sendPasswordReset}><input type="hidden" name="id" value={m.id} />
                  <SubmitButton className="btn btn--ghost btn--sm" pendingText="A enviar…">Enviar link para nova palavra-passe</SubmitButton></ActionForm>
              )}
            </div>
          </div>

          {!self && (
            <div className="card card--danger">
              <h2>Apagar utilizador</h2>
              {(entries ?? 0) > 0 ? (
                <p className="small muted">Tem tempo registado, por isso não pode ser apagado. Desative o acesso para manter o histórico.</p>
              ) : (
                <>
                  <p className="small muted" style={{ marginBottom: '1rem' }}>Remove a conta de forma permanente. As tarefas e casos atribuídos ficam sem responsável.</p>
                  <ActionForm action={deleteMember}><input type="hidden" name="id" value={m.id} />
                    <SubmitButton className="btn btn--danger btn--sm" pendingText="A apagar…" confirm={`Apagar ${m.full_name || 'este utilizador'} de forma permanente?`}>Apagar utilizador</SubmitButton></ActionForm>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
