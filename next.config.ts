import type { NextConfig } from 'next'

const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
const security = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

// Cache do site estático: fontes nunca mudam de conteúdo; imagens raramente;
// CSS/JS podem mudar a cada deploy, por isso o browser revalida em segundo plano.
const cache = (value: string) => [{ key: 'Cache-Control', value }]

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // O site público continua a ser o HTML estático em public/index.html
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }], afterFiles: [], fallback: [] }
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/assets/fonts/:file*', headers: cache('public, max-age=31536000, immutable') },
      { source: '/assets/img/:file*', headers: cache('public, max-age=2592000, stale-while-revalidate=604800') },
      { source: '/assets/brand/:file*', headers: cache('public, max-age=604800, stale-while-revalidate=604800') },
      { source: '/assets/(css|js)/:file*', headers: cache('public, max-age=300, stale-while-revalidate=86400') },
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
