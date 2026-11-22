import Link from 'next/link'

export function PageHead({ eyebrow, title, desc, actions }: {
  eyebrow?: string; title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: 'off' | 'warn' | 'ok' | 'danger' }) {
  return <span className={`badge${tone ? ` badge--${tone}` : ''}`}>{children}</span>
}

export function Options({ map, empty }: { map: Record<string, string>; empty?: string }) {
  return (
    <>
      {empty !== undefined && <option value="">{empty}</option>}
      {Object.entries(map).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </>
  )
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="back-link" href={href}>← {children}</Link>
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {hint && <p className="stat__hint">{hint}</p>}
    </>
  )
  return href ? <Link className="card card--link" href={href}>{body}</Link> : <article className="card">{body}</article>
}
