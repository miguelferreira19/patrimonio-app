// MINUTAS de correspondência do senhorio. Módulo PURO: texto, nada de I/O nem de React.
//
// Porquê aqui e não dentro da página: o texto de uma minuta é conhecimento de domínio com
// artigos do Código Civil lá dentro, e vai ser lido e corrigido por quem percebe de
// arrendamento, não por quem percebe de JSX. Separado, lê-se de uma sentada.
//
// A carta de atualização de renda NÃO está aqui: essa depende do coeficiente do ano e da
// elegibilidade, tem cálculo próprio, e já vive em `/carta/[contractId]`. Estas quatro são
// as que um senhorio precisa e a app não tinha.
//
// Todas saem com espaços em branco onde a app não sabe (o novo arrendatário de uma cessão,
// os meses em dívida). Preencher à mão é honesto; inventar um número numa carta que produz
// efeitos jurídicos não é.

import { fmtDate, fmtEur } from "./format";

export type MinutaTipo = "cessao" | "oposicao" | "interpelacao" | "revogacao";

export interface MinutaDados {
  senhorio: string;
  senhorioNif: string | null;
  inquilino: string;
  inquilinoNif: string | null;
  /** Morada completa da fração, para identificar o locado. */
  morada: string;
  /** Referência curta da fração (morada ou nome), para o assunto. */
  fracaoRef: string;
  contratoNo: string | null;
  inicio: string | null;
  renda: number;
  /** Hoje, ISO. */
  hoje: string;
}

export interface Minuta {
  assunto: string;
  paragrafos: string[];
  /** Legendas das linhas de assinatura, na ordem em que saem na folha. */
  assinaturas: string[];
  /** Aviso legal específico desta minuta (prazos, condições). */
  nota: string;
}

export interface MinutaSpec {
  label: string;
  /** Uma linha, para o cartão de escolha. */
  descricao: string;
  /** Base legal, mostrada no ecrã (não na carta impressa). */
  base: string;
  construir(d: MinutaDados): Minuta;
}

const LINHA = "________________________";

/** "com o n.º 123456 no Portal das Finanças, " ou nada. Repete-se nas quatro minutas. */
function refContrato(d: MinutaDados): string {
  return d.contratoNo ? `, com o n.º ${d.contratoNo} no Portal das Finanças,` : "";
}

function identificaLocado(d: MinutaDados): string {
  const desde = d.inicio ? ` e com início em ${fmtDate(d.inicio)}` : "";
  return (
    `contrato de arrendamento da fração sita em ${d.morada}${refContrato(d)}` +
    `${desde}, cuja renda mensal em vigor é de ${fmtEur(d.renda, 2)}`
  );
}

