export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-300">App ainda não configurada</h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-400">
          Faltam as variáveis de ambiente do Supabase. Segue os passos do ficheiro{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">SETUP.md</code> na raiz do
          projeto:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-400">
          <li>Criar um projeto novo no Supabase (região da União Europeia).</li>
          <li>
            Correr{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">supabase/schema.sql</code>{" "}
            no SQL Editor.
          </li>
          <li>
            Copiar{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">.env.local.example</code>{" "}
            para <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">.env.local</code> e
            preencher o URL e a anon key do projeto.
          </li>
          <li>Reiniciar o servidor de desenvolvimento.</li>
        </ol>
      </div>
    </main>
  );
}
