import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'r53_session';

/** No session cookie → send the user to sign in, remembering where they were going. */
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/route53/:path*'],
};
