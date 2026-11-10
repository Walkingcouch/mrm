// Refreshes the Supabase session cookie and sends signed-out visitors to the
// login page. Authorisation is NOT decided here — every action is checked
// again by the database functions.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = ['/login', '/forgot', '/auth/', '/pdf-viewer'];

const NOT_CONNECTED = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>MRM App Admin</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;
font:16px/1.5 -apple-system,Roboto,sans-serif;background:#f5f7f8;color:#1f2328}
div{background:#fff;border:1px solid #dfe3e6;border-radius:10px;padding:1.5rem;max-width:420px}
h1{font-size:1.3rem;margin:0 0 .5rem}p{margin:0;color:#5f6b76}</style></head>
<body><div><h1>MRM App Admin</h1><p>This website is deployed but not yet connected to its database.
Sign-in will be available once setup is complete.</p></div></body></html>`;

export async function proxy(request: NextRequest) {
  // Until the Supabase project exists and its keys are set in the hosting
  // environment, show a holding page instead of failing on every request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(NOT_CONNECTED, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pdf-viewer/).*)'],
};
