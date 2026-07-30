// Descarregar uma minuta em .docx (2026-07-30).
//
// Substitui a página HTML que existia em `/minutas/[tipo]/[contractId]`: o fluxo era abrir
// o site, imprimir para PDF e depois não conseguir mexer no texto. Uma carta destas quase
// nunca sai como está — falta o mês em dívida, a data de entrega, o IBAN — por isso o que
// serve é um ficheiro editável.
//
// Route handler e não server action porque o download é um `<a href>` simples: sem JS de
// cliente, sem base64, sem estado. O .docx é escrito à mão em `lib/docx.ts`, sem
// dependências novas.
//
// A carta de atualização de renda entra aqui como `tipo=renda`. Quando o contrato ainda
// não é elegível não há carta para escrever, e a resposta é um redirect para
// `/carta/[id]`, que é a página que explica PORQUÊ.

import { NextResponse } from "next/server";
import { rentUpdateEligibility } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { criarDocx, nomeDeFicheiro, type DocxParagrafo } from "@/lib/docx";
import { todayISO } from "@/lib/format";
import {
  MINUTAS,
  MINUTA_RENDA,
  isMinutaTipo,
  minutaAtualizacaoRenda,
  type Minuta,
  type MinutaDados,
} from "@/lib/minutas";
import type {
  Contract,
  Landlord,
  Property,
  PropertyOwner,
  RentUpdate,
  UpdateCoefficient,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const LINHA_ASSINATURA = "________________________________________";

/** A folha inteira, em parágrafos: remetente, destinatário, assunto, corpo, assinaturas. */
function montarFolha(m: Minuta, d: MinutaDados): DocxParagrafo[] {
  return [
    { texto: d.senhorio, negrito: true, espacoDepois: 0 },
    { texto: `NIF ${d.senhorioNif ?? "________"}`, espacoDepois: 480 },
    { texto: "Ex.mo(a) Senhor(a)", espacoDepois: 0 },
    { texto: d.inquilino, negrito: true, espacoDepois: 0 },
    { texto: d.morada, espacoDepois: 480 },
    { texto: `Assunto: ${m.assunto}`, negrito: true, espacoDepois: 320 },
    ...m.paragrafos.map((p) => ({ texto: p })),
    { texto: `Local: ${LINHA_ASSINATURA}`, espacoDepois: 160 },
    { texto: `Data: ${new Date(d.hoje).toLocaleDateString("pt-PT")}`, espacoDepois: 640 },
    ...m.assinaturas.flatMap((legenda) => [
      { texto: LINHA_ASSINATURA, espacoDepois: 0 },
      { texto: legenda, espacoDepois: 560 },
    ]),
    {
      texto:
        `${m.nota} Minuta gerada a partir dos dados do contrato. Confirmar prazos e ` +
        `enquadramento legal do contrato concreto antes de enviar; não constitui ` +
        `aconselhamento jurídico vinculativo.`,
    },
  ];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tipo: string; contractId: string }> },
) {
  const { tipo, contractId } = await params;
  const ehRenda = tipo === "renda";
  if (!ehRenda && !isMinutaTipo(tipo)) {
    return new Response("Minuta desconhecida.", { status: 404 });
  }

  const { supabase, user } = await getSession();
  if (!user) return new Response("Sessão expirada.", { status: 403 });

  const { data: contractData } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  const contract = contractData as Contract | null;
  if (!contract) return new Response("Contrato não encontrado.", { status: 404 });

  const [propQ, ownersQ, landlordsQ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", contract.property_id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", contract.property_id),
    supabase.from("landlords").select("*"),
  ]);

  const property = propQ.data as Property | null;
  if (!property) return new Response("Fração não encontrada.", { status: 404 });

  // Mesma regra da página da carta: com vários titulares assina o de maior quota. Não há
  // outro critério de desempate, e inventar um seria pior do que assumir este.
  const owners = (ownersQ.data ?? []) as PropertyOwner[];
  const landlordById = new Map(((landlordsQ.data ?? []) as Landlord[]).map((l) => [l.id, l]));
  const titular = owners.slice().sort((a, b) => b.quota - a.quota)[0];
  const landlord = titular ? landlordById.get(titular.landlord_id) : undefined;
  if (!landlord) {
    return new Response(
      "Esta fração não tem senhorio associado, por isso a carta ficaria sem remetente. " +
        "Associa um proprietário na ficha da fração e volta a tentar.",
      { status: 409 },
    );
  }

  const dados: MinutaDados = {
    senhorio: landlord.name,
    senhorioNif: landlord.nif,
    inquilino: contract.tenant_name,
    inquilinoNif: contract.tenant_nif,
    morada:
      [property.address, property.postal_code, property.parish, property.municipality]
        .filter(Boolean)
        .join(", ") || property.name,
    fracaoRef: property.address || property.name,
    contratoNo: contract.pf_contract_no,
    inicio: contract.start_date,
    renda: contract.rent,
    hoje: todayISO(),
  };

  let minuta: Minuta;
  let etiqueta: string;

  if (ehRenda) {
    const [updatesQ, coefQ] = await Promise.all([
      supabase.from("rent_updates").select("*").eq("contract_id", contract.id),
      supabase.from("update_coefficients").select("*"),
    ]);
    const coeficientes = (coefQ.data ?? []) as UpdateCoefficient[];
    const elegibilidade = rentUpdateEligibility(
      contract,
      (updatesQ.data ?? []) as RentUpdate[],
      coeficientes,
      todayISO(),
    );
    // Sem carta possível: a página explica se falta o coeficiente do ano, se o contrato
    // está cessado ou se ainda não passou o ano desde a última atualização.
    if (
      contract.status !== "ativo" ||
      coeficientes.length === 0 ||
      !elegibilidade.eligible ||
      elegibilidade.suggestedRent === null ||
      !elegibilidade.eligibleSince
    ) {
      return NextResponse.redirect(new URL(`/carta/${contract.id}`, _req.url));
    }
    const ultimo = coeficientes.slice().sort((a, b) => b.year - a.year)[0];
    minuta = minutaAtualizacaoRenda(dados, {
      ano: ultimo.year,
      coeficiente: ultimo.coefficient,
      novaRenda: elegibilidade.suggestedRent,
      desde: elegibilidade.eligibleSince,
    });
    etiqueta = MINUTA_RENDA.label;
  } else {
    const spec = MINUTAS[tipo];
    minuta = spec.construir(dados);
    etiqueta = spec.label;
  }

  const ficheiro = criarDocx(montarFolha(minuta, dados));
  return new Response(new Uint8Array(ficheiro), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nomeDeFicheiro([etiqueta, property.name, todayISO()])}"`,
      "Content-Length": String(ficheiro.length),
      "Cache-Control": "no-store",
    },
  });
}
