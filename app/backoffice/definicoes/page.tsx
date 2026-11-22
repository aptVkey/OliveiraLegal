import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CAN, ROLES, type Role } from '@/lib/roles'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { Badge, PageHead } from '@/components/ui'
import { addArea, saveIncrement, saveRoleRates, toggleArea } from './actions'

export const metadata: Metadata = { title: 'Definições' }

export default async function Definicoes() {
  const me = await requireMember()
  const db = await createClient()
  const [{ data: rates }, { data: areas }, { data: settings }] = await Promise.all([
    db.from('role_rates').select('role, hourly_rate'),
    db.from('practice_areas').select('id, name, active').order('name'),
    db.from('office_settings').select('time_increment').eq('id', 1).maybeSingle(),
  ])
  const rateOf = new Map((rates ?? []).map(r => [r.role as Role, r.hourly_rate]))
  const canRates = CAN.manageRates(me.role)
  const isSocio = me.role === 'socio'

  return (
    <>
      <PageHead eyebrow="Administração" title="Definições" desc="Taxas por papel, áreas de prática e registo de tempo." />
      <div className="cols">
        <div className="stack">
          <div className="card">
            <h2>Taxa horária por papel</h2>
            <p className="small muted" style={{ marginBottom: '1rem' }}>Usada quando o membro não tem taxa própria. Cada registo de tempo guarda a taxa em vigor no momento.</p>
            <ActionForm action={saveRoleRates} className="form">
              {Object.entries(ROLES).map(([k, v]) => (
                <div className="field" key={k}><label htmlFor={`rate_${k}`}>{v} (€/h)</label>
                  <input id={`rate_${k}`} name={`rate_${k}`} inputMode="decimal" defaultValue={rateOf.get(k as Role) ?? 0} disabled={!canRates} /></div>
              ))}
              {canRates && <div className="form__actions"><SubmitButton>Guardar taxas</SubmitButton></div>}
            </ActionForm>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Registo de tempo</h2>
            <ActionForm action={saveIncrement} className="inline-form">
              <div className="field"><label htmlFor="time_increment">Arredondamento (minutos)</label>
                <input id="time_increment" name="time_increment" inputMode="numeric" defaultValue={settings?.time_increment ?? 6} disabled={!isSocio} /></div>
              {isSocio && <SubmitButton className="btn btn--sm">Guardar</SubmitButton>}
            </ActionForm>
            <p className="small muted" style={{ marginTop: '.75rem' }}>Cada registo é arredondado para cima a este intervalo (6 min = 0,1 h).</p>
          </div>
          <div className="card">
            <h2>Áreas de prática</h2>
            <div className="list">
              {(areas ?? []).map(a => (
                <div className="list__item" key={a.id}>
                  <span>{a.name} {!a.active && <Badge tone="off">Inativa</Badge>}</span>
                  {isSocio && (
                    <form action={toggleArea}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="active" value={a.active ? 'false' : 'true'} />
                      <button className="link small" type="submit" style={{ background: 'none', border: 0, cursor: 'pointer' }}>{a.active ? 'Desativar' : 'Ativar'}</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {isSocio && (
              <ActionForm action={addArea} className="inline-form" resetOnSuccess>
                <div className="field field--grow" style={{ marginTop: '1rem' }}><label htmlFor="area-name">Nova área</label><input id="area-name" name="name" /></div>
                <SubmitButton className="btn btn--sm">Adicionar</SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
