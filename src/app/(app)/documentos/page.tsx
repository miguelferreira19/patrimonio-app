import { FolderOpen, TriangleAlert } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Carregar, type FracaoOpcao } from "@/components/documentos/carregar";
import { EscolherMinuta, type ContratoOpcao } from "@/components/documentos/acoes";
import { ListaDocumentos, lerArquivo } from "@/components/documentos/lista";
import { getSession } from "@/lib/data";
import { GERAL } from "@/lib/documentos";
import type { Contract, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

// O ARQUIVO (V3, 2026-07-30). Duas coisas, e só duas:
//
//   1. as CARTAS que a app escreve, escolhida a fração uma vez;
//   2. os papéis da carteira INTEIRA (declarações de IRS, correspondência da família).
//
// O que é de UMA fração (caderneta predial, contrato de arrendamento) NÃO aparece aqui:
// aparece na ficha dessa fração, que é onde se vai procurá-lo. Esta página chegou a listar
// tudo, uma caixa por fração, e eram cinquenta caixas a descer pelo ecrã abaixo para
// encontrar um PDF que já tem um sítio natural.

export default async function DocumentosPage() {
  const { supabase, isAdmin } = await getSession();

  const [propsQ, contratosQ, arquivo] = await Promise.all([
    supabase.from("properties").select("*").order("name"),
    supabase.from("contracts").select("*"),
    lerArquivo(supabase),
  ]);

  const properties = (propsQ.data ?? []) as Property[];
  const contracts = (contratosQ.data ?? []) as Contract[];
  const propById = new Map(properties.map((p) => [p.id, p]));
  const matrizesConhecidas = new Set(
    properties.map((p) => p.matriz_article).filter(Boolean) as string[],
  );

  const fracoes: FracaoOpcao[] = properties
    .filter((p) => p.matriz_article)
    .map((p) => ({ matriz: p.matriz_article!, label: `${p.name} · ${p.matriz_article}` }));

  const contratos: ContratoOpcao[] = contracts
    .filter((c) => c.status === "ativo")
    .map((c) => ({
      id: c.id,
      label: `${propById.get(c.property_id)?.name ?? "Fração"} · ${c.tenant_name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));

  // Geral, mais o que ficou arquivado num artigo matricial que nenhuma fração tem. Esses
  // órfãos não podem viver só na ficha de uma fração que não existe: desapareciam.
  const gerais = arquivo.docs.filter(
    (d) => d.escopo === GERAL || !matrizesConhecidas.has(d.escopo),
  );
  const porFracao = arquivo.docs.length - gerais.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documentos"
        description="As cartas que a app escreve e os papéis da carteira inteira. O que é de uma fração está na ficha dela."
      />

      {arquivo.erro && (
        <Card title="Falta criar o arquivo">
          <EmptyState icon={TriangleAlert}>
            O bucket <code className="font-mono">documentos</code> ainda não existe. Colar no SQL
            Editor do Supabase o bloco &quot;V3 · DOCUMENTOS&quot; do fim de{" "}
            <code className="font-mono">supabase/schema.sql</code>.
          </EmptyState>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cartas" subtitle="escolhe a fração e descarrega em Word, já preenchido">
          <EscolherMinuta contratos={contratos} />
        </Card>

        <Card
          title="Geral"
          subtitle={
            porFracao > 0
              ? `papéis da carteira inteira · ${porFracao} documentos estão nas fichas das frações`
              : "papéis da carteira inteira: declarações de IRS, correspondência"
          }
        >
          {isAdmin && !arquivo.erro && (
            <div className="mb-3 border-b border-regua pb-3">
              <Carregar fracoes={fracoes} />
            </div>
          )}
          {gerais.length === 0 ? (
            <EmptyState icon={FolderOpen}>
              {isAdmin
                ? "Nada arquivado em Geral. As declarações de IRS entram aqui."
                : "O administrador ainda não arquivou nada aqui."}
            </EmptyState>
          ) : (
            <ListaDocumentos docs={gerais} isAdmin={isAdmin} />
          )}
        </Card>
      </div>
    </div>
  );
}
