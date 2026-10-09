"use client";

// A PESQUISA GLOBAL (V4, REDESENHO.md §3.2): Ctrl K (ou Cmd K), ou a lupa.
// `<dialog>` nativo, como a Folha. O índice pede-se UMA vez, na primeira abertura.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Home, Search, User } from "lucide-react";
import { cn } from "./ui";
import { procurar, type ItemPesquisa, type TipoResultado } from "@/lib/portfolio/pesquisa";

const ICONE: Record<TipoResultado, typeof Home> = { predio: Building2, fracao: Home, inquilino: User, documento: FileText };

export function Pesquisa({ compacta }: { compacta?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [indice, setIndice] = useState<ItemPesquisa[] | null>(null);
  const [erro, setErro] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  function abrir() {
    ref.current?.showModal();
    setQ("");
    setSel(0);
    input.current?.focus();
    if (!indice) {
      fetch("/api/pesquisa")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setIndice)
        .catch(() => setErro(true));
    }
  }

  // O atalho só na instância grande (a da barra lateral): o Shell monta também a compacta,
  // no cabeçalho do telemóvel, e as duas abririam ao mesmo tempo.
  useEffect(() => {
    if (compacta) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const resultados = indice ? procurar(indice, q) : [];

  function ir(item: ItemPesquisa) {
    ref.current?.close();
    if (item.tipo === "documento") window.open(item.href, "_blank", "noopener");
    else router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Procurar"
        className={cn(
          "flex items-center gap-2 rounded-full border border-regua bg-papel text-[13px] text-tinta-3 transition-colors hover:border-regua-forte hover:text-tinta-2",
          compacta ? "size-9 justify-center" : "w-full justify-between px-3 py-2",
        )}
      >
        <span className="flex items-center gap-2">
          <Search size={15} />
          {!compacta && "Procurar…"}
        </span>
        {!compacta && <kbd className="rounded-md border border-regua-forte px-1.5 font-sans text-[10px] text-tinta-2">Ctrl K</kbd>}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="mx-auto mt-[12vh] w-[min(560px,calc(100%-24px))] overflow-hidden rounded-2xl border border-regua bg-elevado p-0 text-tinta shadow-[0_24px_60px_-20px_rgba(15,21,23,0.45)] backdrop:bg-[rgba(15,21,23,0.35)] open:animate-modal-in"
      >
        <div className="flex items-center gap-3 border-b border-regua px-4">
          <Search size={18} className="shrink-0 text-tinta-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, resultados.length - 1));
              else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
              else if (e.key === "Enter" && resultados[sel]) ir(resultados[sel]);
              else return;
              e.preventDefault();
            }}
            placeholder="Fração, prédio, inquilino, NIF, documento…"
            aria-label="Procurar"
            className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-tinta-3"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {erro && <li className="px-3 py-6 text-center text-sm text-perda">Não foi possível carregar a pesquisa.</li>}
          {!erro && !indice && <li className="px-3 py-6 text-center text-sm text-tinta-3">A carregar…</li>}
          {indice && q.trim() === "" && (
            <li className="px-3 py-6 text-center text-sm text-tinta-3">Escreve o nome de uma rua, de um inquilino ou de um documento.</li>
          )}
          {indice && q.trim() !== "" && resultados.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-tinta-3">Nada encontrado.</li>
          )}
          {resultados.map((r, i) => {
            const Icone = ICONE[r.tipo];
            return (
              <li key={r.tipo + r.href + r.titulo} role="option" aria-selected={i === sel}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => ir(r)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === sel && "bg-vellum")}
                >
                  <Icone size={16} className="shrink-0 text-tinta-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.titulo}</span>
                    <span className="block truncate text-xs text-tinta-3">{r.sub}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </dialog>
    </>
  );
}
