import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Shell } from "@/components/shell";
import { SetupNotice } from "@/components/setup-notice";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getSession } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured()) return <SetupNotice />;

  // A MESMA sessão que a página vai pedir (`getSession` está em `cache()`): um só
  // `getUser()` e uma só leitura do perfil para o layout e a página juntos.
  const { user, role, perfilErro: error } = await getSession();
  if (!user) redirect("/login");

  // Sem perfil legível a app cai para "leitura" e os botões de escrita desaparecem —
  // sem esta mensagem o utilizador não teria como perceber porquê.
  if (error) {
    console.error("[perfil] não foi possível ler public.profiles:", error.code, error.message);
  }

  return (
    // V4: o invólucro novo (REDESENHO.md §3.2). Para voltar ao masthead: trocar <Shell> por
    // <Masthead role={role} email={...} /> mais o <main> antigo (ver git log deste ficheiro).
    <Shell role={role} email={user.email ?? null}>
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-regua bg-atencao-tenue px-4 py-3 text-sm">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-atencao" aria-hidden="true" />
          <div>
            <p className="font-medium text-tinta">Perfil não legível</p>
            <p className="mt-0.5 text-tinta-2">
              A app está a assumir acesso de leitura. Erro{" "}
              <code className="rounded bg-vellum px-1 font-mono text-xs">{error.code}</code>: {error.message}
            </p>
          </div>
        </div>
      )}
      {children}
    </Shell>
  );
}
