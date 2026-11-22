import { BILLING, CASE_STATUS } from '@/lib/labels'
import { Options } from '@/components/ui'

export function CaseFields({ value, clients, members, areas }: {
  value: Record<string, any> | null
  clients: { id: string; name: string }[]
  members: { id: string; full_name: string }[]
  areas: { id: string; name: string; active: boolean }[]
}) {
  const v = (k: string) => value?.[k] ?? ''
  return (
    <>
      <div className="field full"><label htmlFor="title">Assunto *</label><input id="title" name="title" required defaultValue={v('title')} /></div>
      <div className="field"><label htmlFor="client_id">Cliente *</label>
        <select id="client_id" name="client_id" required defaultValue={v('client_id')}>
          <option value="">Escolher…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="area_id">Área de prática</label>
        <select id="area_id" name="area_id" defaultValue={v('area_id')}>
          <option value="">—</option>
          {areas.filter(a => a.active || a.id === v('area_id')).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="opposing_party">Parte contrária</label><input id="opposing_party" name="opposing_party" defaultValue={v('opposing_party')} /></div>
      <div className="field"><label htmlFor="responsible_id">Responsável</label>
        <select id="responsible_id" name="responsible_id" defaultValue={v('responsible_id')}>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || '—'}</option>)}
        </select></div>
      <div className="field"><label htmlFor="status">Estado</label>
        <select id="status" name="status" defaultValue={v('status') || 'aberto'}><Options map={CASE_STATUS} /></select></div>
      <div className="field"><label htmlFor="billing_type">Honorários</label>
        <select id="billing_type" name="billing_type" defaultValue={v('billing_type') || 'hora'}><Options map={BILLING} /></select></div>
      <div className="field"><label htmlFor="fixed_fee">Valor fixo ou avença (€)</label><input id="fixed_fee" name="fixed_fee" inputMode="decimal" defaultValue={v('fixed_fee')} /></div>
      <div className="field"><label htmlFor="opened_at">Data de abertura</label><input id="opened_at" name="opened_at" type="date" defaultValue={v('opened_at')} /></div>
      <div className="field full"><label htmlFor="description">Descrição</label><textarea id="description" name="description" defaultValue={v('description')} /></div>
    </>
  )
}
