import 'server-only'
import { buildIcs, googleLink, outlookLink, type CalEvent } from './calendar'
import { MODE_LABEL, hour, longDate, money } from './format'

// Envio por Resend (https://resend.com) — chave só no servidor
const resendKey = process.env.RESEND_API_KEY ?? ''
const from = process.env.BOOKING_EMAIL_FROM ?? ''
export const isEmailConfigured = resendKey.startsWith('re_') && from.includes('@')

export type EmailContext = {
  id: string; reference: string; name: string; email: string; phone: string | null
  mode: 'presencial' | 'online'; status: 'pago' | 'conflito'; topic: string | null; area: string | null
  startsAt: string; endsAt: string; amountCents: number; currency: string
  address: string | null; onlineInstructions: string | null; notifyEmail: string | null
}

const h = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const nl = (s: string | null | undefined) => h(s).replace(/\r?\n/g, '<br>')
const fromEmail = () => from.match(/<([^>]+)>/)?.[1] ?? from

function shell(title: string, body: string, footer: string) {
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(title)}</title></head>
<body style="margin:0;background:#F3EFE5;color:#3f4530;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EFE5"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3ddd0">
<tr><td style="background:#626A43;color:#F3EFE5;padding:28px 32px">
<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.8">Oliveira Legal</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;margin-top:10px">${h(title)}</div>
</td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.65">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #eee8dc;font-size:12px;line-height:1.6;color:#7a7f66">${footer}</td></tr>
</table></td></tr></table></body></html>`
}

const row = (k: string, v: string) =>
  `<tr><td style="padding:8px 0;color:#7a7f66;font-size:12px;letter-spacing:.08em;text-transform:uppercase;width:38%;vertical-align:top">${k}</td><td style="padding:8px 0;vertical-align:top">${v}</td></tr>`
const button = (href: string, label: string) =>
  `<a href="${h(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border:1px solid #626A43;border-radius:999px;color:#626A43;text-decoration:none;font-size:13px">${label}</a>`

async function send(payload: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    console.error('[email]', res.status, await res.text().catch(() => ''))
    return false
  }
  return true
}

// E-mails de confirmação (cliente + escritório), cada um com o convite .ics anexado
export async function sendBookingEmails(c: EmailContext): Promise<{ client: boolean; office: boolean }> {
  if (!isEmailConfigured) return { client: false, office: false }
  const start = new Date(c.startsAt), end = new Date(c.endsAt)
  const when = `${longDate(start)}, ${hour(start)}–${hour(end)}`
  const where = c.mode === 'presencial' ? (c.address || 'Escritório Oliveira Legal, Albufeira') : 'Reunião online'
  const online = c.mode === 'online' ? (c.onlineInstructions || 'Enviaremos o link da reunião antes da hora marcada.') : ''
  const office = c.notifyEmail || fromEmail()
  const conflict = c.status === 'conflito'

  const clientEvent: CalEvent = {
    uid: `${c.id}@oliveiralegal`, start, end, method: 'REQUEST',
    title: `Consulta jurídica · Oliveira Legal (${MODE_LABEL[c.mode]})`,
    description: [`Referência: ${c.reference}`, c.area && `Área: ${c.area}`, online && `Acesso: ${online}`,
      c.mode === 'presencial' && `Morada: ${where}`].filter(Boolean).join('\n'),
    location: c.mode === 'presencial' ? where : (online.match(/https?:\/\/\S+/)?.[0] ?? 'Online'),
    organizerEmail: office, attendee: { name: c.name, email: c.email },
  }
  const officeEvent: CalEvent = {
    ...clientEvent, method: 'PUBLISH', attendee: null, organizerEmail: null,
    title: `Consulta · ${c.name} (${MODE_LABEL[c.mode]})`,
    description: [`Referência: ${c.reference}`, `Cliente: ${c.name}`, `E-mail: ${c.email}`, c.phone && `Telefone: ${c.phone}`,
      c.area && `Área: ${c.area}`, c.topic && `Assunto: ${c.topic}`, `Pago: ${money(c.amountCents, c.currency)}`].filter(Boolean).join('\n'),
  }
  const ics = (e: CalEvent) => Buffer.from(buildIcs(e), 'utf8').toString('base64')
  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 22px;border-top:1px solid #eee8dc;border-bottom:1px solid #eee8dc">
    ${row('Quando', h(when))}
    ${row('Formato', h(MODE_LABEL[c.mode]))}
    ${row(c.mode === 'presencial' ? 'Local' : 'Acesso', nl(c.mode === 'presencial' ? where : online))}
    ${c.area ? row('Área', h(c.area)) : ''}
    ${row('Valor pago', h(money(c.amountCents, c.currency)))}
    ${row('Referência', h(c.reference))}
  </table>`

  const clientHtml = shell(conflict ? 'Pagamento recebido' : 'Consulta confirmada',
    `<p style="margin:0 0 12px">Olá ${h(c.name.split(' ')[0])},</p>
     ${conflict
       ? `<p style="margin:0">Recebemos o seu pagamento, mas o horário escolhido foi ocupado enquanto o pagamento era processado. Vamos contactá-lo nas próximas horas para acertar uma nova data.</p>`
       : `<p style="margin:0">A sua consulta com a Oliveira Legal está confirmada. Seguem os detalhes:</p>`}
     ${details}
     ${conflict ? '' : `<p style="margin:0 0 10px">Adicione ao seu calendário:</p>
     <p style="margin:0 0 18px">${button(googleLink(clientEvent), 'Google Calendar')}${button(outlookLink(clientEvent), 'Outlook')}</p>
     <p style="margin:0;font-size:13px;color:#7a7f66">O convite (.ics) segue em anexo — abra-o para o adicionar ao Apple Calendar ou a outro calendário.</p>`}`,
    `Precisa de alterar a data? Responda a este e-mail${c.notifyEmail ? ` ou escreva para ${h(c.notifyEmail)}` : ''}.<br>Oliveira Legal · Sociedade de Advogados · Albufeira`)

  const officeHtml = shell(conflict ? 'Pagamento com conflito de horário' : 'Nova consulta marcada',
    `${conflict ? `<p style="margin:0 0 12px;padding:12px;background:#fbefe6;border:1px solid #e9c9b0"><strong>Atenção:</strong> o pagamento chegou depois de o horário ter sido ocupado. Contacte o cliente para reagendar.</p>` : ''}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
       ${row('Cliente', h(c.name))}
       ${row('E-mail', `<a href="mailto:${h(c.email)}" style="color:#626A43">${h(c.email)}</a>`)}
       ${c.phone ? row('Telefone', h(c.phone)) : ''}
       ${row('Quando', h(when))}
       ${row('Formato', h(MODE_LABEL[c.mode]))}
       ${c.area ? row('Área', h(c.area)) : ''}
       ${c.topic ? row('Assunto', nl(c.topic)) : ''}
       ${row('Pago', h(money(c.amountCents, c.currency)))}
       ${row('Referência', h(c.reference))}
     </table>
     ${conflict ? '' : `<p style="margin:0">${button(googleLink(officeEvent), 'Google Calendar')}${button(outlookLink(officeEvent, 'office'), 'Outlook / Microsoft 365')}</p>`}`,
    'A lead foi movida para a fase "Reunião" no backoffice, com o histórico atualizado.')

  const [client, officeOk] = await Promise.all([
    send({
      from, to: [c.email], reply_to: office, subject: conflict ? `Pagamento recebido · ${c.reference}` : `Consulta confirmada · ${longDate(start)}, ${hour(start)}`,
      html: clientHtml,
      attachments: conflict ? undefined : [{ filename: 'consulta-oliveira-legal.ics', content: ics(clientEvent), content_type: 'text/calendar; method=REQUEST; charset=UTF-8' }],
    }),
    send({
      from, to: [office], reply_to: c.email, subject: `${conflict ? '⚠ Reagendar' : 'Nova consulta'} · ${c.name} · ${longDate(start)}, ${hour(start)}`,
      html: officeHtml,
      attachments: conflict ? undefined : [{ filename: `consulta-${c.reference}.ics`, content: ics(officeEvent), content_type: 'text/calendar; method=PUBLISH; charset=UTF-8' }],
    }),
  ])
  return { client, office: officeOk }
}
