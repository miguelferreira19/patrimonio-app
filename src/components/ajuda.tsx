import Link from "next/link";
import { Folha } from "./folha";

export function Ajuda({ admin }: { admin: boolean }) {
  return (
    <Folha rotulo="Ajuda" titulo="Orientação rápida" subtitulo="Da visão geral ao detalhe, em poucos passos.">
      <ol className="space-y-5 text-sm leading-relaxed">
        <li><Link href="/" className="font-semibold text-acao">Hoje</Link><p className="mt-1 text-tinta-2">Consulta o mês em curso, as tarefas e os prazos. Os valores «por receber» ainda podem incluir rendas pagas cujo recibo não foi importado.</p></li>
        <li><Link href="/imoveis" className="font-semibold text-acao">Imóveis</Link><p className="mt-1 text-tinta-2">Filtra por atraso, recibos parados ou vagas. Abre um prédio e depois uma fração para consultar pagamentos, contrato e documentos.</p></li>
        <li><Link href="/dinheiro" className="font-semibold text-acao">Dinheiro</Link><p className="mt-1 text-tinta-2">Escolhe o ano e o senhorio no IRS. O Mercado compara rendas com o INE.{admin && " A Projeção reúne cenários e conselhos."}</p></li>
        <li><Link href="/arquivo" className="font-semibold text-acao">Arquivo</Link><p className="mt-1 text-tinta-2">Procura um documento pelo nome ou pela rua e abre-o. As cartas disponíveis estão no Contrato de cada fração.</p></li>
      </ol>
      <section className="mt-6 border-t border-regua pt-5 text-sm leading-relaxed">
        <h3 className="font-semibold">Como ler os estados</h3>
        <dl className="mt-3 space-y-3 text-tinta-2">
          <div><dt className="font-medium text-perda">Em atraso</dt><dd>Meses anteriores com dados conhecidos e rendas por liquidar. O valor deriva dos recibos, não de um extrato bancário.</dd></div>
          <div><dt className="font-medium text-futuro">Por saber</dt><dd>Faltam recibos importados. A app não transforma meses desconhecidos em dívida.</dd></div>
          <div><dt className="font-medium text-atencao">Com vaga</dt><dd>Existe uma fração corrente sem contrato ativo.</dd></div>
        </dl>
      </section>
      {admin && <p className="mt-5 text-sm"><Link href="/saude" className="font-medium text-acao underline">Verificar os dados</Link> para encontrar fichas incompletas e situações a confirmar.</p>}
      <p className="mt-5 border-t border-regua pt-4 text-xs leading-relaxed text-tinta-3">Pesquisa: Ctrl K ou Cmd K. Usa as setas e Enter para abrir um resultado. Esc fecha a pesquisa ou uma folha. Tab percorre os controlos.</p>
    </Folha>
  );
}
