// Sem "use client": só desenha. Duas letras num círculo neutro (vellum): dá corpo a uma lista
// de pessoas sem recorrer a cor, que na app é reservada ao significado (PLANO_VISUAL.md).
import { cn } from "@/lib/cn";

export function Iniciais({ nome, className }: { nome: string; className?: string }) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-vellum text-[13px] font-semibold tracking-wide text-tinta-2 ring-1 ring-regua",
        className,
      )}
    >
      {(primeira + ultima).toUpperCase()}
    </span>
  );
}
