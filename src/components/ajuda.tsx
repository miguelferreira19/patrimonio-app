import Link from "next/link";
import { Folha } from "./folha";
import { DESTINOS, type DestinoHref } from "./destinos";

// Uma descrição por destino, indexada pelo href. É um `Record` da união literal de propósito:
// tirar ou acrescentar um destino em destinos.ts sem mexer aqui não compila, e foi assim que
// a Ajuda deixou de poder descrever uma navegação que já não existe (auditoria, ponto 14).
const DESCRICAO: Record<DestinoHref, string> = {
  "/": "O mês em curso repartido entre o que entrou, o que falta entrar e o que não se sabe. Por baixo, o que há a fazer este mês e os prazos.",
  "/cobrancas": "Quem deve, quanto e desde quando, por inquilino.",
  "/imoveis":
    "Os prédios, e dentro de cada um as frações. Filtra por atraso, recibos parados ou vagas. Daqui chega-se aos contratos, ao histórico mensal e ao arquivo de documentos.",
  "/rentabilidade": "O que rende e o que custa, por prédio e por fração. O Mercado e as Despesas estão em separadores.",
  "/impostos": "O IRS do ano, por senhorio: Anexo F, taxa do art. 72.º e AIMI.",
};

/** Só para administradores, por destino. Fica à parte da descrição que toda a gente vê. */
const SO_ADMIN: Partial<Record<DestinoHref, string>> = {
  "/rentabilidade": "A Projeção reúne cenários e conselhos.",
};

export function Ajuda({ admin }: { admin: boolean }) {
  return (
    <Folha rotulo="Ajuda" titulo="Orientação rápida" subtitulo="Da visão geral ao detalhe, em poucos passos.">
      <ol className="space-y-5 text-sm leading-relaxed">
        {DESTINOS.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="font-semibold text-acao">
              {d.label}
            </Link>
            <p className="mt-1 text-tinta-2">
              {DESCRICAO[d.href]}
              {admin && SO_ADMIN[d.href] ? ` ${SO_ADMIN[d.href]}` : ""}
            </p>
          </li>
        ))}
      </ol>
      <section className="mt-6 border-t border-regua pt-5 text-sm leading-relaxed">
        <h3 className="font-semibold">Como ler os estados</h3>
        <dl className="mt-3 space-y-3 text-tinta-2">
          <div><dt className="font-medium text-tinta">Pago</dt><dd>O mês tem recibo emitido, ou um pagamento registado à mão.</dd></div>
          <div><dt className="font-medium text-atencao">Em atraso</dt><dd>Um mês que já terminou sem recibo emitido. A lista de quem deve está em Cobranças.</dd></div>
          <div><dt className="font-medium text-tinta-2">Por receber</dt><dd>O mês em curso. Só passa a atraso depois de terminar.</dd></div>
          <div><dt className="font-medium text-futuro">Sem informação</dt><dd>Os recibos deixaram de ser emitidos (a herança do avô) ou ainda não foram importados. Não conta como pago nem como atraso.</dd></div>
          <div><dt className="font-medium text-atencao">Com vaga</dt><dd>Existe uma fração corrente sem contrato ativo.</dd></div>
        </dl>
      </section>
      {admin && <p className="mt-5 text-sm"><Link href="/saude" className="font-medium text-acao underline">Verificar os dados</Link> para encontrar fichas incompletas e situações a confirmar.</p>}
      <p className="mt-5 border-t border-regua pt-4 text-xs leading-relaxed text-tinta-3">Pesquisa: Ctrl K ou Cmd K. Usa as setas e Enter para abrir um resultado. Esc fecha a pesquisa ou uma folha. Tab percorre os controlos.</p>
    </Folha>
  );
}
