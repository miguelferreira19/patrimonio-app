import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { SetupNotice } from "@/components/setup-notice";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Sem perfil legível a app cai para "leitura" e os botões de escrita desaparecem —
  // sem esta mensagem o utilizador não teria como perceber porquê.
  if (error) {
    console.error("[perfil] não foi possível ler public.profiles:", error.code, error.message);
  }

  const role = profile?.role ?? "viewer";

  return (
    <div className="min-h-screen bg-papel">
      {/* Saltar a navegação: 40 links de rail antes do conteúdo é o que torna a app
          impraticável só com teclado ou com leitor de ecrã. Só aparece com foco. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-carta focus:px-3 focus:py-2 focus:text-sm focus:text-tinta focus:outline-none focus:ring-2 focus:ring-acao"
      >
        Saltar para o conteúdo
      </a>
      {/* PARA VOLTAR AO RAIL ESCURO: trocar por <AppNav role={role} email={...} /> (o
          nav.tsx está intacto) e repor as margens de rail no <main>:
          "mx-auto max-w-[1360px] p-4 pb-16 md:ml-60 md:px-9 md:pb-16 md:pt-8". */}
      <Masthead role={role} email={user.email ?? null} />
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto max-w-[1360px] px-4 pb-20 pt-6 md:px-9 md:pb-24 md:pt-9"
      >
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-300">Perfil não legível</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-400">
                A app está a assumir acesso de leitura. Erro{" "}
                <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/60">{error.code}</code>:{" "}
                {error.message}
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
