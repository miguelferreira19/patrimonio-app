import { Figure, Iniciais, Linha, Money, Tira } from "@/components/kit";
import { Badge } from "@/components/ui";
import { nomeProprio } from "@/lib/format";
import type { LinhaDeRenda } from "@/lib/portfolio/rendas";

function Motivo({ texto }: { texto: string }) {
  const peso = /^pesa (\d+)% da renda$/.exec(texto);
  return <Badge tone="futuro">{peso ? <>pesa <Figure value={Number(peso[1])} unit="%" escala="sm" /> da renda</> : texto}</Badge>;
}

export function LinhaDaRenda({ linha, registar, vigiar }: {
  linha: LinhaDeRenda; registar: boolean; vigiar: boolean;
}) {
  const atraso = linha.estado === "em_atraso";
  const nome = nomeProprio(linha.nome);
  return <Linha href={`/inquilinos/${encodeURIComponent(linha.chave)}${registar ? "?registar=1" : ""}`}
    tom={atraso ? "perda" : "tinta"}
    titulo={<span className="flex items-center gap-3">
      <Iniciais nome={nome} />
      <span className="min-w-0">
        <span className="block">{nome}</span>
        <span className="mt-0.5 block text-[13px] font-normal text-tinta-2">
          {linha.fracoes.length === 1 ? linha.fracoes[0] : `${linha.fracoes.length} frações`}
        </span>
      </span>
    </span>}
    valor={<span className="flex flex-col items-end gap-1">
      <Money value={atraso ? linha.valorEmAtraso : linha.rendaMensal} escala="lg" tom={atraso ? "perda" : "tinta"} />
      <span className="text-xs font-medium">{atraso
        ? `${linha.mesesEmAtraso} ${linha.mesesEmAtraso === 1 ? "mês" : "meses"}` : "por mês"}</span>
    </span>}>
    <Tira meses={linha.tira} tamanho="s" />
    {vigiar && linha.aVigiar.length > 0 && <span className="flex flex-wrap gap-1.5">
      {linha.aVigiar.map((motivo) => <Motivo key={motivo} texto={motivo} />)}
    </span>}
  </Linha>;
}
