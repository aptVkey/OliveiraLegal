'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, useTransition } from 'react'

type Props = { placeholder: string; param?: string; delay?: number; autoFocus?: boolean }

// Filtra em tempo real: atualiza ?q= na URL (sem recarregar) e o servidor devolve a lista filtrada
function Search({ placeholder, param = 'q', delay = 250, autoFocus }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get(param) ?? ''
  const [value, setValue] = useState(current)
  const [pending, startTransition] = useTransition()
  const typing = useRef(false)

  // Mantém o campo alinhado quando a URL muda por outra via (separadores, voltar atrás)
  useEffect(() => { if (!typing.current) setValue(current) }, [current])

  useEffect(() => {
    if (value.trim() === current.trim()) { typing.current = false; return }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set(param, value.trim()); else next.delete(param)
      const qs = next.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
      typing.current = false
    }, delay)
    return () => clearTimeout(t)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`live-search${pending ? ' is-pending' : ''}`} role="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onChange={e => { typing.current = true; setValue(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Escape') { typing.current = true; setValue('') } }}
      />
      {pending && <span className="live-search__spinner" aria-hidden="true" />}
    </div>
  )
}

export function LiveSearch(props: Props) {
  return (
    <Suspense fallback={<div className="live-search"><input type="search" placeholder={props.placeholder} disabled /></div>}>
      <Search {...props} />
    </Suspense>
  )
}
