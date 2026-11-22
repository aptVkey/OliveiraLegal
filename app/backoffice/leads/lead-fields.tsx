import { LEAD_SOURCES, LEAD_STAGES } from '@/lib/labels'
import { Options } from '@/components/ui'

type Lead = Record<string, any> | null

export function LeadFields({ lead, members, areas }: {
  lead: Lead; members: { id: string; full_name: string }[]; areas: { id: string; name: string; active: boolean }[]
}) {
  const v = (k: string) => lead?.[k] ?? ''
  return (
    <>
      <div className="field"><label htmlFor="name">Nome do contacto *</label><input id="name" name="name" required defaultValue={v('name')} /></div>
      <div className="field"><label htmlFor="company">Empresa</label><input id="company" name="company" defaultValue={v('company')} /></div>
      <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={v('email')} /></div>
      <div className="field"><label htmlFor="phone">Telefone</label><input id="phone" name="phone" type="tel" defaultValue={v('phone')} /></div>
      <div className="field"><label htmlFor="source">Origem</label>
        <select id="source" name="source" defaultValue={v('source') || 'site'}><Options map={LEAD_SOURCES} /></select></div>
      <div className="field"><label htmlFor="stage">Fase</label>
        <select id="stage" name="stage" defaultValue={v('stage') || 'novo'}><Options map={LEAD_STAGES} /></select></div>
      <div className="field"><label htmlFor="area_id">Área de prática</label>
        <select id="area_id" name="area_id" defaultValue={v('area_id')}>
          <option value="">—</option>
          {areas.filter(a => a.active || a.id === v('area_id')).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="owner_id">Responsável</label>
        <select id="owner_id" name="owner_id" defaultValue={v('owner_id')}>
          <option value="">—</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || '—'}</option>)}
        </select></div>
      <div className="field"><label htmlFor="estimated_value">Valor estimado (€)</label>
        <input id="estimated_value" name="estimated_value" inputMode="decimal" defaultValue={v('estimated_value')} /></div>
      <div className="field"><label htmlFor="lost_reason">Motivo, se perdida</label><input id="lost_reason" name="lost_reason" defaultValue={v('lost_reason')} /></div>
      <div className="field full"><label htmlFor="notes">Resumo do contacto</label><textarea id="notes" name="notes" defaultValue={v('notes')} /></div>
    </>
  )
}
