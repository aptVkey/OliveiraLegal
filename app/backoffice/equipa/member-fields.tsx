import { ROLES } from '@/lib/roles'
import { eur } from '@/lib/format'
import { Options } from '@/components/ui'

export function MemberFields({ value, roleRate }: { value: Record<string, any> | null; roleRate?: number }) {
  const v = (k: string) => value?.[k] ?? ''
  return (
    <>
      <div className="field"><label htmlFor="full_name">Nome *</label><input id="full_name" name="full_name" required defaultValue={v('full_name')} /></div>
      <div className="field"><label htmlFor="email">E-mail *</label><input id="email" name="email" type="email" required defaultValue={v('email')} /></div>
      <div className="field"><label htmlFor="role">Papel</label>
        <select id="role" name="role" defaultValue={v('role') || 'assistente'}><Options map={ROLES} /></select></div>
      <div className="field"><label htmlFor="hourly_rate">Taxa horária própria (€/h)</label>
        <input id="hourly_rate" name="hourly_rate" inputMode="decimal" defaultValue={v('hourly_rate')}
          placeholder={roleRate != null ? `Vazio = taxa do papel (${eur(roleRate)})` : 'Vazio = taxa do papel'} /></div>
      <div className="field"><label htmlFor="cost_rate">Custo interno (€/h)</label>
        <input id="cost_rate" name="cost_rate" inputMode="decimal" defaultValue={v('cost_rate')} /></div>
    </>
  )
}
