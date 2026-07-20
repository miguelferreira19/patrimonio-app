import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { AppNav } from "@/components/nav";
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
    <div className="min-h-screen bg-zinc-50">
      <AppNav role={role} email={user.email ?? null} />
      <main className="mx-auto max-w-[1400px] p-4 pb-16 md:ml-60 md:p-8">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-amber-900">Perfil não legível</p>
              <p className="mt-0.5 text-amber-800">
                A app está a assumir acesso de leitura. Erro{" "}
                <code className="rounded bg-amber-100 px-1 font-mono text-xs">{error.code}</code>:{" "}
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
