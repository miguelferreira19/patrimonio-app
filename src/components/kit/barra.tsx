import { cn } from "@/lib/cn";

const TONS = {
  perda: { fundo: "bg-perda-tenue", cheio: "bg-perda" },
  tinta: { fundo: "bg-carta", cheio: "bg-tinta" },
  futuro: { fundo: "bg-futuro-tenue", cheio: "bg-futuro" },
};

export function Barra({ parte, total, tom }: {
  parte: number;
  total: number;
  tom: keyof typeof TONS;
}) {
  const percentagem = Number.isFinite(parte) && Number.isFinite(total) && total > 0
    ? Math.max(0, Math.min(1, parte / total)) * 100 : 0;
  return (
    <div role="meter" aria-label="Proporção do total" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={percentagem}
      className={cn("h-3 w-full overflow-hidden rounded-[6px]", TONS[tom].fundo)}>
      <div className={cn("barra-cresce h-full rounded-[6px]", TONS[tom].cheio)} style={{ width: `${percentagem}%` }} />
    </div>
  );
}
