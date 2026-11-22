// Ficheiro iCalendar (RFC 5545) + ligações diretas para Google Calendar e Outlook
export type CalEvent = {
  uid: string
  start: Date
  end: Date
  title: string
  description: string
  location?: string | null
  organizerEmail?: string | null
  attendee?: { name: string; email: string } | null
  method: 'REQUEST' | 'PUBLISH'
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const clean = (s: string) => s.replace(/[\r\n:;"]/g, ' ').trim()

// Linhas com mais de 75 octetos dobram-se (CRLF + espaço), sem partir caracteres UTF-8
function fold(line: string): string {
  const out: string[] = []
  let cur = '', bytes = 0
  for (const ch of line) {
    const n = Buffer.byteLength(ch)
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0 }
    cur += ch; bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

export function buildIcs(e: CalEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Oliveira Legal//Agendamentos//PT',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${e.method}`,
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.organizerEmail ? [`ORGANIZER;CN=Oliveira Legal:mailto:${e.organizerEmail}`] : []),
    ...(e.attendee ? [`ATTENDEE;CN="${clean(e.attendee.name)}";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${e.attendee.email}`] : []),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function googleLink(e: CalEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: e.title, dates: `${stamp(e.start)}/${stamp(e.end)}`,
    details: e.description, location: e.location ?? '', ctz: 'Europe/Lisbon',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

export function outlookLink(e: CalEvent, host: 'live' | 'office' = 'live'): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose', rru: 'addevent', subject: e.title,
    startdt: e.start.toISOString(), enddt: e.end.toISOString(), body: e.description, location: e.location ?? '',
  })
  return `https://outlook.${host === 'live' ? 'live' : 'office'}.com/calendar/0/deeplink/compose?${p}`
}
