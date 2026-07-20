import { redirect } from "next/navigation";
import { FileText, LineChart, ShieldCheck } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/setup-notice";
import { LoginForm } from "./login-form";

const HIGHLIGHTS = [
  { icon: FileText, label: "Recibos do Portal das Finanças" },
  { icon: LineChart, label: "Benchmarks do INE" },
  { icon: ShieldCheck, label: "Acesso só por convite" },
];

export default async function LoginPage() {
  if (!supabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen">
      {/* Painel de marca */}
      <div className="login-glow relative hidden w-[45%] flex-col overflow-hidden p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-base font-bold text-teal-300">
            P
          </span>
          <span className="text-lg font-semibold text-white">Património</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="max-w-sm text-2xl font-medium leading-snug text-white">
            Rendas, contratos e património da família, num só lugar.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-zinc-400">
                <Icon size={16} strokeWidth={1.75} className="shrink-0 text-teal-400" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Entrar</h1>
            <p className="mt-1 text-sm text-zinc-500">Gestão de arrendamentos da família</p>
          </div>
          <LoginForm />
          <p className="mt-4 text-center text-xs text-zinc-400">
            Não há registo público: os acessos são criados pelo administrador.
          </p>
        </div>
      </div>
    </main>
  );
}
