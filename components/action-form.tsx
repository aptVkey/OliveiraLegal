'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { FormState } from '@/lib/forms'

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  children: React.ReactNode
  className?: string
  resetOnSuccess?: boolean
}

export function ActionForm({ action, children, className, resetOnSuccess }: Props) {
  const [state, formAction] = useActionState(action, {} as FormState)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => { if (state.ok && resetOnSuccess) ref.current?.reset() }, [state, resetOnSuccess])

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error && <p className="alert alert--error form-msg" role="alert">{state.error}</p>}
      {state.ok && state.message && <p className="alert alert--info form-msg" role="status">{state.message}</p>}
    </form>
  )
}
