// Skeleton genérico enquanto uma página de (app) carrega: imita o ritmo
// PageHeader + grelha de StatCards + cartão grande que a maioria das páginas segue.
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-4 w-64 animate-pulse rounded-lg bg-zinc-200" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100" />
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100" />
        <div className="h-48 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100" />
      </div>
    </div>
  );
}
