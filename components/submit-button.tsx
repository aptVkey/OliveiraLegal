'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children, pendingText, className = 'btn', confirm }: {
  children: React.ReactNode; pendingText?: string; className?: string; confirm?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      onClick={confirm ? e => { if (!window.confirm(confirm)) e.preventDefault() } : undefined}
    >
      {pending ? pendingText ?? 'A guardar…' : children}
    </button>
  )
}
