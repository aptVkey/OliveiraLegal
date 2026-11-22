'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Role } from '@/lib/roles'
import { Elapsed } from '@/components/elapsed'
import { SECTIONS } from './sections'
import { signOut } from './actions'
import { stopTimer } from './tempo/actions'

type Running = { started_at: string; label: string } | null

export function Sidebar({ name, role, roleLabel, running, children }: {
  name: string; role: Role; roleLabel: string; running: Running; children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  let lastGroup = ''

  return (
    <div className={`bo${open ? ' is-open' : ''}`}>
      <aside className="side">
        <Link className="side__brand" href="/backoffice">
          <img src="/assets/brand/novos-logos/monograma-marfim.svg" alt="" />
          <span>Backoffice</span>
        </Link>
        <button className="menu-toggle" type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? 'Fechar' : 'Menu'}
        </button>
        <nav className="side__nav" aria-label="Backoffice">
          {SECTIONS.filter(s => !s.roles || s.roles.includes(role)).map(s => {
            const href = s.slug ? `/backoffice/${s.slug}` : '/backoffice'
            const active = s.slug ? pathname.startsWith(href) : pathname === href
            const heading = s.group !== lastGroup ? <p className="side__group">{s.group}</p> : null
            lastGroup = s.group
            return (
              <div key={href}>
                {heading}
                <Link className="side__link" href={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={s.icon} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {s.label}
                </Link>
              </div>
            )
          })}
        </nav>
        <div className="side__foot">
          {running && (
            <div className="side__timer">
              <Link href="/backoffice/tempo"><b><span className="dot-live" /><Elapsed since={running.started_at} /></b><span>{running.label}</span></Link>
              <form action={stopTimer}><button type="submit">Parar</button></form>
            </div>
          )}
          <div className="side__user"><strong>{name}</strong><span>{roleLabel}</span></div>
          <form action={signOut}><button className="side__logout" type="submit">Terminar sessão</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
