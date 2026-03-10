import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware: Subdomain routing for simulator.spatialable.com
 *
 * 1. Detects simulator.* subdomain (or simulator.localhost in dev)
 * 2. Handles ?asset_client_id= param → sets cookie → redirects clean
 * 3. Rewrites path: / → /simulator, /collection/* → /simulator/collection/*
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  const isSimulator =
    hostname.startsWith('simulator.') ||
    hostname === 'simulator.localhost:3000' ||
    hostname === 'simulator.localhost';

  if (!isSimulator) return NextResponse.next();

  const url = request.nextUrl.clone();

  // Handle client switching via query param
  const clientId = url.searchParams.get('asset_client_id');
  if (clientId) {
    url.searchParams.delete('asset_client_id');
    const response = NextResponse.redirect(url);
    response.cookies.set('sa_simulator_client', clientId, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  // Rewrite path to /simulator/* routes
  const path = url.pathname;
  url.pathname = path === '/' ? '/simulator' : `/simulator${path}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!api|_next|embed|favicon\\.ico|.*\\..*).*)'],
};
