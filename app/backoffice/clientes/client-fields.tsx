import { CLIENT_KIND } from '@/lib/labels'
import { Options } from '@/components/ui'

export function ClientFields({ client }: { client: Record<string, any> | null }) {
  const v = (k: string) => client?.[k] ?? ''
  return (
    <>
      <div className="field"><label htmlFor="kind">Tipo</label>
        <select id="kind" name="kind" defaultValue={v('kind') || 'particular'}><Options map={CLIENT_KIND} /></select></div>
      <div className="field"><label htmlFor="name">Nome ou denominação *</label><input id="name" name="name" required defaultValue={v('name')} /></div>
      <div className="field"><label htmlFor="nif">NIF</label><input id="nif" name="nif" inputMode="numeric" defaultValue={v('nif')} /></div>
      <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={v('email')} /></div>
      <div className="field"><label htmlFor="phone">Telefone</label><input id="phone" name="phone" type="tel" defaultValue={v('phone')} /></div>
      <div className="field"><label htmlFor="address">Morada</label><input id="address" name="address" defaultValue={v('address')} /></div>
      <div className="field full"><label htmlFor="notes">Notas</label><textarea id="notes" name="notes" defaultValue={v('notes')} /></div>
      <label className="check full"><input type="checkbox" name="rgpd_consent" defaultChecked={!!client?.rgpd_consent} />
        O cliente autorizou o tratamento dos seus dados (RGPD)</label>
    </>
  )
}