export const MINUTAS: Record<MinutaTipo, MinutaSpec> = {
  // ----------------------------------------------------------------
  cessao: {
    label: "Cessão da posição contratual",
    descricao: "O arrendatário sai e outra pessoa entra no mesmo contrato, com o acordo do senhorio.",
    base: "Artigos 424.º e seguintes, 1038.º alínea f) e 1059.º n.º 2 do Código Civil",
    construir: (d) => ({
      assunto: `Cessão da posição contratual no arrendamento da fração ${d.fracaoRef}`,
      paragrafos: [
        `Entre ${d.senhorio}, NIF ${d.senhorioNif ?? LINHA}, na qualidade de SENHORIO, ` +
          `${d.inquilino}, NIF ${d.inquilinoNif ?? LINHA}, na qualidade de CEDENTE, e ` +
          `${LINHA}, NIF ${LINHA}, na qualidade de CESSIONÁRIO, é celebrado o presente acordo.`,
        `Primeiro. O CEDENTE é arrendatário no ${identificaLocado(d)}.`,
        `Segundo. Pelo presente acordo, o CEDENTE cede ao CESSIONÁRIO a sua posição contratual ` +
          `naquele contrato, com efeitos a partir de ${LINHA}, transmitindo-lhe todos os direitos ` +
          `e obrigações que dele emergem.`,
        `Terceiro. O SENHORIO autoriza expressamente a cessão, nos termos exigidos pela alínea f) ` +
          `do artigo 1038.º e pelo n.º 2 do artigo 1059.º do Código Civil, sem o que a cessão lhe ` +
          `seria ineficaz.`,
        `Quarto. O CESSIONÁRIO declara conhecer e aceitar integralmente o contrato cedido, ` +
          `mantendo-se inalterados a renda, o prazo e as demais condições nele fixadas.`,
        `Quinto. As rendas vencidas e não pagas até à data da cessão, bem como quaisquer outras ` +
          `obrigações já vencidas, continuam a ser da responsabilidade do CEDENTE.`,
        `Sexto. A caução prestada, no valor de ${LINHA}, ${LINHA} (transmite-se ao CESSIONÁRIO ` +
          `ou é devolvida ao CEDENTE, conforme o que as partes acordarem).`,
        `Sétimo. O presente acordo é comunicado ao Portal das Finanças, com atualização do ` +
          `contrato de arrendamento e emissão dos recibos subsequentes em nome do CESSIONÁRIO.`,
      ],
      assinaturas: ["O Senhorio", "O Cedente (arrendatário atual)", "O Cessionário (novo arrendatário)"],
      nota:
        "Sem autorização escrita do senhorio a cessão é ineficaz perante ele. Depois de assinada, " +
        "atualizar o contrato no Portal das Finanças, senão os recibos continuam a sair em nome de " +
        "quem já saiu.",
    }),
  },

  // ----------------------------------------------------------------
  oposicao: {
    label: "Oposição à renovação",
    descricao: "Comunicação do senhorio a impedir que o contrato se renove no fim do prazo.",
    base: "Artigo 1097.º do Código Civil",
    construir: (d) => ({
      assunto: `Oposição à renovação do contrato de arrendamento da fração ${d.fracaoRef}`,
      paragrafos: [
        `Ex.mo(a) Senhor(a) ${d.inquilino},`,
        `Na qualidade de senhorio no ${identificaLocado(d)}, venho comunicar a minha OPOSIÇÃO À ` +
          `RENOVAÇÃO do referido contrato, nos termos do artigo 1097.º do Código Civil.`,
        `Em consequência, o contrato cessa os seus efeitos em ${LINHA}, data em que deverá ` +
          `entregar o locado livre de pessoas e bens, no estado em que o recebeu, salvo as ` +
          `deteriorações inerentes a uma utilização normal.`,
        `A presente comunicação é feita com a antecedência legalmente exigida face ao termo do ` +
          `prazo em curso.`,
        `Até à data da entrega mantém-se a obrigação de pagamento pontual da renda, bem como dos ` +
          `encargos que sejam da sua responsabilidade.`,
        `Solicita-se que confirme a receção da presente comunicação e que acorde comigo a data e a ` +
          `hora da entrega das chaves e da vistoria do locado.`,
        `Com os melhores cumprimentos,`,
      ],
      assinaturas: ["O Senhorio"],
      nota:
        "A antecedência depende da duração do contrato (artigo 1097.º n.º 1): 240 dias se o prazo " +
        "for igual ou superior a seis anos, 120 dias entre um e seis anos, 60 dias entre seis meses " +
        "e um ano. O senhorio não pode opor-se à renovação antes de decorridos três anos sobre o " +
        "início do contrato (n.º 3). Enviar por carta registada com aviso de receção.",
    }),
  },

  // ----------------------------------------------------------------
  interpelacao: {
    label: "Interpelação por rendas em atraso",
    descricao: "Aviso formal de rendas não pagas, com o prazo e as consequências.",
    base: "Artigos 1041.º, 1083.º n.º 3 e 1084.º n.º 3 do Código Civil",
    construir: (d) => ({
      assunto: `Rendas em atraso no arrendamento da fração ${d.fracaoRef}`,
      paragrafos: [
        `Ex.mo(a) Senhor(a) ${d.inquilino},`,
        `Na qualidade de senhorio no ${identificaLocado(d)}, venho por este meio interpelá-lo(a) ` +
          `para o pagamento das rendas vencidas e não pagas.`,
        `Encontram-se em dívida as rendas dos meses de ${LINHA}, no valor total de ${LINHA}, a que ` +
          `acresce a indemnização de 20% sobre o valor em dívida prevista no n.º 1 do artigo 1041.º ` +
          `do Código Civil.`,
        `Fica desde já notificado(a) de que dispõe do prazo legal para proceder ao pagamento ` +
          `integral do montante em dívida, acrescido daquela indemnização, sob pena de o contrato ` +
          `poder ser resolvido.`,
        `Recorda-se que a mora superior a três meses no pagamento da renda, ou o atraso superior a ` +
          `oito dias no pagamento por mais de quatro vezes seguidas ou interpoladas num período de ` +
          `doze meses, constitui fundamento de resolução do contrato pelo senhorio, nos termos do ` +
          `n.º 3 do artigo 1083.º do Código Civil.`,
        `O pagamento deverá ser feito por transferência para o IBAN ${LINHA}, indicando o mês a que ` +
          `respeita cada renda.`,
        `Caso o pagamento já tenha sido efetuado entretanto, solicita-se que ignore a presente ` +
          `comunicação e que me envie o comprovativo.`,
        `Com os melhores cumprimentos,`,
      ],
      assinaturas: ["O Senhorio"],
      nota:
        "Enviar por carta registada com aviso de receção: sem prova de receção a interpelação não " +
        "serve num processo. O pagamento do arrendatário no prazo do n.º 3 do artigo 1084.º faz " +
        "caducar o direito de resolução.",
    }),
  },

  // ----------------------------------------------------------------
  revogacao: {
    label: "Revogação por acordo",
    descricao: "As duas partes acordam terminar o contrato numa data certa.",
    base: "Artigo 1082.º do Código Civil",
    construir: (d) => ({
      assunto: `Revogação por acordo do contrato de arrendamento da fração ${d.fracaoRef}`,
      paragrafos: [
        `Entre ${d.senhorio}, NIF ${d.senhorioNif ?? LINHA}, na qualidade de SENHORIO, e ` +
          `${d.inquilino}, NIF ${d.inquilinoNif ?? LINHA}, na qualidade de ARRENDATÁRIO, é ` +
          `celebrado o presente acordo de revogação, nos termos do artigo 1082.º do Código Civil.`,
        `Primeiro. As partes são, respetivamente, senhorio e arrendatário no ${identificaLocado(d)}.`,
        `Segundo. As partes acordam em revogar o referido contrato, que cessa os seus efeitos em ` +
          `${LINHA}, data em que o locado será entregue livre de pessoas e bens.`,
        `Terceiro. O ARRENDATÁRIO declara ter pago todas as rendas vencidas até àquela data e ` +
          `obriga-se a liquidar os encargos que sejam da sua responsabilidade e ainda estejam por ` +
          `faturar, designadamente água, eletricidade e gás.`,
        `Quarto. A caução prestada, no valor de ${LINHA}, será devolvida ao ARRENDATÁRIO no prazo de ` +
          `${LINHA} dias após a entrega das chaves, deduzida do custo de eventuais reparações que ` +
          `não resultem do uso normal do locado.`,
        `Quinto. Com a entrega das chaves e o cumprimento do disposto nas cláusulas anteriores, as ` +
          `partes declaram nada mais ter a exigir uma da outra por conta deste contrato.`,
        `Sexto. A cessação é comunicada ao Portal das Finanças pelo senhorio.`,
      ],
      assinaturas: ["O Senhorio", "O Arrendatário"],
      nota:
        "Feito em duplicado, ficando um exemplar com cada parte. Não esquecer de dar baixa do " +
        "contrato no Portal das Finanças, senão continua a haver obrigação de emitir recibos.",
    }),
  },
};

export const MINUTA_TIPOS = Object.keys(MINUTAS) as MinutaTipo[];

export function isMinutaTipo(s: string): s is MinutaTipo {
  return Object.prototype.hasOwnProperty.call(MINUTAS, s);
}
