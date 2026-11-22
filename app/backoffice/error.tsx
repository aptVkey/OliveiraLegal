'use client'

export default function BackofficeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty">
      <h2>Não foi possível concluir</h2>
      <p>{error.message && !error.message.includes('Server Components') ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'}</p>
      <button className="btn btn--sm" type="button" onClick={reset}>Tentar novamente</button>
    </div>
  )
}
