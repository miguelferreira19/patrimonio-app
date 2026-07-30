"use client";

// Largar ficheiros no arquivo. Vai DIRETO do browser para o Supabase Storage, sem passar
// por uma server action: uma action recebe o ficheiro no corpo do pedido e o Next corta
// em 1 MB por defeito, o que um contrato digitalizado ultrapassa sem esforço.
//
// Não é um buraco de segurança: a política `documentos_insert` do bucket exige
// `public.is_admin()`, por isso o Supabase recusa quem não é admin mesmo que chegue aqui.
//
// Aceita VÁRIOS ficheiros de uma vez porque o primeiro uso real é largar as 30 cadernetas
// prediais de uma assentada. Cada uma arquiva-se sozinha na sua fração: o nome do PDF é o
// artigo matricial (`escopoSugerido` em lib/documentos.ts).

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { BUCKET, GERAL, caminho, escopoSugerido } from "@/lib/documentos";

export interface FracaoOpcao {
  matriz: string;
  label: string;
}

type Estado = { nome: string; ok: boolean; onde: string; erro?: string };

export function Carregar({ fracoes }: { fracoes: FracaoOpcao[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // "" = deixar o nome do ficheiro decidir. É o que faz a diferença entre arquivar 30
  // cadernetas num gesto e escolher a fração 30 vezes.
  const [escopoFixo, setEscopoFixo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [resultados, setResultados] = useState<Estado[]>([]);

  const matrizes = fracoes.map((f) => f.matriz);
  const labelDe = new Map(fracoes.map((f) => [f.matriz, f.label]));

  async function receber(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAEnviar(true);
    setResultados([]);
    const supabase = createClient();
    const feitos: Estado[] = [];

    for (const file of Array.from(files)) {
      const escopo = escopoFixo || escopoSugerido(file.name, matrizes) || GERAL;
      const destino = caminho(escopo, file.name);
      const { error } = await supabase.storage.from(BUCKET).upload(destino, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      feitos.push({
        nome: file.name,
        ok: !error,
        onde: escopo === GERAL ? "Geral" : labelDe.get(escopo) ?? escopo,
        erro: error?.message,
      });
      setResultados([...feitos]);
    }

    setAEnviar(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <Card
      title="Arquivar documentos"
      subtitle="contratos, cadernetas, declarações, cartas assinadas; até 25 MB por ficheiro"
    >
      <div className="space-y-3">
        <Select value={escopoFixo} onChange={(e) => setEscopoFixo(e.target.value)}>
          <option value="">Adivinhar a fração pelo nome do ficheiro</option>
          <option value={GERAL}>Geral (carteira toda)</option>
          {fracoes.map((f) => (
            <option key={f.matriz} value={f.matriz}>
              {f.label}
            </option>
          ))}
        </Select>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void receber(e.dataTransfer.files);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-regua-forte px-4 py-8 text-center transition-colors hover:border-acao hover:bg-acao-tenue"
        >
          <FileUp size={20} strokeWidth={1.5} className="text-tinta-3" />
          <span className="text-sm text-tinta-2">
            {aEnviar ? "A carregar…" : "Larga aqui os ficheiros, ou clica para escolher"}
          </span>
          <span className="text-xs text-tinta-3">
            Um PDF chamado 182341-U-5077-A.pdf arquiva-se sozinho na fração desse artigo
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            disabled={aEnviar}
            onChange={(e) => void receber(e.target.files)}
          />
        </label>

        {resultados.length > 0 && (
          <ul className="space-y-1 text-xs">
            {resultados.map((r, i) => (
              <li key={i} className={r.ok ? "text-tinta-2" : "text-perda"}>
                {r.ok ? `${r.nome} · arquivado em ${r.onde}` : `${r.nome} · ${r.erro}`}
              </li>
            ))}
            {!aEnviar && (
              <li className="pt-1">
                <Button variant="ghost" size="sm" onClick={() => setResultados([])}>
                  Limpar
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}
