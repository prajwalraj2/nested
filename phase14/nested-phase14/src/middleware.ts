import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

// Supported countries for geo-targeting
const SUPPORTED_COUNTRIES = ['IN', 'US', 'GB', 'AU', 'CA']
const DEFAULT_COUNTRY = 'US'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Start with NextResponse.next() so we can modify it
  let response = NextResponse.next()

  // ============================================
  // GEO-TARGETING: Detect and set user country
  // ============================================
  const existingCountry = request.cookies.get('user-country')?.value
  
  if (!existingCountry) {
    // Get country from Vercel's geo headers (only works on Vercel deployment)
    const detectedCountry = request.headers.get('x-vercel-ip-country') || DEFAULT_COUNTRY
    
    // Use detected country if supported, otherwise default to US
    const userCountry = SUPPORTED_COUNTRIES.includes(detectedCountry) 
      ? detectedCountry 
      : DEFAULT_COUNTRY
    
    // Set cookie for future requests
    response.cookies.set('user-country', userCountry, {
      httpOnly: false, // Allow client-side access if needed
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    })
  }

  // ============================================
  // ADMIN PROTECTION: Protect admin routes
  // ============================================
  if (pathname.startsWith('/admin')) {
    const session = await auth()
    
    // If no session, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // If not admin, redirect to unauthorized
    if (!session.user?.isAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    // If user is inactive, redirect to login
    if (!session.user?.isActive) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'Account is inactive')
      return NextResponse.redirect(loginUrl)
    }
  }

  // ============================================
  // LOGIN REDIRECT: Redirect logged-in admins away from login
  // ============================================
  if (pathname === '/login') {
    const session = await auth()
    if (session?.user?.isAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
