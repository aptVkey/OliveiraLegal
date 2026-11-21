import { notFound } from 'next/navigation'
import { SECTIONS } from '../sections'

export function generateStaticParams() {
  return SECTIONS.filter(s => s.slug && s.slug !== 'equipa').map(s => ({ section: s.slug }))
}
export const dynamicParams = false
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  return { title: SECTIONS.find(s => s.slug === section)?.label }
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = SECTIONS.find(x => x.slug === section)
  if (!s) notFound()
  return (
    <>
      <header className="page-head">
        <div><p className="eyebrow">{s.group}</p><h1>{s.label}</h1></div>
      </header>
      <div className="empty">
        <h2>Em construção</h2>
        <p>{s.intro}</p>
        <span className="badge">{s.phase}</span>
      </div>
    </>
  )
}
