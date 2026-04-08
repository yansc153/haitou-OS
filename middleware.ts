import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/landing', '/preview', '/legal', '/api/resume-preview'];

// Pre-compute expected admin token at module load (Edge Runtime compatible)
let _adminTokenCache: string | null = null;
async function getAdminToken(): Promise<string> {
  if (_adminTokenCache) return _adminTokenCache;
  const secret = process.env.ADMIN_SECRET || 'haitou-admin-2026';
  const data = new TextEncoder().encode(`admin:${secret}:salt-haitou`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  _adminTokenCache = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return _adminTokenCache;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Not logged in: root → landing, other protected routes → login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/landing' : '/login';
    return NextResponse.redirect(url);
  }

  // Logged in and on login page → redirect to appropriate page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Admin route protection: requires admin_token cookie (set via /admin-login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin-login')) {
    const adminToken = request.cookies.get('admin_token')?.value;
    const expected = await getAdminToken();
    if (adminToken !== expected) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin-login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
