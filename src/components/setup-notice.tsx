export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
      <div className="rounded-lg border border-atencao/30 bg-atencao-tenue p-6">
        <h1 className="text-lg font-semibold text-atencao">App ainda não configurada</h1>
        <p className="mt-2 text-sm text-atencao">
          Faltam as variáveis de ambiente do Supabase. Segue os passos do ficheiro{" "}
          <code className="rounded bg-atencao-tenue px-1 py-0.5 text-xs">SETUP.md</code> na raiz do
          projeto:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-atencao">
          <li>Criar um projeto novo no Supabase (região da União Europeia).</li>
          <li>
            Correr{" "}
            <code className="rounded bg-atencao-tenue px-1 py-0.5 text-xs">supabase/schema.sql</code>{" "}
            no SQL Editor.
          </li>
          <li>
            Copiar{" "}
            <code className="rounded bg-atencao-tenue px-1 py-0.5 text-xs">.env.local.example</code>{" "}
            para <code className="rounded bg-atencao-tenue px-1 py-0.5 text-xs">.env.local</code> e
            preencher o URL e a anon key do projeto.
          </li>
          <li>Reiniciar o servidor de desenvolvimento.</li>
        </ol>
      </div>
    </main>
  );
}
