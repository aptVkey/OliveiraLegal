import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { ROLES, type Role } from '@/lib/roles'
import { eur, fmtDateTime } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, PageHead } from '@/components/ui'
import { deleteMember } from './actions'

export const metadata: Metadata = { title: 'Equipa' }

export default async function Equipa({ searchParams }: { searchParams: Promise<{ apagado?: string }> }) {
  const me = await requireMember()
  const { apagado } = await searchParams
  const isSocio = me.role === 'socio'
  const db = await createClient()
  const [{ data: members }, { data: rates }] = await Promise.all([
    db.from('profiles').select('id, full_name, role, hourly_rate, active').order('active', { ascending: false }).order('full_name'),
    db.from('role_rates').select('role, hourly_rate'),
  ])
  const roleRate = new Map((rates ?? []).map(r => [r.role as Role, Number(r.hourly_rate)]))

  // E-mails e últimos acessos: só para sócios, lidos no servidor
  const auth = new Map<string, { email?: string; last?: string | null }>()
  if (isSocio && isAdminConfigured) {
    const { data } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 500 })
    for (const u of data?.users ?? []) auth.set(u.id, { email: u.email, last: u.last_sign_in_at })
  }

  return (
    <>
      <PageHead eyebrow="Administração" title="Equipa"
        desc={isSocio ? 'Utilizadores do backoffice, papéis, taxas e acessos.' : 'Membros do escritório e respetivos papéis.'}
        actions={isSocio ? <Link className="btn btn--sm" href="/backoffice/equipa/novo">Novo utilizador</Link> : undefined} />

      {apagado && <p className="alert alert--info" role="status" style={{ marginBottom: '1rem' }}>Utilizador apagado.</p>}
      {isSocio && !isAdminConfigured && (
        <p className="alert alert--info" style={{ marginBottom: '1rem' }}>
          Para criar e gerir utilizadores, adicione <code>SUPABASE_SECRET_KEY</code> ao servidor e reinicie-o.
        </p>
      )}

      <div className="card table-wrap">
        <table className="table">
          <thead><tr>
            <th>Nome</th>{isSocio && <th>E-mail</th>}<th>Papel</th><th className="num">Taxa/hora</th>
            {isSocio && <th>Último acesso</th>}<th>Estado</th>{isSocio && <th className="num">Ações</th>}
          </tr></thead>
          <tbody>
            {(members ?? []).map(m => {
              const a = auth.get(m.id)
              const pending = !!a && !a.last
              return (
                <tr key={m.id}>
                  <td>{isSocio ? <Link className="row-link" href={`/backoffice/equipa/${m.id}`}>{m.full_name || '—'}</Link> : m.full_name || '—'}
                    {m.id === me.id && <span className="small muted"> (eu)</span>}</td>
                  {isSocio && <td className="small">{a?.email ?? '—'}</td>}
                  <td>{ROLES[m.role as Role]}</td>
                  <td className="num">{eur(m.hourly_rate ?? roleRate.get(m.role as Role))}{m.hourly_rate == null && <div className="small muted">taxa do papel</div>}</td>
                  {isSocio && <td className="small">{a?.last ? fmtDateTime(a.last) : '—'}</td>}
                  <td>{!m.active ? <Badge tone="off">Inativo</Badge> : pending ? <Badge tone="warn">Convite pendente</Badge> : <Badge tone="ok">Ativo</Badge>}</td>
                  {isSocio && (
                    <td className="num">
                      <div className="row-actions">
                        <Link className="btn btn--ghost btn--sm" href={`/backoffice/equipa/${m.id}`}>Editar</Link>
                        {m.id !== me.id && (
                          <ActionForm action={deleteMember}>
                            <input type="hidden" name="id" value={m.id} />
                            <SubmitButton className="btn btn--danger btn--sm" pendingText="…" confirm={`Apagar ${m.full_name || 'este utilizador'}? Esta ação não pode ser desfeita.`}>Apagar</SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {isSocio && <p className="small muted" style={{ marginTop: '1rem' }}>Quem já registou tempo não pode ser apagado, para manter o histórico: desative o acesso na página do membro.</p>}
    </>
  )
}
