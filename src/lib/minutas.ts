// MINUTAS de correspondência do senhorio. Módulo PURO: texto, nada de I/O nem de React.
//
// Porquê aqui e não dentro da página: o texto de uma minuta é conhecimento de domínio com
// artigos do Código Civil lá dentro, e vai ser lido e corrigido por quem percebe de
// arrendamento, não por quem percebe de JSX. Separado, lê-se de uma sentada.
//
// Todas saem com espaços em branco onde a app não sabe (o novo arrendatário de uma cessão,
// os meses em dívida). Preencher à mão é honesto; inventar um número numa carta que produz
// efeitos jurídicos não é.

import { fmtDate, fmtEur } from "./format";
import {
  NOTAS_COBRANCA, dataPorExtenso, identificaLocado, minutaAcordoPorPreencher,
  minutaInterpelacao, minutaLembrete, minutaResolucao, passoDaEscada,
  type CartaEnviada, type DividaDaCarta,
} from "./minutas-cobranca";
export { minutaAcordo, passoDaEscada, textoCurto } from "./minutas-cobranca";
export type { CartaEnviada, DividaDaCarta, PassoDaEscada } from "./minutas-cobranca";

export type MinutaTipo = "cessao" | "oposicao" | "interpelacao" | "revogacao" |
  "lembrete" | "resolucao" | "acordo";

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
  divida?: DividaDaCarta;
  /** Termo do prazo em curso e antecedência usada, quando confirmados no contrato. */
  fimContrato?: string | null;
  antecedenciaDias?: number | null;
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
  /** Apenas para o rodapé da página da app, nunca para o corpo da carta. */
  nota: string;
  envio: "simples" | "registada";
  construir(d: MinutaDados, divida?: DividaDaCarta): Minuta;
}

const LINHA = "________________________";

function refContrato(d: MinutaDados): string {
  return d.contratoNo ? `, com o n.º ${d.contratoNo} no Portal das Finanças,` : "";
}

const NOTA_OPOSICAO = "Art. 1097.º do Código Civil: antecedência conforme o prazo do contrato, " +
  "com respeito pelo limite dos três anos do n.º 3. Confirmar o prazo em curso e a antecedência " +
  "indicada. Enviar por carta registada com aviso de receção. Rever com advogado antes de enviar.";

