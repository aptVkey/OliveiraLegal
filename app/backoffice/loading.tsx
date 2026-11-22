// Mostrado de imediato ao navegar entre secções, enquanto o servidor prepara a página.
// Com isto o menu lateral mantém-se e o clique responde logo (o Next também o pré-carrega).
export default function Loading() {
  return (
    <div className="skeleton" role="status" aria-label="A carregar">
      <div className="skeleton__bar skeleton__bar--title" />
      <div className="skeleton__bar skeleton__bar--sub" />
      <div className="skeleton__grid">
        <div className="skeleton__card" /><div className="skeleton__card" /><div className="skeleton__card" />
      </div>
      <div className="skeleton__panel" />
    </div>
  )
}
