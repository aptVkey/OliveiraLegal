import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, todayISO } from '@/lib/format'
import { isAdminConfigured } from '@/lib/supabase/admin'
import { isStripeConfigured, isWebhookConfigured, stripeMode } from '@/lib/booking/server'
import { isEmailConfigured } from '@/lib/booking/email'
import { ActionForm } from '@/components/action-form'
import { SubmitButton } from '@/components/submit-button'
import { BackLink, Badge, PageHead } from '@/components/ui'
import { addBlocked, addHours, removeBlocked, removeHours, saveBookingSettings } from '../actions'
import { WEEKDAYS } from '../labels'

export const metadata: Metadata = { title: 'Definições da agenda' }

export default async function DefinicoesAgenda() {
  const me = await requireMember()
  const isSocio = me.role === 'socio'
  const db = await createClient()
  const [{ data: s }, { data: hours }, { data: blocked }] = await Promise.all([
    db.from('booking_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('booking_hours').select('id, weekday, start_time, end_time').order('weekday').order('start_time'),
    db.from('booking_blocked').select('day, reason').gte('day', todayISO()).order('day'),
  ])
  const h = await headers()
  const site = process.env.SITE_URL?.replace(/\/$/, '') || `https://${h.get('x-forwarded-host') ?? h.get('host')}`
  const eur = (c?: number | null) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','))
  const hhmm = (t: string) => t.slice(0, 5)
  const dis = !isSocio

  const checks = [
    { ok: isAdminConfigured, label: 'Chave secreta do Supabase', hint: 'SUPABASE_SECRET_KEY' },
    { ok: isStripeConfigured, label: `Stripe${stripeMode ? ` (modo ${stripeMode})` : ''}`, hint: 'STRIPE_SECRET_KEY' },
    { ok: isWebhookConfigured, label: 'Webhook do Stripe', hint: 'STRIPE_WEBHOOK_SECRET' },
    { ok: isEmailConfigured, label: 'E-mails de confirmação (Resend)', hint: 'RESEND_API_KEY e BOOKING_EMAIL_FROM' },
  ]

  return (
    <>
      <BackLink href="/backoffice/agendamentos">Agendamentos</BackLink>
      <PageHead eyebrow="Agendamentos" title="Definições da agenda"
        desc="Preços, formato, horário e dias sem marcações. As alterações aparecem no site de imediato." />
      <div className="cols">
        <div className="stack">
          <div className="card">
            <h2>Marcação online</h2>
            <ActionForm action={saveBookingSettings} className="form">
              <label className="check full"><input type="checkbox" name="enabled" defaultChecked={!!s?.enabled} disabled={dis} /> Mostrar a secção “Agendar” no site</label>
              <div className="field full"><label htmlFor="title">Título</label><input id="title" name="title" maxLength={120} defaultValue={s?.title ?? ''} disabled={dis} /></div>
              <div className="field full"><label htmlFor="intro">Texto de apresentação</label><textarea id="intro" name="intro" maxLength={600} defaultValue={s?.intro ?? ''} disabled={dis}
                placeholder="Escolha o dia, a hora e o formato que lhe for mais conveniente…" /></div>

              <label className="check"><input type="checkbox" name="presencial_enabled" defaultChecked={!!s?.presencial_enabled} disabled={dis} /> Presencial</label>
              <label className="check"><input type="checkbox" name="online_enabled" defaultChecked={!!s?.online_enabled} disabled={dis} /> Online</label>
              <div className="field"><label htmlFor="price_presencial">Preço presencial (€)</label><input id="price_presencial" name="price_presencial" inputMode="decimal" defaultValue={eur(s?.price_presencial)} disabled={dis} /></div>
              <div className="field"><label htmlFor="price_online">Preço online (€)</label><input id="price_online" name="price_online" inputMode="decimal" defaultValue={eur(s?.price_online)} disabled={dis} /></div>

              <div className="field"><label htmlFor="duration_min">Duração (min)</label><input id="duration_min" name="duration_min" type="number" min={15} max={240} step={5} defaultValue={s?.duration_min ?? 60} disabled={dis} /></div>
              <div className="field"><label htmlFor="step_min">Intervalo entre horários (min)</label><input id="step_min" name="step_min" type="number" min={15} max={240} step={5} defaultValue={s?.step_min ?? 60} disabled={dis} /></div>
              <div className="field"><label htmlFor="min_notice_hours">Antecedência mínima (horas)</label><input id="min_notice_hours" name="min_notice_hours" type="number" min={0} max={720} defaultValue={s?.min_notice_hours ?? 24} disabled={dis} /></div>
              <div className="field"><label htmlFor="max_days_ahead">Marcar até (dias)</label><input id="max_days_ahead" name="max_days_ahead" type="number" min={1} max={180} defaultValue={s?.max_days_ahead ?? 30} disabled={dis} /></div>

              <div className="field full"><label htmlFor="address">Morada (consultas presenciais)</label><input id="address" name="address" maxLength={300} defaultValue={s?.address ?? ''} disabled={dis} placeholder="Rua …, 8200-000 Albufeira" /></div>
              <div className="field full"><label htmlFor="online_instructions">Link / instruções (consultas online)</label><textarea id="online_instructions" name="online_instructions" maxLength={600} defaultValue={s?.online_instructions ?? ''} disabled={dis}
                placeholder="https://meet.google.com/… ou https://teams.microsoft.com/… — vai no e-mail e no convite do calendário (não aparece no site)." /></div>
              <div className="field full"><label htmlFor="notify_email">E-mail do advogado / escritório</label><input id="notify_email" name="notify_email" type="email" defaultValue={s?.notify_email ?? ''} disabled={dis} placeholder="Recebe cada marcação com o convite .ics" /></div>
              {isSocio && <div className="form__actions full"><SubmitButton>Guardar</SubmitButton></div>}
            </ActionForm>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Ligações</h2>
            <ul className="list">
              {checks.map(c => (
                <li className="list__item" key={c.hint}>
                  <span>{c.label}<div className="small muted">{c.hint}</div></span>
                  <Badge tone={c.ok ? 'ok' : 'warn'}>{c.ok ? 'Ligado' : 'Em falta'}</Badge>
                </li>
              ))}
            </ul>
            <p className="small muted" style={{ marginTop: '1rem' }}>
              As chaves ficam apenas no servidor (Vercel → Settings → Environment Variables) e nunca são guardadas aqui.
              No Stripe, crie um webhook para <code>{site}/api/stripe/webhook</code> com os eventos
              {' '}<code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>,
              {' '}<code>checkout.session.async_payment_failed</code> e <code>checkout.session.expired</code>.
            </p>
          </div>

          <div className="card">
            <h2>Horário semanal</h2>
            <p className="small muted" style={{ marginBottom: '.75rem' }}>Hora de Lisboa. Os horários são gerados dentro destes períodos.</p>
            <div className="list">
              {!(hours ?? []).length && <p className="small muted">Sem períodos — o site não mostra horários.</p>}
              {(hours ?? []).map(r => (
                <div className="list__item" key={r.id}>
                  <span>{WEEKDAYS[r.weekday]} · {hhmm(r.start_time)}–{hhmm(r.end_time)}</span>
                  {isSocio && (
                    <form action={removeHours}><input type="hidden" name="id" value={r.id} />
                      <button className="link small" type="submit" style={{ background: 'none', border: 0, cursor: 'pointer' }}>Remover</button></form>
                  )}
                </div>
              ))}
            </div>
            {isSocio && (
              <ActionForm action={addHours} className="inline-form" resetOnSuccess>
                <div className="field" style={{ marginTop: '1rem' }}><label htmlFor="weekday">Dia</label>
                  <select id="weekday" name="weekday" defaultValue="1">{WEEKDAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></div>
                <div className="field"><label htmlFor="start_time">Das</label><input id="start_time" name="start_time" type="time" defaultValue="09:30" /></div>
                <div className="field"><label htmlFor="end_time">Às</label><input id="end_time" name="end_time" type="time" defaultValue="12:30" /></div>
                <SubmitButton className="btn btn--sm">Adicionar</SubmitButton>
              </ActionForm>
            )}
          </div>

          <div className="card">
            <h2>Dias sem marcações</h2>
            <div className="list">
              {!(blocked ?? []).length && <p className="small muted">Nenhum dia bloqueado.</p>}
              {(blocked ?? []).map(b => (
                <div className="list__item" key={b.day}>
                  <span>{fmtDate(b.day)}{b.reason ? <span className="muted"> · {b.reason}</span> : null}</span>
                  {isSocio && (
                    <form action={removeBlocked}><input type="hidden" name="day" value={b.day} />
                      <button className="link small" type="submit" style={{ background: 'none', border: 0, cursor: 'pointer' }}>Remover</button></form>
                  )}
                </div>
              ))}
            </div>
            {isSocio && (
              <ActionForm action={addBlocked} className="inline-form" resetOnSuccess>
                <div className="field" style={{ marginTop: '1rem' }}><label htmlFor="day">De</label><input id="day" name="day" type="date" min={todayISO()} required /></div>
                <div className="field"><label htmlFor="until">Até (opcional)</label><input id="until" name="until" type="date" min={todayISO()} /></div>
                <div className="field field--grow"><label htmlFor="reason">Motivo</label><input id="reason" name="reason" maxLength={120} placeholder="Férias, feriado…" /></div>
                <SubmitButton className="btn btn--sm">Bloquear</SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
