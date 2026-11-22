export function initials(name: string | null | undefined) {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '—'
}

export function Avatars({ names, max = 4 }: { names: string[]; max?: number }) {
  if (!names.length) return <span className="muted small">—</span>
  return (
    <span className="avatars" title={names.join(', ')}>
      {names.slice(0, max).map((n, i) => <span className="avatar" key={i}>{initials(n)}</span>)}
      {names.length > max && <span className="avatar avatar--more">+{names.length - max}</span>}
    </span>
  )
}
