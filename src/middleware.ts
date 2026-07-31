import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: manter o getUser() aqui — refresca a sessão em cada request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLogin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  if (user && isLogin) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}

export const config = {
  // /api/ fora do matcher: cada route handler tem a sua própria proteção (requireAdmin ou,
  // no caso do cron, um segredo por header) — um pedido do Vercel Cron nunca tem cookie de
  // sessão, e sem esta exclusão o middleware redirecionava-o para /login antes da rota correr.
  //
  // `manifest.json` e `sw.js` também ficam de fora, senão a app não é instalável no
  // telemóvel: o matcher já excluía imagens pela extensão, mas não `.json` nem `.js`,
  // e os dois respondiam 307 para /login. O browser lê o manifesto ANTES de haver
  // sessão, e o registo de um service worker falha por norma se o pedido do script for
  // redirecionado. Nenhum dos dois tem dados pessoais — o manifesto é o nome e os
  // ícones, o sw.js não faz cache de nada (ver public/sw.js).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
