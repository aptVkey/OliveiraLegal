import 'server-only'
import { buildIcs, googleLink, outlookLink, type CalEvent } from './calendar'
import { MODE_LABEL, TZ, hour, longDate, money } from './format'

// Envio por Resend (https://resend.com) — chave só no servidor
const resendKey = process.env.RESEND_API_KEY ?? ''
const from = process.env.BOOKING_EMAIL_FROM ?? ''
export const isEmailConfigured = resendKey.startsWith('re_') && from.includes('@')

// Endereço público (logótipo e ligações). SITE_URL em produção.
const SITE = (process.env.SITE_URL ?? 'https://www.oliveiralegal.com').replace(/\/$/, '')

export type EmailContext = {
  id: string; reference: string; name: string; email: string; phone: string | null
  mode: 'presencial' | 'online'; status: 'pago' | 'conflito'; topic: string | null; area: string | null
  startsAt: string; endsAt: string; amountCents: number; currency: string
  address: string | null; onlineInstructions: string | null; notifyEmail: string | null
}

// Cores e tipografia da marca (iguais às do site)
const C = { olive: '#626A43', ivory: '#F3EFE5', paper: '#FBF9F4', rule: '#E6E1D6', ink: '#3f4530', muted: '#7a7f66' }
const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"

const h = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const nl = (s: string | null | undefined) => h(s).replace(/\r?\n/g, '<br>')
const fromEmail = () => from.match(/<([^>]+)>/)?.[1] ?? from
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
// Só ligações http(s) viram botões; texto livre do backoffice nunca vira HTML
const firstUrl = (s: string | null | undefined) => s?.match(/https?:\/\/[^\s<>"']+/)?.[0] ?? null

function shell(opts: { title: string; preheader: string; body: string; footer: string }) {
  const { title, preheader, body, footer } = opts
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${h(title)}</title></head>
<body style="margin:0;padding:0;background:${C.ivory};color:${C.ink};font-family:${SANS};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${h(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:${C.olive};border-radius:20px 20px 0 0;padding:34px 36px 30px" align="center">
<img src="${SITE}/assets/brand/email-logo.png" width="220" height="63" alt="Oliveira Legal" style="display:block;border:0;outline:none;height:auto;max-width:220px">
</td></tr>
<tr><td style="background:${C.paper};padding:38px 36px 8px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule}">
<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${C.muted}">Oliveira Legal · Albufeira</div>
<h1 style="margin:10px 0 0;font:400 30px/1.15 ${SERIF};color:${C.olive};letter-spacing:-.01em">${h(title)}</h1>
</td></tr>
<tr><td style="background:${C.paper};padding:18px 36px 36px;font-size:15px;line-height:1.7;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule}">${body}</td></tr>
<tr><td style="background:${C.ivory};padding:22px 36px 26px;border:1px solid ${C.rule};border-top:1px solid ${C.rule};border-radius:0 0 20px 20px;font-size:12px;line-height:1.7;color:${C.muted}">${footer}</td></tr>
</table>
<p style="margin:18px 0 0;font-size:11px;color:${C.muted}">Oliveira Legal · Sociedade de Advogados · Albufeira, Algarve</p>
</td></tr></table></body></html>`
}

// Botão "à prova de Outlook": tabela com fundo, em vez de depender de CSS no <a>
const button = (href: string, label: string, kind: 'solid' | 'line' = 'solid') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:0 8px 10px 0"><tr><td style="border-radius:999px;${kind === 'solid' ? `background:${C.olive}` : `border:1px solid ${C.olive}`}">
<a href="${h(href)}" style="display:inline-block;padding:13px 24px;font:400 14px/1 ${SANS};letter-spacing:.03em;color:${kind === 'solid' ? C.ivory : C.olive};text-decoration:none;border-radius:999px">${label}</a></td></tr></table>`

const row = (k: string, v: string) =>
  `<tr><td style="padding:11px 0;border-bottom:1px solid ${C.rule};color:${C.muted};font-size:11px;letter-spacing:.12em;text-transform:uppercase;width:34%;vertical-align:top">${k}</td><td style="padding:11px 0;border-bottom:1px solid ${C.rule};vertical-align:top;font-size:15px">${v}</td></tr>`

// Cartão da data: o que a pessoa procura primeiro ao abrir o e-mail
function dateCard(start: Date, end: Date, mode: string) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, ...o }).format(start)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;background:${C.ivory};border:1px solid ${C.rule};border-radius:16px"><tr>
<td width="96" align="center" style="padding:20px 0 20px 8px;border-right:1px solid ${C.rule}">
<div style="font:400 40px/1 ${SERIF};color:${C.olive}">${f({ day: 'numeric' })}</div>
<div style="margin-top:6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${C.muted}">${h(f({ month: 'short' }).replace('.', ''))}</div></td>
<td style="padding:20px 24px"><div style="font:italic 400 20px/1.25 ${SERIF};color:${C.olive}">${h(cap(f({ weekday: 'long' })))}</div>
<div style="margin-top:4px;font-size:15px;color:${C.ink}">${hour(start)}–${hour(end)} · ${h(MODE_LABEL[mode])}</div></td></tr></table>`
}

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
  const when = `${cap(longDate(start))}, ${hour(start)}–${hour(end)}`
  const where = c.mode === 'presencial' ? (c.address || 'Escritório Oliveira Legal, Albufeira') : 'Reunião online'
  const online = c.mode === 'online' ? (c.onlineInstructions || 'Enviaremos o link da reunião antes da hora marcada.') : ''
  const meetUrl = firstUrl(online)
  const office = c.notifyEmail || fromEmail()
  const conflict = c.status === 'conflito'
  const first = c.name.trim().split(/\s+/)[0]
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`

  const clientEvent: CalEvent = {
    uid: `${c.id}@oliveiralegal`, start, end, method: 'REQUEST',
    title: `Consulta jurídica · Oliveira Legal (${MODE_LABEL[c.mode]})`,
    description: [`Referência: ${c.reference}`, c.area && `Área: ${c.area}`, online && `Acesso: ${online}`,
      c.mode === 'presencial' && `Morada: ${where}`].filter(Boolean).join('\n'),
    location: c.mode === 'presencial' ? where : (meetUrl ?? 'Online'),
    organizerEmail: office, attendee: { name: c.name, email: c.email },
  }
  const officeEvent: CalEvent = {
    ...clientEvent, method: 'PUBLISH', attendee: null, organizerEmail: null,
    title: `Consulta · ${c.name} (${MODE_LABEL[c.mode]})`,
    description: [`Referência: ${c.reference}`, `Cliente: ${c.name}`, `E-mail: ${c.email}`, c.phone && `Telefone: ${c.phone}`,
      c.area && `Área: ${c.area}`, c.topic && `Assunto: ${c.topic}`, `Pago: ${money(c.amountCents, c.currency)}`].filter(Boolean).join('\n'),
  }
  const ics = (e: CalEvent) => Buffer.from(buildIcs(e), 'utf8').toString('base64')

  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;border-top:1px solid ${C.rule}">
    ${row(c.mode === 'presencial' ? 'Local' : 'Acesso', nl(c.mode === 'presencial' ? where : online))}
    ${c.area ? row('Área', h(c.area)) : ''}
    ${row('Valor pago', h(money(c.amountCents, c.currency)))}
    ${row('Referência', `<span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:14px">${h(c.reference)}</span>`)}
  </table>`

  const prepare = c.mode === 'presencial'
    ? ['Chegue com 10 minutos de antecedência.', 'Traga um documento de identificação e os documentos relacionados com o seu caso.']
    : ['Entre na reunião 5 minutos antes e teste o áudio e o vídeo.', 'Tenha à mão os documentos relacionados com o seu caso, para os partilhar durante a consulta.']
  const prepareHtml = `<div style="margin:6px 0 24px"><div style="font:italic 400 19px/1.3 ${SERIF};color:${C.olive};margin-bottom:8px">Para aproveitar melhor a consulta</div>
    <table role="presentation" cellpadding="0" cellspacing="0">${prepare.map(t => `<tr><td valign="top" style="padding:3px 12px 3px 0;color:${C.olive}">—</td><td style="padding:3px 0;font-size:14px;line-height:1.6">${h(t)}</td></tr>`).join('')}</table></div>`

  const clientHtml = shell({
    title: conflict ? 'Pagamento recebido' : 'Consulta confirmada',
    preheader: conflict ? 'Vamos contactá-lo para acertar uma nova data.' : `${cap(longDate(start))}, ${hour(start)} · ${MODE_LABEL[c.mode]}`,
    body: `<p style="margin:0 0 16px">Olá ${h(first)},</p>
     ${conflict
       ? `<p style="margin:0 0 6px">Recebemos o seu pagamento, mas o horário escolhido foi ocupado enquanto o pagamento era processado. Pedimos desculpa pelo incómodo: vamos contactá-lo nas próximas horas para acertar uma nova data. Não terá de pagar novamente.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;border-top:1px solid ${C.rule}">${row('Referência', `<span style="font-family:Menlo,Consolas,monospace">${h(c.reference)}</span>`)}</table>`
       : `<p style="margin:0 0 20px">A sua consulta está confirmada. Será um gosto recebê-lo.</p>
        ${dateCard(start, end, c.mode)}
        ${details}
        <p style="margin:0 0 12px">${c.mode === 'online' && meetUrl ? button(meetUrl, 'Entrar na reunião') : ''}${c.mode === 'presencial' ? button(mapUrl, 'Ver no mapa') : ''}${button(googleLink(clientEvent), 'Adicionar ao Google Calendar', c.mode === 'online' && meetUrl || c.mode === 'presencial' ? 'line' : 'solid')}${button(outlookLink(clientEvent), 'Outlook', 'line')}</p>
        <p style="margin:0 0 26px;font-size:13px;color:${C.muted}">O convite (.ics) segue em anexo: abra-o para adicionar a consulta ao Apple Calendar ou a qualquer outro calendário.</p>
        ${prepareHtml}`}`,
    footer: `Precisa de alterar a data? Basta responder a este e-mail${c.notifyEmail ? ` ou escrever para <a href="mailto:${h(c.notifyEmail)}" style="color:${C.olive}">${h(c.notifyEmail)}</a>` : ''}.<br>
      Os seus dados são tratados com confidencialidade e apenas para a prestação do serviço.`,
  })

  const officeHtml = shell({
    title: conflict ? 'Pagamento com conflito de horário' : 'Nova consulta marcada',
    preheader: `${c.name} · ${cap(longDate(start))}, ${hour(start)} · ${MODE_LABEL[c.mode]}`,
    body: `${conflict ? `<p style="margin:0 0 18px;padding:14px 16px;background:#fbefe6;border:1px solid #e9c9b0;border-radius:12px"><strong>Atenção:</strong> o pagamento chegou depois de o horário ter sido ocupado. Contacte o cliente para reagendar.</p>` : dateCard(start, end, c.mode)}
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:1px solid ${C.rule}">
       ${row('Cliente', h(c.name))}
       ${row('E-mail', `<a href="mailto:${h(c.email)}" style="color:${C.olive}">${h(c.email)}</a>`)}
       ${c.phone ? row('Telefone', `<a href="tel:${h(c.phone.replace(/[^\d+]/g, ''))}" style="color:${C.olive};text-decoration:none">${h(c.phone)}</a>`) : ''}
       ${conflict ? row('Pedido para', h(when)) : ''}
       ${c.area ? row('Área', h(c.area)) : ''}
       ${c.topic ? row('Assunto', nl(c.topic)) : ''}
       ${row('Pago', h(money(c.amountCents, c.currency)))}
       ${row('Referência', `<span style="font-family:Menlo,Consolas,monospace;font-size:14px">${h(c.reference)}</span>`)}
     </table>
     ${conflict ? '' : `<p style="margin:0">${button(googleLink(officeEvent), 'Adicionar ao Google Calendar')}${button(outlookLink(officeEvent, 'office'), 'Outlook / Microsoft 365', 'line')}</p>`}`,
    footer: 'A lead foi movida para a fase "Reunião" no backoffice, com o histórico atualizado.',
  })

  const clientText = conflict
    ? `Olá ${first},\n\nRecebemos o seu pagamento, mas o horário escolhido foi ocupado enquanto o pagamento era processado. Vamos contactá-lo nas próximas horas para acertar uma nova data. Não terá de pagar novamente.\n\nReferência: ${c.reference}\n\nOliveira Legal`
    : `Olá ${first},\n\nA sua consulta está confirmada.\n\nQuando: ${when}\nFormato: ${MODE_LABEL[c.mode]}\n${c.mode === 'presencial' ? `Local: ${where}` : `Acesso: ${online}`}\nValor pago: ${money(c.amountCents, c.currency)}\nReferência: ${c.reference}\n\nO convite (.ics) segue em anexo.\nPara alterar a data, responda a este e-mail.\n\nOliveira Legal · Albufeira`

  const [client, officeOk] = await Promise.all([
    send({
      from, to: [c.email], reply_to: office,
      subject: conflict ? `Pagamento recebido · ${c.reference}` : `Consulta confirmada · ${longDate(start)}, ${hour(start)}`,
      html: clientHtml, text: clientText,
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
