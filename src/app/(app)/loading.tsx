// Esqueleto genérico enquanto uma página de (app) carrega: o ritmo cabeçalho, linha de
// números e corpo que as superfícies da V2 seguem.
//
// ESTÁTICO de propósito: o design system não tem nada em loop (CLAUDE.md, "Movimento"), e
// o `animate-pulse` que aqui estava era a única animação infinita da app. Blocos em vellum
// sobre papel já dizem "a carregar" sem piscar.
export default function Loading() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="A carregar">
      <p role="status" className="sr-only">A carregar a página e os dados da carteira.</p>
      <div className="space-y-3">
        <div className="h-10 w-56 rounded-lg bg-vellum" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-vellum" />
      </div>
      <div className="grid grid-cols-2 gap-6 border-y border-regua py-5 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-vellum" />
            <div className="h-6 w-24 rounded bg-vellum" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-xl border border-regua bg-carta" />
    </div>
  );
}
