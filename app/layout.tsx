import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Backoffice · Oliveira Legal', template: '%s · Oliveira Legal' },
  robots: { index: false, follow: false },
  icons: { icon: '/assets/brand/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  )
}
