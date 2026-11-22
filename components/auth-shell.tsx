export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="auth">
      <section className="auth__art" aria-hidden="true">
        <p className="auth__quote">Rigor, clareza e proximidade.</p>
        <div className="auth__arch" />
        <img className="auth__mono" src="/assets/brand/novos-logos/monograma-marfim.svg" alt="" />
        <a className="auth__back" href="/" tabIndex={-1}>← Voltar ao site</a>
      </section>
      <section className="auth__panel">
        <div className="auth__form">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="auth__title">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  )
}
