"use client";

// Largar o ListaRecibos.xlsx e ver o DIFF antes de escrever (PLANO.md §11, passo 3).
//
// Substitui o wizard de 766 linhas com 5 passos e mapeamento manual de colunas. As
// colunas do Portal são fixas, por isso reconhecem-se sozinhas com o `guessHeader` que já
// existia — e o passo que restava, "confirmar o que vai acontecer", é o único que
// interessava.
//
// Nada aqui decide o que é importado: o componente lê o ficheiro, mostra o plano que o
// SERVIDOR devolveu, e no fim manda as mesmas linhas de volta. O servidor recalcula tudo.

import { useState } from "react";
import { FileUp } from "lucide-react";
import { useAction } from "@/components/forms";
import { Button, Card, Select } from "@/components/ui";
import { Money } from "@/components/kit";
import { aplicarImport, preverImport } from "@/lib/actions/importar";
import { parseSpreadsheetFile } from "@/lib/spreadsheet";
import { guessHeader, parseAmount, parseDateISO } from "@/lib/parse";
import type { LinhaRecibo, PlanoDeImportacao } from "@/lib/import/plano";
import { resumirPlano } from "@/lib/import/plano";
import { fmtEur } from "@/lib/format";

export function LargarFicheiro({
  landlords,
}: {
  landlords: Array<{ id: string; name: string }>;
}) {
  const { pending, error, run } = useAction();
  const [landlordId, setLandlordId] = useState(landlords[0]?.id ?? "");
  const [linhas, setLinhas] = useState<LinhaRecibo[] | null>(null);
  const [plano, setPlano] = useState<PlanoDeImportacao | null>(null);
  const [aLer, setALer] = useState(false);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function receber(file: File) {
    setALer(true);
    setErroLeitura(null);
    setPlano(null);
    setFeito(null);
    try {
      const sheet = await parseSpreadsheetFile(file);
      const h = sheet.headers;
      const col = {
        nContrato: guessHeader(h, ["n.º de contrato", "nº de contrato", "contrato"]),
        nRecibo: guessHeader(h, ["n.º de recibo", "nº de recibo", "recibo"]),
        matriz: guessHeader(h, ["imóvel", "imovel"]),
        locatario: guessHeader(h, ["locatário", "locatario", "inquilino"]),
        dataInicio: guessHeader(h, ["data de início", "data de inicio", "início", "inicio"]),
        dataFim: guessHeader(h, ["data de fim", "fim"]),
        dataRecibo: guessHeader(h, ["data de recebimento", "data do recibo", "recebimento"]),
        valor: guessHeader(h, ["valor"]),
        recebida: guessHeader(h, ["importância recebida", "importancia recebida", "recebida"]),
        estado: guessHeader(h, ["estado"]),
      };
      const emFalta = (["nContrato", "nRecibo", "matriz", "valor"] as const).filter(
        (k) => !col[k],
      );
      if (emFalta.length > 0) {
        throw new Error(
          `Não reconheci as colunas: ${emFalta.join(", ")}. É mesmo o ListaRecibos do Portal?`,
        );
      }

      const lidas: LinhaRecibo[] = sheet.rows.map((r) => ({
        nContrato: String(r[col.nContrato] ?? "").trim(),
        nRecibo: String(r[col.nRecibo] ?? "").trim(),
        matriz: String(r[col.matriz] ?? "").trim(),
        locatario: col.locatario ? String(r[col.locatario] ?? "").trim() : null,
        dataInicio: parseDateISO(r[col.dataInicio]),
        dataFim: parseDateISO(r[col.dataFim]),
        dataRecibo: col.dataRecibo ? parseDateISO(r[col.dataRecibo]) : null,
        valor: parseAmount(r[col.valor]),
        importanciaRecebida: col.recebida ? parseAmount(r[col.recebida]) : null,
        estado: col.estado ? String(r[col.estado] ?? "").trim() : "Emitido",
      }));

      setLinhas(lidas);
      const res = await preverImport(lidas);
      if (!res.ok) throw new Error(res.error);
      setPlano(res.plano ?? null);
    } catch (e) {
      setErroLeitura(e instanceof Error ? e.message : "Não consegui ler o ficheiro.");
    } finally {
      setALer(false);
    }
  }

  return (
    <Card
      title="Importar recibos do Portal"
      subtitle="larga o ListaRecibos.xlsx; nada é escrito antes de confirmares"
    >
      <div className="space-y-3">
        {landlords.length > 1 && (
          <Select value={landlordId} onChange={(e) => setLandlordId(e.target.value)}>
            {landlords.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void receber(f);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-regua-forte px-4 py-8 text-center transition-colors hover:border-acao hover:bg-acao-tenue"
        >
          <FileUp size={20} strokeWidth={1.5} className="text-tinta-3" />
          <span className="text-sm text-tinta-2">
            {aLer ? "A ler o ficheiro…" : "Larga aqui o ficheiro, ou clica para escolher"}
          </span>
          <span className="text-xs text-tinta-3">.xlsx ou .csv exportado do Portal das Finanças</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void receber(f);
            }}
          />
        </label>

        {erroLeitura && <p className="text-sm text-perda">{erroLeitura}</p>}
        {error && <p className="text-sm text-perda">{error}</p>}
        {feito && <p className="text-sm text-tinta">{feito}</p>}

        {plano && (
          <div className="space-y-3 rounded-xl border border-regua p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-medium text-tinta">{resumirPlano(plano)}</p>
              {plano.totalNovos > 0 && <Money value={plano.totalNovos} escala="sm" />}
            </div>

            {plano.divergencias.length > 0 && (
              <details className="text-xs text-tinta-2">
                <summary className="cursor-pointer text-atencao">
                  {plano.divergencias.length} recibos com valor diferente do que está na base
                </summary>
                <ul className="mt-1.5 space-y-0.5 font-mono">
                  {plano.divergencias.slice(0, 20).map((d) => (
                    <li key={d.receipt_number}>
                      {d.receipt_number}: base {fmtEur(d.valorNaBase, 2)} · ficheiro{" "}
                      {fmtEur(d.valorNoFicheiro, 2)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 font-sans">
                  Nenhum destes é escrito. O import nunca sobrepõe o que já existe — se o
                  ficheiro estiver certo, corrige na base à mão.
                </p>
              </details>
            )}

            {plano.matrizesDesconhecidas.length > 0 && (
              <details className="text-xs text-tinta-2">
                <summary className="cursor-pointer text-atencao">
                  {plano.matrizesDesconhecidas.length} matrizes que a app não conhece
                </summary>
                <p className="mt-1.5">
                  Os recibos entram sem fração associada e aparecem como órfãos até criares a
                  fração. O import NÃO cria frações sozinho, de propósito.
                </p>
                <ul className="mt-1.5 space-y-0.5 font-mono">
                  {plano.matrizesDesconhecidas.slice(0, 20).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </details>
            )}

            {plano.invalidas.length > 0 && (
              <details className="text-xs text-tinta-2">
                <summary className="cursor-pointer">
                  {plano.invalidas.length} linhas que não consegui ler
                </summary>
                <ul className="mt-1.5 space-y-0.5">
                  {plano.invalidas.slice(0, 20).map((i) => (
                    <li key={i.linha}>
                      linha {i.linha}: {i.porque}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap gap-2 border-t border-regua pt-3">
              <Button
                disabled={pending || plano.novos.length === 0 || !landlordId}
                onClick={() =>
                  run(aplicarImport({ landlord_id: landlordId, linhas: linhas ?? [] }), () => {
                    setFeito(`${plano.novos.length} recibos importados.`);
                    setPlano(null);
                    setLinhas(null);
                  })
                }
              >
                {pending
                  ? "A importar…"
                  : `Importar ${plano.novos.length} ${plano.novos.length === 1 ? "recibo" : "recibos"}`}
              </Button>
              <Button variant="ghost" onClick={() => setPlano(null)} disabled={pending}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
