import { NextResponse } from "next/server";
import { carregarCarta, construirCarta, tipoDeCarta, type TipoDeCarta } from "@/components/cartas/dados";
import { rentUpdateEligibility } from "@/lib/calc";
import { getSession } from "@/lib/data";
import { criarDocx, nomeDeFicheiro, type DocxParagrafo } from "@/lib/docx";
import { mesPorExtenso, todayISO } from "@/lib/format";
import { MINUTAS, MINUTA_RENDA, isMinutaTipo, minutaAtualizacaoRenda, type Minuta, type MinutaDados } from "@/lib/minutas";
import type { Contract, Landlord, Property, PropertyOwner, RentUpdate, UpdateCoefficient } from "@/lib/types";
import { linha, linhas } from "@/lib/supabase/dados";

export const dynamic = "force-dynamic";
const LINHA_ASSINATURA = "________________________________________";
type Supabase = Awaited<ReturnType<typeof getSession>>["supabase"];

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
    { texto: `Data: ${Number(d.hoje.slice(8, 10))} de ${mesPorExtenso(d.hoje, true)}`, espacoDepois: 640 },
    ...m.assinaturas.flatMap((legenda) => [
      { texto: LINHA_ASSINATURA, espacoDepois: 0 }, { texto: legenda, espacoDepois: 560 },
    ]),
  ];
}

function documento(minuta: Minuta, dados: MinutaDados, etiqueta: string, fracao: string) {
  const ficheiro = criarDocx(montarFolha(minuta, dados));
  return new Response(new Uint8Array(ficheiro), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${nomeDeFicheiro([etiqueta, fracao, dados.hoje])}"`,
    "Content-Length": String(ficheiro.length), "Cache-Control": "no-store",
  } });
}

async function descarregarCarta(req: Request, tipo: TipoDeCarta, contractId: string) {
  const contexto = await carregarCarta(contractId);
  if (!contexto) return new Response("Contrato não encontrado.", { status: 404 });
  if (!contexto.dados) return new Response("Esta fração não tem senhorio associado.", { status: 409 });
  const query = new URL(req.url).searchParams;
  let minuta: Minuta;
  try {
    minuta = construirCarta(tipo, contexto.dados, {
      prestacoes: query.get("prestacoes") ?? undefined, primeira: query.get("primeira") ?? undefined,
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Plano inválido.", { status: 400 });
  }
  return documento(minuta, contexto.dados, MINUTAS[tipo].label, contexto.property.name);
}

async function contextoLegado(supabase: Supabase, contractId: string) {
  const contract = linha<Contract>(await supabase.from("contracts").select("*")
    .eq("id", contractId).maybeSingle(), "contracts");
  if (!contract) return new Response("Contrato não encontrado.", { status: 404 });
  const [propQ, ownersQ, landlordsQ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", contract.property_id).maybeSingle(),
    supabase.from("property_owners").select("*").eq("property_id", contract.property_id),
    supabase.from("landlords").select("*"),
  ]);
  const property = linha<Property>(propQ, "properties");
  if (!property) return new Response("Fração não encontrada.", { status: 404 });
  const owners = linhas<PropertyOwner>(ownersQ, "property_owners");
  const senhorios = new Map(linhas<Landlord>(landlordsQ, "landlords").map((l) => [l.id, l]));
  const titular = owners.slice().sort((a, b) => b.quota - a.quota)[0];
  const landlord = titular ? senhorios.get(titular.landlord_id) : undefined;
  if (!landlord) return new Response(
    "Esta fração não tem senhorio associado, por isso a carta ficaria sem remetente. " +
    "Associa um proprietário na ficha da fração e volta a tentar.", { status: 409 });
  const dados: MinutaDados = {
    senhorio: landlord.name, senhorioNif: landlord.nif,
    inquilino: contract.tenant_name, inquilinoNif: contract.tenant_nif,
    morada: [property.address, property.postal_code, property.parish, property.municipality]
      .filter(Boolean).join(", ") || property.name,
    fracaoRef: property.address || property.name, contratoNo: contract.pf_contract_no,
    inicio: contract.start_date, renda: contract.rent, hoje: todayISO(),
    fimContrato: contract.expected_end_date ?? contract.end_date, antecedenciaDias: contract.notice_days_landlord,
  };
  return { contract, property, dados };
}

async function construirRenda(supabase: Supabase, contract: Contract, dados: MinutaDados, req: Request) {
  const [updatesQ, coefQ] = await Promise.all([
    supabase.from("rent_updates").select("*").eq("contract_id", contract.id),
    supabase.from("update_coefficients").select("*"),
  ]);
  const coeficientes = linhas<UpdateCoefficient>(coefQ, "update_coefficients");
  const elegibilidade = rentUpdateEligibility(contract, linhas<RentUpdate>(updatesQ, "rent_updates"),
    coeficientes, todayISO());
  if (contract.status !== "ativo" || coeficientes.length === 0 || !elegibilidade.eligible ||
      elegibilidade.suggestedRent === null || !elegibilidade.eligibleSince) {
    return NextResponse.redirect(new URL(`/carta/${contract.id}`, req.url));
  }
  const ultimo = coeficientes.slice().sort((a, b) => b.year - a.year)[0];
  return minutaAtualizacaoRenda(dados, {
    ano: ultimo.year, coeficiente: ultimo.coefficient,
    novaRenda: elegibilidade.suggestedRent, desde: elegibilidade.eligibleSince,
  });
}

export async function GET(req: Request, { params }: {
  params: Promise<{ tipo: string; contractId: string }>;
}) {
  const { tipo, contractId } = await params;
  if (tipo !== "renda" && !isMinutaTipo(tipo)) return new Response("Minuta desconhecida.", { status: 404 });
  const { supabase, user } = await getSession();
  if (!user) return new Response("Sessão expirada.", { status: 403 });
  if (tipoDeCarta(tipo)) return descarregarCarta(req, tipo, contractId);
  const contexto = await contextoLegado(supabase, contractId);
  if (contexto instanceof Response) return contexto;
  const { contract, property, dados } = contexto;
  const minuta = tipo === "renda" ? await construirRenda(supabase, contract, dados, req) : MINUTAS[tipo].construir(dados);
  if (minuta instanceof Response) return minuta;
  return documento(minuta, dados, tipo === "renda" ? MINUTA_RENDA.label : MINUTAS[tipo].label, property.name);
}
