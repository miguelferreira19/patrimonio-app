"use client";

// A PESQUISA GLOBAL (V4, REDESENHO.md §3.2): Ctrl K (ou Cmd K), ou a lupa.
// `<dialog>` nativo, como a Folha. O índice pede-se UMA vez, na primeira abertura.
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Home, Search, User, X } from "lucide-react";
import { buttonClass, cn } from "./ui";
import { procurar, type ItemPesquisa, type TipoResultado } from "@/lib/portfolio/pesquisa";

const ICONE: Record<TipoResultado, typeof Home> = { predio: Building2, fracao: Home, inquilino: User, documento: FileText };

export function Pesquisa({ compacta }: { compacta?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pedido = useRef(false);
  const id = useId();
  const [indice, setIndice] = useState<ItemPesquisa[] | null>(null);
  const [erro, setErro] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  function abrir() {
    ref.current?.showModal();
    setQ("");
    setSel(0);
    input.current?.focus();
    if (!indice && !pedido.current) {
      pedido.current = true;
      setErro(false);
      fetch("/api/pesquisa")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setIndice)
        .catch(() => setErro(true))
        .finally(() => { pedido.current = false; });
    }
  }

  // Há duas instâncias; só a visível responde ao atalho.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (window.matchMedia("(max-width: 767px)").matches !== !!compacta) return;
      if (document.querySelector("dialog[open], [aria-modal='true']")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const resultados = indice ? procurar(indice, q) : [];
  useEffect(() => {
    document.getElementById(`${id}-r-${sel}`)?.scrollIntoView({ block: "nearest" });
  }, [sel, id]);

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
        aria-label="Procurar na carteira"
        className={cn(
          "flex items-center gap-2 rounded-full border border-regua bg-papel text-[13px] text-tinta-3 transition-colors hover:border-regua-forte hover:text-tinta-2",
          compacta ? "size-11 justify-center" : "min-h-11 w-full justify-between px-3 py-2",
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
        aria-label="Pesquisa da carteira"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="mx-auto mt-[8vh] max-h-[84dvh] w-[min(560px,calc(100%-24px))] overflow-hidden rounded-2xl border border-regua bg-elevado p-0 text-tinta shadow-[0_24px_60px_-20px_rgba(15,21,23,0.45)] backdrop:bg-[rgba(15,21,23,0.35)] open:animate-modal-in"
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
              if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, Math.max(0, resultados.length - 1)));
              else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
              else if (e.key === "Enter" && resultados[sel]) ir(resultados[sel]);
              else return;
              e.preventDefault();
            }}
            placeholder="Fração, prédio, inquilino, NIF, documento…"
            aria-label="Procurar"
            role="combobox"
            aria-expanded={resultados.length > 0}
            aria-autocomplete="list"
            aria-controls={`${id}-lista`}
            aria-activedescendant={resultados[sel] ? `${id}-r-${sel}` : undefined}
            autoComplete="off"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tinta-3"
          />
          <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar pesquisa" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-vellum"><X size={18} /></button>
        </div>
        <p role="status" className="sr-only">{erro ? "Pesquisa indisponível" : !indice ? "A carregar pesquisa" : `${resultados.length} resultados`}</p>
        {erro && <div className="space-y-3 px-3 py-6 text-center"><p className="text-sm text-perda">Não foi possível carregar a pesquisa.</p><button type="button" onClick={abrir} className={buttonClass({ variant: "outline" })}>Tentar de novo</button></div>}
        <ul id={`${id}-lista`} aria-label="Resultados da pesquisa" className="max-h-[50dvh] overflow-y-auto overscroll-contain p-2" role="listbox">
          {!erro && !indice && <li role="presentation" className="px-3 py-6 text-center text-sm text-tinta-3">A carregar…</li>}
          {indice && q.trim() === "" && (
            <li role="presentation" className="px-3 py-6 text-center text-sm text-tinta-3">Escreve o nome de uma rua, de um inquilino ou de um documento.</li>
          )}
          {indice && q.trim() !== "" && resultados.length === 0 && (
            <li role="presentation" className="px-3 py-6 text-center text-sm text-tinta-3">Sem resultados. Experimenta uma parte do nome ou o artigo matricial.</li>
          )}
          {resultados.map((r, i) => {
            const Icone = ICONE[r.tipo];
            return (
              <li key={r.tipo + r.href + r.titulo} id={`${id}-r-${i}`} role="option" aria-selected={i === sel}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => ir(r)}
                  tabIndex={-1}
                  className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === sel && "bg-vellum")}
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
        <p className="border-t border-regua px-4 py-3 text-xs text-tinta-3">Setas para escolher · Enter para abrir · Esc para fechar</p>
      </dialog>
    </>
  );
}
