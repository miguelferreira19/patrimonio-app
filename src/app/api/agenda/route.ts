// A agenda em .ics, para importar no calendário do telemóvel (2026-10-03).
//
// Um descarregamento, não uma subscrição: um calendário subscrito pede o URL sem cookies,
// e esta rota exige sessão (são prazos e valores da família). Importa-se uma vez por ano,
// ou quando entrar uma atualização de renda nova; os UIDs são estáveis, por isso voltar a
// importar ATUALIZA os eventos em vez de os duplicar.
import { getSession } from "@/lib/data";
import { criarIcs } from "@/lib/ics";
import { getAgenda } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

/** Um ano: o ciclo fiscal inteiro, IRS e as três prestações do IMI incluídos. */
const DIAS = 366;

export async function GET(request: Request) {
  const { user } = await getSession();
  if (!user) return new Response("Sessão expirada.", { status: 403 });

  const { prazos } = await getAgenda(DIAS);
  const ics = criarIcs(prazos, new Date(), new URL(request.url).origin);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="patrimonio-prazos.ics"',
      "Cache-Control": "no-store",
    },
  });
}
