import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ROLES, type Role } from '@/lib/roles'

export const metadata: Metadata = { title: 'Equipa' }

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export default async function Equipa() {
  await requireMember()
  const supabase = await createClient()
  const [{ data: members }, { data: rates }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, hourly_rate, active').order('full_name'),
    supabase.from('role_rates').select('role, hourly_rate'),
  ])
  const roleRate = new Map((rates ?? []).map(r => [r.role as Role, Number(r.hourly_rate)]))

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Equipa</h1>
          <p>Membros, papéis e taxa horária aplicada a cada um.</p>
        </div>
      </header>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Nome</th><th>Papel</th><th>Taxa/hora</th><th>Estado</th></tr></thead>
          <tbody>
            {(members ?? []).map(m => {
              const rate = m.hourly_rate ?? roleRate.get(m.role as Role)
              return (
                <tr key={m.id}>
                  <td>{m.full_name || '—'}</td>
                  <td>{ROLES[m.role as Role]}</td>
                  <td>{rate != null ? eur.format(Number(rate)) : '—'}{m.hourly_rate == null && rate != null ? <span className="stat__hint"> · do papel</span> : null}</td>
                  <td><span className={`badge${m.active ? '' : ' badge--off'}`}>{m.active ? 'Ativo' : 'Inativo'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
