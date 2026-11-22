'use client'

export function PrintButton() {
  return <button className="btn btn--ghost btn--sm" type="button" onClick={() => window.print()}>Imprimir / PDF</button>
}
