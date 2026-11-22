import type { NextConfig } from 'next'

const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
const security = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  devIndicators: false,
  // O site público continua a ser o HTML estático em public/index.html
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }], afterFiles: [], fallback: [] }
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/login', headers: noindex },
      { source: '/backoffice/:path*', headers: noindex },
      { source: '/backoffice', headers: noindex },
      { source: '/auth/:path*', headers: noindex },
      { source: '/definir-palavra-passe', headers: noindex },
      { source: '/recuperar', headers: noindex },
    ]
  },
}

export default nextConfig
