import { Carregar } from "@/components/documentos/carregar";
import { ListaDocumentos } from "@/components/documentos/lista";
import { Card } from "@/components/ui";
import type { DadosFracao } from "./dados";

export function DocumentosFracao({ dados: d }: { dados: DadosFracao }) {
  return <Card title="Documentos desta fração">
    {d.isAdmin && d.property.matriz_article && <div className="mb-4">
      <Carregar fracoes={[{ matriz: d.property.matriz_article, label: d.rotulo }]}
        destino={{ matriz: d.property.matriz_article, label: d.rotulo }} />
    </div>}
    {d.docsDaFracao.length === 0 ? <div className="vazio text-sm text-tinta-2">Nada arquivado nesta fração.</div>
      : <ListaDocumentos docs={d.docsDaFracao} isAdmin={d.isAdmin} />}
  </Card>;
}