export const MINUTAS: Record<MinutaTipo, MinutaSpec> = {
  // ----------------------------------------------------------------
  cessao: {
    label: "Cessão da posição contratual",
    descricao: "O arrendatário sai e outra pessoa entra no mesmo contrato, com o acordo do senhorio.",
    base: "Artigos 424.º e seguintes, 1038.º alínea f) e 1059.º n.º 2 do Código Civil",
    nota: "Arts. 424.º e seguintes, 1038.º, alínea f), e 1059.º, n.º 2, do Código Civil: a cessão exige autorização do senhorio.",
    envio: "simples",
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
    nota: NOTA_OPOSICAO,
    envio: "registada",
    construir: (d) => ({
      assunto: `Oposição à renovação do contrato de arrendamento da fração ${d.fracaoRef}`,
      paragrafos: [
        `Ex.mo(a) Senhor(a) ${d.inquilino},`,
        `Na qualidade de senhorio no ${identificaLocado(d)}, venho comunicar a minha OPOSIÇÃO À ` +
          `RENOVAÇÃO do referido contrato, nos termos do artigo 1097.º do Código Civil.`,
        `Em consequência, o contrato cessa os seus efeitos em ${dataPorExtenso(d.fimContrato)}, data em que deverá ` +
          `entregar o locado livre de pessoas e bens, no estado em que o recebeu, salvo as ` +
          `deteriorações inerentes a uma utilização normal.`,
        `A antecedência usada nesta comunicação é de ${d.antecedenciaDias ?? LINHA} dias em relação ao termo do prazo em curso, nos termos do art. 1097.º do Código Civil.`,
        `Até à data da entrega mantém-se a obrigação de pagamento pontual da renda, bem como dos ` +
          `encargos que sejam da sua responsabilidade.`,
        `Solicita-se que confirme a receção da presente comunicação e que acorde comigo a data e a ` +
          `hora da entrega das chaves e da vistoria do locado.`,
        `Com os melhores cumprimentos,`,
      ],
      assinaturas: ["O Senhorio"],
      nota: NOTA_OPOSICAO,
    }),
  },

  // ----------------------------------------------------------------
  interpelacao: {
    label: "Interpelação por rendas em atraso",
    descricao: "Aviso formal de rendas não pagas, com o prazo e as consequências.",
    base: "Artigo 1041.º, n.º 1, do Código Civil",
    nota: NOTAS_COBRANCA.interpelacao,
    envio: "registada",
    construir: minutaInterpelacao,
  },
  lembrete: {
    label: "Lembrete de rendas em atraso",
    descricao: "Pedido cordial de regularização, com convite a contactar em caso de dificuldade.",
    base: "Regularização amigável de rendas vencidas",
    nota: NOTAS_COBRANCA.lembrete,
    envio: "simples",
    construir: minutaLembrete,
  },
  resolucao: {
    label: "Aviso de resolução",
    descricao: "Intenção de resolver o contrato por mora igual ou superior a três meses.",
    base: "Artigos 1083.º e 1084.º do Código Civil e artigo 9.º, n.º 7, do NRAU",
    nota: NOTAS_COBRANCA.resolucao,
    envio: "registada",
    construir: minutaResolucao,
  },
  acordo: {
    label: "Acordo de pagamento",
    descricao: "Plano de regularização da dívida em prestações, além da renda corrente.",
    base: "Artigos 405.º e 781.º do Código Civil",
    nota: NOTAS_COBRANCA.acordo,
    envio: "simples",
    construir: minutaAcordoPorPreencher,
  },

  // ----------------------------------------------------------------
  revogacao: {
    label: "Revogação por acordo",
    descricao: "As duas partes acordam terminar o contrato numa data certa.",
    base: "Artigo 1082.º do Código Civil",
    nota: "Art. 1082.º do Código Civil: cessação do contrato por acordo entre senhorio e arrendatário.",
    envio: "simples",
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

// ----------------------------------------------------------------
// ENQUADRAMENTO: que cartas se aplicam A ESTA fração.
//
// A página de Documentos oferecia as cinco a toda a gente, sempre. Metade não servia
// para nada no contrato escolhido — uma oposição à renovação nos primeiros três anos é
// ineficaz (artigo 1097.º n.º 3), uma atualização de renda sem elegibilidade é uma carta
// que o arrendatário pode ignorar, e uma interpelação por rendas em atraso a quem está em
// dia é um erro que se manda por escrito. Oferecer uma carta é afirmar que ela se aplica.
//
// Continua a ser PURO: quem chama traz os factos já calculados (elegibilidade de renda do
// `calc.ts`, meses em atraso do `arrears.ts`). Este módulo não sabe ler a base de dados
// nem quer saber — é o que o deixa testável no `minutas.check.ts`.

export type MinutaChave = MinutaTipo | "renda";

/** Anos de vigência antes de o senhorio se poder opor à renovação (1097.º n.º 3). */
export const ANOS_ATE_OPOSICAO = 3;

export interface FactosDaFracao {
  /** Hoje, ISO. */
  hoje: string;
  temContratoAtivo: boolean;
  /** Início do contrato ativo, ISO. */
  inicioContrato: string | null;
  /** `rentUpdateEligibility(...).eligible` do contrato ativo. */
  rendaElegivel: boolean;
  /** `rentUpdateEligibility(...).eligibleSince`, para dizer a partir de quando. */
  rendaElegivelDesde: string | null;
  /** false quando não há nenhum coeficiente registado: a carta ficava sem o número. */
  temCoeficiente: boolean;
  /** Meses seguidos por liquidar, já sem os contratos de ritmo próprio (arrears.ts). */
  mesesEmAtraso: number;
  /** Apenas as cartas enviadas no ciclo de atraso atual. */
  cartas?: CartaEnviada[];
}

export interface MinutaEnquadrada {
  chave: MinutaChave;
  label: string;
  descricao: string;
  base: string;
  nota: string;
  envio: "simples" | "registada";
  /** null quando a carta se aplica. Caso contrário, a razão, em PT-PT. */
  bloqueio: string | null;
}

/** Mesmo dia, `anos` anos depois. O 29 de fevereiro cai em 1 de março, que é o que o
 *  calendário faz e o que a contagem de prazos assume. */
function somaAnos(iso: string, anos: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + anos);
  return d.toISOString().slice(0, 10);
}

function bloqueioRenda(f: FactosDaFracao): string | null {
  return !f.temCoeficiente
    ? "Ainda não há coeficiente de atualização registado (regista-se em Admin)."
    : f.rendaElegivel
      ? null
      : f.rendaElegivelDesde
        ? `A renda deste contrato só é atualizável a partir de ${fmtDate(f.rendaElegivelDesde)}.`
        : "Falta a data de início do contrato para calcular a elegibilidade.";
}

function bloqueioOposicao(f: FactosDaFracao): string | null {
  return !f.inicioContrato
    ? "Falta a data de início do contrato para contar o prazo do artigo 1097.º."
    : f.hoje < somaAnos(f.inicioContrato, ANOS_ATE_OPOSICAO)
      ? `O senhorio só se pode opor à renovação a partir de ${fmtDate(
          somaAnos(f.inicioContrato, ANOS_ATE_OPOSICAO),
        )} (três anos de contrato).`
      : null;
}

/** Mantém as cartas bloqueadas na lista para a página poder explicar a razão. */
export function enquadrarMinutas(f: FactosDaFracao): MinutaEnquadrada[] {
  const semContrato = f.temContratoAtivo ? null : "A fração não tem contrato de arrendamento ativo.";
  const escada = passoDaEscada({ ...f, cartas: f.cartas ?? [] });
  const cobranca = (["lembrete", "interpelacao", "resolucao"] as const).map((chave) => ({
    chave, ...resumo(chave),
    bloqueio: semContrato ?? (escada.proxima === chave && escada.quando === f.hoje ? null :
      escada.proxima === chave && escada.quando ?
        `${escada.motivo} Disponível a partir de ${dataPorExtenso(escada.quando)}.` :
        escada.proxima === chave || escada.proxima === null ? escada.motivo :
          `O próximo passo é: ${MINUTAS[escada.proxima].label.toLowerCase()}.`),
  }));

  return [
    {
      chave: "renda",
      label: MINUTA_RENDA.label,
      descricao: MINUTA_RENDA.descricao,
      base: MINUTA_RENDA.base,
      nota: MINUTA_RENDA.nota,
      envio: MINUTA_RENDA.envio,
      bloqueio: semContrato ?? bloqueioRenda(f),
    },
    ...cobranca,
    { chave: "acordo", ...resumo("acordo"),
      bloqueio: semContrato ?? (f.mesesEmAtraso > 0 ? null : "Sem rendas em atraso.") },
    { chave: "oposicao", ...resumo("oposicao"), bloqueio: semContrato ?? bloqueioOposicao(f) },
    { chave: "revogacao", ...resumo("revogacao"), bloqueio: semContrato },
    { chave: "cessao", ...resumo("cessao"), bloqueio: semContrato },
  ];
}

function resumo(tipo: MinutaTipo): Omit<MinutaSpec, "construir"> {
  const { label, descricao, base, nota, envio } = MINUTAS[tipo];
  return { label, descricao, base, nota, envio };
}

// ----------------------------------------------------------------
// A carta de ATUALIZAÇÃO DE RENDA fica fora do mapa acima porque precisa de dois números
// que não estão no contrato: o coeficiente do ano e a data a partir da qual é elegível.
// O TEXTO, esse, vive aqui como o das outras — a página `/carta/[contractId]` e o
// download em .docx renderizam os mesmos parágrafos, senão as duas versões da mesma carta
// começam a divergir na primeira correção que alguém fizer a uma delas.

export interface AtualizacaoRenda {
  ano: number;
  coeficiente: number;
  novaRenda: number;
  /** ISO. A partir de quando a nova renda produz efeitos. */
  desde: string;
}

export const MINUTA_RENDA = {
  label: "Atualização de renda",
  descricao: "Comunicação da subida anual pelo coeficiente publicado em Diário da República.",
  base: "Artigo 24.º da Lei n.º 6/2006 (Novo Regime do Arrendamento Urbano)",
  nota: "Art. 24.º da Lei n.º 6/2006: comunicar por escrito o coeficiente e a nova renda com pelo menos 30 dias de antecedência. Enviar por carta registada com aviso de receção.",
  envio: "registada" as const,
};

export function minutaAtualizacaoRenda(d: MinutaDados, a: AtualizacaoRenda): Minuta {
  return {
    assunto: `Atualização da renda referente à fração ${d.fracaoRef}`,
    paragrafos: [
      `Ex.mo(a) Senhor(a) ${d.inquilino},`,
      `Nos termos do artigo 24.º da Lei n.º 6/2006, de 27 de fevereiro (Novo Regime do ` +
        `Arrendamento Urbano), vimos comunicar a atualização anual da renda do contrato de ` +
        `arrendamento da fração acima identificada${refContrato(d)} com início em ` +
        `${dataPorExtenso(d.inicio)}.`,
      `A renda mensal atualmente em vigor é de ${fmtEur(d.renda, 2)}.`,
      `É aplicado o coeficiente de atualização de renda para o ano de ${a.ano}, fixado em ` +
        `${a.coeficiente.toFixed(4).replace(".", ",")} e publicado em Diário da República.`,
      `Em resultado desta atualização, a nova renda mensal passa a ser de ` +
        `${fmtEur(a.novaRenda, 2)}, com efeitos a partir de ${dataPorExtenso(a.desde)}.`,
      `Solicita-se a confirmação da receção da presente comunicação.`,
      `Com os melhores cumprimentos,`,
    ],
    assinaturas: ["Assinatura do Senhorio"],
    nota: MINUTA_RENDA.nota,
  };
}
