import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './config'

// Renova a sessão em cada pedido e faz a verificação otimista de acesso ao backoffice.
// A autorização real é sempre repetida no servidor (lib/auth.ts) e na base de dados (RLS).
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isBackoffice = pathname === '/backoffice' || pathname.startsWith('/backoffice/')

  if (!isSupabaseConfigured) {
    if (isBackoffice) return NextResponse.redirect(new URL('/login', request.url))
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)

  if (isBackoffice && !signedIn) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  if (pathname === '/login' && signedIn && !request.nextUrl.searchParams.has('erro')) {
    return NextResponse.redirect(new URL('/backoffice', request.url))
  }
  return response
}
