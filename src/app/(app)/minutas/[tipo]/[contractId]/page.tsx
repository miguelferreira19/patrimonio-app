import Link from "next/link";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Assinaturas, PapelImpresso } from "@/components/papel-impresso";
import { getSession } from "@/lib/data";
import { fmtDate, todayISO } from "@/lib/format";
import { MINUTAS, isMinutaTipo } from "@/lib/minutas";
import type { Contract, Landlord, Property, PropertyOwner } from "@/lib/types";

export const dynamic = "force-dynamic";

// As minutas de correspondência (V3, 2026-07-30). O texto vive em `src/lib/minutas.ts`;
// aqui só se vão buscar os dados do contrato e se imprime.
//
// Ao contrário da carta de atualização de renda, estas NÃO exigem contrato ativo: uma
// revogação por acordo é assinada precisamente quando se está a fechar o contrato, e uma
// cessão pode ter de ser reconstituída depois do facto.

function NaoDisponivel({ propertyId, children }: { propertyId?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-tinta-3">
        <Link href="/documentos" className="hover:text-acao hover:underline">
          Documentos
        </Link>
        {propertyId && (
          <>
            <span className="mx-1.5 text-tinta-3">/</span>
            <Link href={`/fracoes/${propertyId}`} className="hover:text-acao hover:underline">
              Fração
            </Link>
          </>
        )}
        <span className="mx-1.5 text-tinta-3">/</span>
        Minuta
      </p>
      <Card title="Minuta">
        <EmptyState icon={TriangleAlert}>{children}</EmptyState>
      </Card>
    </div>
  );
}

export default async function MinutaPage({
  params,
}: {
  params: Promise<{ tipo: string; contractId: string }>;
}) {
  const { tipo, contractId } = await params;
  if (!isMinutaTipo(tipo)) {
    return <NaoDisponivel>Não conheço esta minuta.</NaoDisponivel>;
  }
  const spec = MINUTAS[tipo];

  const { supabase } = await getSession();
  const { data: contractData } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  const contract = contractData as Contract | null;
  if (!contract) {
    return <NaoDisponivel>Este contrato não existe ou foi removido.</NaoDisponivel>;
  }

  const [propQ, ownersQ, landlordsQ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", contract.property_id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", contract.property_id),
    supabase.from("landlords").select("*"),
  ]);

  const property = propQ.data as Property | null;
  if (!property) {
    return <NaoDisponivel>Não foi possível encontrar a fração associada a este contrato.</NaoDisponivel>;
  }

  // Mesma regra da carta de atualização: com vários titulares assina o de maior quota.
  // Não há outro critério de desempate, e inventar um seria pior do que assumir este.
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlordById = new Map(((landlordsQ.data ?? []) as Landlord[]).map((l) => [l.id, l]));
  const titular = owners.slice().sort((a, b) => b.quota - a.quota)[0];
  const landlord = titular ? landlordById.get(titular.landlord_id) : undefined;
  if (!landlord) {
    return (
      <NaoDisponivel propertyId={property.id}>
        Esta fração não tem senhorio associado. Associa um proprietário na ficha da fração antes de
        gerar a minuta.
      </NaoDisponivel>
    );
  }

  const morada =
    [property.address, property.postal_code, property.parish, property.municipality]
      .filter(Boolean)
      .join(", ") || property.name;

  const minuta = spec.construir({
    senhorio: landlord.name,
    senhorioNif: landlord.nif,
    inquilino: contract.tenant_name,
    inquilinoNif: contract.tenant_nif,
    morada,
    fracaoRef: property.address || property.name,
    contratoNo: contract.pf_contract_no,
    inicio: contract.start_date,
    renda: contract.rent,
    hoje: todayISO(),
  });

  return (
    <PapelImpresso
      migalhas={
        <>
          <Link href="/documentos" className="hover:text-acao hover:underline">
            Documentos
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/fracoes/${property.id}`} className="hover:text-acao hover:underline">
            {property.name}
          </Link>
          <span className="mx-1.5">/</span>
          {spec.label}
        </>
      }
    >
      <div>
        <p className="font-semibold">{landlord.name}</p>
        <p className="text-zinc-600">NIF {landlord.nif ?? "n/d"}</p>
      </div>

      <div className="mt-8">
        <p>Ex.mo(a) Senhor(a)</p>
        <p className="font-medium">{contract.tenant_name}</p>
        <p className="text-zinc-600">{morada}</p>
      </div>

      <p className="mt-8 font-semibold">Assunto: {minuta.assunto}</p>

      <div className="mt-6 space-y-4 leading-relaxed">
        {minuta.paragrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-12 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-zinc-500">Local</p>
          <div className="mt-6 h-px w-full bg-zinc-300" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Data</p>
          <p className="mt-1">{fmtDate(todayISO())}</p>
        </div>
      </div>

      <Assinaturas legendas={minuta.assinaturas} />

      <p className="mt-16 text-[10px] leading-snug text-zinc-400">
        {minuta.nota} Minuta gerada a partir dos dados do contrato ({spec.base}); confirmar prazos e
        enquadramento legal do contrato concreto antes de enviar. Este conteúdo não constitui
        aconselhamento jurídico vinculativo.
      </p>
    </PapelImpresso>
  );
}
