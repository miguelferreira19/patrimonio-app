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
import { Select, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { BUCKET, GERAL, caminho, escopoSugerido } from "@/lib/documentos";

export interface FracaoOpcao {
  matriz: string;
  label: string;
}

type Estado = { nome: string; ok: boolean; onde: string; erro?: string };

/**
 * `destino` fixa o escopo e esconde o seletor: é a tira que vive DENTRO da fração já
 * escolhida, onde perguntar outra vez "para que fração?" seria perguntar o que o
 * utilizador acabou de responder. Sem `destino` é a tira do arquivo geral, com o seletor
 * e o palpite pelo nome do ficheiro (as 30 cadernetas de uma assentada).
 */
export function Carregar({
  fracoes,
  destino,
}: {
  fracoes: FracaoOpcao[];
  destino?: FracaoOpcao;
}) {
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
      const escopo = destino?.matriz || escopoFixo || escopoSugerido(file.name, matrizes) || GERAL;
      const chave = caminho(escopo, file.name);
      const { error } = await supabase.storage.from(BUCKET).upload(chave, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      feitos.push({
        nome: file.name,
        ok: !error,
        onde: escopo === GERAL ? "Geral" : labelDe.get(escopo) ?? destino?.label ?? escopo,
        erro: error?.message,
      });
      setResultados([...feitos]);
    }

    setAEnviar(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  // Uma TIRA, não um cartão com uma zona de largar do tamanho de meia página: arquivar é
  // esporádico (as cadernetas entram uma vez, os contratos a conta-gotas) e não pode ser a
  // primeira coisa que se vê numa página que serve sobretudo para ler. Continua a aceitar
  // ficheiros largados em cima dela, que é como as 30 cadernetas entram de uma vez.
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void receber(e.dataTransfer.files);
      }}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {!destino && (
          <Select
            value={escopoFixo}
            onChange={(e) => setEscopoFixo(e.target.value)}
            className="h-8 min-w-0 flex-1 text-xs"
          >
            <option value="">Adivinhar a fração pelo nome do ficheiro</option>
            <option value={GERAL}>Geral (carteira toda)</option>
            {fracoes.map((f) => (
              <option key={f.matriz} value={f.matriz}>
                {f.label}
              </option>
            ))}
          </Select>
        )}

        <label className={buttonClass({ variant: "outline", size: "sm", className: "cursor-pointer" })}>
          <FileUp size={14} strokeWidth={1.75} />
          {aEnviar ? "A carregar…" : "Arquivar ficheiros"}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            disabled={aEnviar}
            onChange={(e) => void receber(e.target.files)}
          />
        </label>
      </div>

      {resultados.length === 0 ? (
        <p className="text-[11px] text-tinta-3">
          {destino
            ? `Também podes largar aqui os ficheiros. Ficam arquivados em ${destino.label}.`
            : "Também podes largar aqui os ficheiros. Um PDF chamado 182341-U-5077-A.pdf arquiva-se sozinho na fração desse artigo."}
        </p>
      ) : (
        <ul className="space-y-0.5 text-[11px]">
          {resultados.map((r, i) => (
            <li key={i} className={r.ok ? "text-tinta-3" : "text-perda"}>
              {r.ok ? `${r.nome} · ${r.onde}` : `${r.nome} · ${r.erro}`}
            </li>
          ))}
          {!aEnviar && (
            <li>
              <button
                type="button"
                onClick={() => setResultados([])}
                className="text-tinta-3 underline hover:text-tinta-2"
              >
                Limpar
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
