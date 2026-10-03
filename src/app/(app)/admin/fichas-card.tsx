"use client";

// PREENCHER FICHAS EM LOTE (V3).
//
// Metade da análise de carteira está bloqueada por três campos que só existem na caderneta
// predial: sem `area_m2` não há €/m² contra o INE, não há valor estimado e não há yield —
// e sem isso não se pode responder "devo vender esta?" com números. A alternativa a este
// ecrã era abrir um formulário modal por fração, ~61 vezes.
//
// Uma tabela, um estado, um botão. O que ficar em branco não é enviado, e portanto nunca
// apaga o que já lá está: dá para preencher em várias sessões, à medida que as cadernetas
// aparecem.

import { useState } from "react";
import { preencherFichas } from "@/lib/actions/crud";
import { useAction } from "@/components/forms";
import { parseAmount } from "@/lib/parse";
import { Button, Card, Input, Table, Td, Th } from "@/components/ui";

export interface FichaPorPreencher {
  id: string;
  name: string;
  emFalta: string[];
  area_m2: number | null;
  typology: string | null;
  vpt: number | null;
}

type Rascunho = Record<string, { area?: string; typology?: string; vpt?: string }>;

export function FichasCard({ fichas }: { fichas: FichaPorPreencher[] }) {
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const { pending, error, run, setError } = useAction();

  if (fichas.length === 0) return null;

  function set(id: string, campo: "area" | "typology" | "vpt", valor: string) {
    setRascunho((r) => ({ ...r, [id]: { ...r[id], [campo]: valor } }));
  }

  const preenchidos = Object.values(rascunho).filter((r) =>
    [r.area, r.typology, r.vpt].some((v) => v && v.trim() !== ""),
  ).length;

  function guardar() {
    // `parseAmount` e não `Number(s.replace(",", "."))`: o VPT copia-se da caderneta como
    // "45.230,50" ou "45.230", e a versão antiga lia o primeiro como nada (a linha sumia
    // em silêncio) e o segundo como 45,23 €.
    const ilegiveis: string[] = [];
    const payload = Object.entries(rascunho)
      .map(([id, r]) => {
        const area_m2 = r.area?.trim() ? parseAmount(r.area) : null;
        const vpt = r.vpt?.trim() ? parseAmount(r.vpt) : null;
        if ((r.area?.trim() && area_m2 === null) || (r.vpt?.trim() && vpt === null)) {
          ilegiveis.push(fichas.find((f) => f.id === id)?.name ?? id);
        }
        return { id, area_m2, typology: r.typology?.trim() || null, vpt };
      })
      .filter((f) => f.area_m2 || f.typology || f.vpt);
    if (ilegiveis.length > 0) {
      setError(`Valores ilegíveis em: ${ilegiveis.join(", ")}. Escreve, por exemplo, 85 ou 45.230,50.`);
      return;
    }
    run(preencherFichas(payload), () => setRascunho({}));
  }

  return (
    <Card
      title="Fichas por preencher"
      subtitle={`${fichas.length} ${fichas.length === 1 ? "fração espera" : "frações esperam"} dados da caderneta predial. Enquanto faltarem, o valor estimado e o yield ficam por calcular.`}
      actions={
        <Button onClick={guardar} disabled={pending || preenchidos === 0}>
          {pending ? "A guardar…" : preenchidos === 0 ? "Guardar" : `Guardar ${preenchidos}`}
        </Button>
      }
    >
      {error && <p className="mb-3 text-sm text-perda">{error}</p>}
      <Table className="max-h-[28rem] overflow-y-auto">
        <thead>
          <tr>
            <Th>Fração</Th>
            <Th className="w-28">Área m²</Th>
            <Th className="w-28">Tipologia</Th>
            <Th className="w-32">VPT €</Th>
            <Th>Em falta</Th>
          </tr>
        </thead>
        <tbody>
          {fichas.map((f) => (
            <tr key={f.id}>
              <Td className="font-medium text-tinta">{f.name}</Td>
              <Td>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  aria-label={`Área de ${f.name}`}
                  defaultValue={f.area_m2 ?? ""}
                  onChange={(e) => set(f.id, "area", e.target.value)}
                  className="w-24 tabular-nums"
                />
              </Td>
              <Td>
                <Input
                  aria-label={`Tipologia de ${f.name}`}
                  placeholder="T2"
                  defaultValue={f.typology ?? ""}
                  onChange={(e) => set(f.id, "typology", e.target.value)}
                  className="w-24"
                />
              </Td>
              <Td>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  aria-label={`VPT de ${f.name}`}
                  defaultValue={f.vpt ?? ""}
                  onChange={(e) => set(f.id, "vpt", e.target.value)}
                  className="w-28 tabular-nums"
                />
              </Td>
              <Td className="text-xs text-tinta-3">{f.emFalta.join(", ")}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-tinta-3">
        A freguesia (código INE) não se escreve à mão: escolhe-se na ficha da fração, onde a lista
        do INE está disponível. Campos deixados em branco não são gravados.
      </p>
    </Card>
  );
}
