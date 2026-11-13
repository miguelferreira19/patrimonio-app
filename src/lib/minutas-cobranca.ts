import { addMonthsKey, endOfMonthISO, fmtEur, mesPorExtenso, monthLabel } from "./format";
import type { Minuta, MinutaDados, MinutaTipo } from "./minutas";

export type DividaDaCarta = { meses: Array<{ mes: string; valor: number }>; total: number };
export type CartaEnviada = { tipo: MinutaTipo; dia: string };
export type PassoDaEscada = {
  passo: 0 | 1 | 2 | 3;
  proxima: "lembrete" | "interpelacao" | "resolucao" | null;
  quando: string | null;
  motivo: string;
};

const LINHA = "________________________";
export const NOTAS_COBRANCA = {
  lembrete: "Pedido amigável de regularização de rendas vencidas, sem invocação de sanções legais.",
  interpelacao: "Art. 1041.º, n.º 1, do Código Civil: indemnização de 20% por mora. Enviar por carta registada com aviso de receção.",
  resolucao: "Arts. 1083.º, n.º 3, e 1084.º, n.os 2 e 3, do Código Civil; art. 9.º, n.º 7, do NRAU. Confirmar a forma legal da comunicação. Rever com advogado antes de enviar.",
  acordo: "Acordo de regularização de dívida, nos termos da liberdade contratual (art. 405.º do Código Civil), com vencimento antecipado do saldo se faltar uma prestação (art. 781.º).",
};

export function dataPorExtenso(iso: string | null | undefined): string {
  return iso ? `${Number(iso.slice(8, 10))} de ${mesPorExtenso(iso, true)}` : LINHA;
}

export function identificaLocado(d: MinutaDados): string {
  const numero = d.contratoNo ? `, com o n.º ${d.contratoNo} no Portal das Finanças` : "";
  const inicio = d.inicio ? `, com início em ${dataPorExtenso(d.inicio)}` : "";
  return `contrato de arrendamento da fração sita em ${d.morada}${numero}${inicio}, ` +
    `cuja renda mensal em vigor é de ${fmtEur(d.renda, 2)}`;
}

function centimos(valor: number): number {
  const n = Math.round((valor + Number.EPSILON) * 100);
  if (!Number.isFinite(valor) || valor < 0 || !Number.isSafeInteger(n)) {
    throw new Error("O valor monetário deve ser finito, não negativo e expresso em cêntimos seguros.");
  }
  return n;
}

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function numeroPorExtenso(n: number): string {
  if (n < 20) return UNIDADES[n];
  if (n === 100) return "cem";
  if (n < 1000) {
    const escala = n < 100 ? 10 : 100;
    const inicio = (n < 100 ? DEZENAS : CENTENAS)[Math.floor(n / escala)];
    return inicio + (n % escala ? ` e ${numeroPorExtenso(n % escala)}` : "");
  }
  const escala = n < 1e6 ? 1000 : n < 1e12 ? 1e6 : 1e12;
  const grupo = Math.floor(n / escala);
  const unidade = escala === 1000 ? "mil" : escala === 1e6 ? "milhão" : "bilião";
  const plural = escala === 1000 ? "mil" : escala === 1e6 ? "milhões" : "biliões";
  const inicio = grupo === 1 && escala === 1000 ? "mil" :
    `${numeroPorExtenso(grupo)} ${grupo === 1 ? unidade : plural}`;
  const resto = n % escala;
  return inicio + (resto ? `${resto < 100 || resto % 100 === 0 ? " e " : " "}${numeroPorExtenso(resto)}` : "");
}

function valorComExtenso(valor: number): string {
  const n = centimos(valor);
  const euros = Math.floor(n / 100);
  const cents = n % 100;
  const ligacao = euros > 0 && euros % 1e6 === 0 ? " de " : " ";
  const inteiro = `${numeroPorExtenso(euros)}${ligacao}${euros === 1 ? "euro" : "euros"}`;
  const fracao = cents ? ` e ${numeroPorExtenso(cents)} ${cents === 1 ? "cêntimo" : "cêntimos"}` : "";
  return `${fmtEur(n / 100, 2)} (${inteiro}${fracao})`;
}

function detalheDivida(divida: DividaDaCarta | undefined): string[] {
  if (!divida) return [`Meses e valores em dívida: ${LINHA}.`, `Total em dívida: ${LINHA}.`];
  const meses = [...divida.meses].sort((a, b) => a.mes.localeCompare(b.mes));
  return [
    ...meses.map((m) => `${mesPorExtenso(m.mes, true)}: ${fmtEur(centimos(m.valor) / 100, 2)}.`),
    `Total em dívida: ${valorComExtenso(divida.total)}.`,
  ];
}

function indemnizacao(divida: DividaDaCarta | undefined): string {
  return divida ? fmtEur(Math.round(centimos(divida.total) * 0.2) / 100, 2) : LINHA;
}

export function minutaLembrete(d: MinutaDados, divida = d.divida): Minuta {
  return {
    assunto: `Regularização de rendas da fração ${d.fracaoRef}`,
    paragrafos: [
      `Ex.mo(a) Senhor(a) ${d.inquilino},`,
      `Recordo que se encontram por regularizar as seguintes rendas da fração sita em ${d.morada}:`,
      detalheDivida(divida).join(" "),
      "Solicito a regularização no prazo de 8 dias a contar da receção desta carta. Se tiver alguma dificuldade, convido-o(a) a contactar-me para encontrarmos uma solução.",
      "Se já efetuou o pagamento, agradeço o envio do comprovativo. Com os melhores cumprimentos,",
    ],
    assinaturas: ["O Senhorio"], nota: NOTAS_COBRANCA.lembrete,
  };
}

export function minutaInterpelacao(d: MinutaDados, divida = d.divida): Minuta {
  return {
    assunto: `Interpelação por rendas em atraso da fração ${d.fracaoRef}`,
    paragrafos: [
      `Ex.mo(a) Senhor(a) ${d.inquilino},`,
      `Na qualidade de senhorio no ${identificaLocado(d)}, solicito o pagamento das rendas vencidas e não pagas abaixo discriminadas:`,
      ...detalheDivida(divida),
      "Solicito a regularização no prazo de 8 dias a contar da receção desta carta.",
      `Nos termos do art. 1041.º, n.º 1, do Código Civil, a mora dá ao senhorio o direito a uma indemnização igual a 20% do valor em dívida, correspondente a ${indemnizacao(divida)}.`,
      `O pagamento deverá ser efetuado por transferência para o IBAN ${LINHA}, identificando os meses a que respeita.`,
      "Se já efetuou o pagamento, solicito o envio do comprovativo. Com os melhores cumprimentos,",
    ],
    assinaturas: ["O Senhorio"], nota: NOTAS_COBRANCA.interpelacao,
  };
}

export function minutaResolucao(d: MinutaDados, divida = d.divida): Minuta {
  return {
    assunto: `Aviso de resolução do contrato de arrendamento da fração ${d.fracaoRef}`,
    paragrafos: [
      `Ex.mo(a) Senhor(a) ${d.inquilino},`,
      `Na qualidade de senhorio no ${identificaLocado(d)}, identifico as rendas vencidas e não pagas:`,
      ...detalheDivida(divida),
      "A mora igual ou superior a três meses no pagamento da renda constitui fundamento de resolução do contrato, nos termos do art. 1083.º, n.º 3, do Código Civil.",
      "Por esse fundamento, comunico a intenção de resolver o contrato de arrendamento, nos termos do art. 1084.º, n.º 2, do Código Civil.",
      `O arrendatário pode pôr fim à mora no prazo de um mês a contar da receção desta comunicação, pagando o devido com a indemnização de 20%, correspondente a ${indemnizacao(divida)}, nos termos do art. 1084.º, n.º 3, do Código Civil.`,
      "A presente comunicação segue a forma prevista no art. 9.º, n.º 7, do NRAU (Lei n.º 6/2006, de 27 de fevereiro).",
      "Com os melhores cumprimentos,",
    ],
    assinaturas: ["O Senhorio"], nota: NOTAS_COBRANCA.resolucao,
  };
}

function acordoComQuadro(d: MinutaDados, total: string, quadro: string[]): Minuta {
  return {
    assunto: `Acordo de pagamento de rendas da fração ${d.fracaoRef}`,
    paragrafos: [
      `Entre ${d.senhorio}, NIF ${d.senhorioNif ?? LINHA}, senhorio, e ${d.inquilino}, NIF ${d.inquilinoNif ?? LINHA}, arrendatário, é celebrado o presente acordo relativo ao ${identificaLocado(d)}.`,
      `O arrendatário reconhece a dívida de ${total} e compromete-se a pagá-la segundo o seguinte plano:`,
      "Prestação | Data de pagamento | Valor",
      ...quadro,
      "O valor de cada prestação acresce à renda corrente, que continua a ser paga nos termos do contrato de arrendamento.",
      "A falta de pagamento de uma prestação determina o vencimento imediato do restante montante em dívida, que se torna integralmente exigível.",
      "O acordo é feito em duplicado, ficando um exemplar assinado com cada parte.",
    ],
    assinaturas: ["O Senhorio", "O Arrendatário"], nota: NOTAS_COBRANCA.acordo,
  };
}

export function minutaAcordoPorPreencher(d: MinutaDados): Minuta {
  return acordoComQuadro(d, d.divida ? valorComExtenso(d.divida.total) : LINHA,
    [`Prestação ${LINHA} | ${LINHA} | ${LINHA}`]);
}

export function minutaAcordo(
  d: MinutaDados, plano: { divida: number; prestacoes: number; primeira: string },
): Minuta {
  const total = Math.round((plano.divida + Number.EPSILON) * 100);
  if (!Number.isFinite(plano.divida) || !Number.isSafeInteger(total) || total < 1 ||
      Math.abs(plano.divida * 100 - total) > 1e-6) {
    throw new Error("A dívida deve ser positiva e corresponder a um número exato de cêntimos.");
  }
  if (!Number.isSafeInteger(plano.prestacoes) || plano.prestacoes < 1 || plano.prestacoes > total) {
    throw new Error("O número de prestações deve ser inteiro, pelo menos 1, sem prestações inferiores a um cêntimo.");
  }
  const data = new Date(`${plano.primeira}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plano.primeira) || !Number.isFinite(data.getTime()) ||
      data.toISOString().slice(0, 10) !== plano.primeira) {
    throw new Error("A data da primeira prestação deve ser uma data válida no formato AAAA-MM-DD.");
  }
  const base = Math.floor(total / plano.prestacoes);
  const quadro = Array.from({ length: plano.prestacoes }, (_, i) => {
    const mes = addMonthsKey(plano.primeira, i);
    const dia = Math.min(Number(plano.primeira.slice(8)), Number(endOfMonthISO(mes).slice(8)));
    const vencimento = `${mes.slice(0, 8)}${String(dia).padStart(2, "0")}`;
    const valor = i === plano.prestacoes - 1 ? total - base * i : base;
    return `Prestação ${i + 1} | ${dataPorExtenso(vencimento)} | ${fmtEur(valor / 100, 2)}`;
  });
  return acordoComQuadro(d, valorComExtenso(total / 100), quadro);
}

export function textoCurto(_tipo: "lembrete", d: MinutaDados, divida: DividaDaCarta): string {
  const meses = [...divida.meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const periodo = meses.map((m) => monthLabel(m.mes)).join(", ");
  const resumo = meses.length ? `${meses.length} meses, de ${monthLabel(meses[0].mes)} a ${monthLabel(meses[meses.length - 1].mes)}` : "meses por confirmar";
  const final = ` Total: ${fmtEur(centimos(divida.total) / 100, 2)}. Agradeço regularização em 8 dias. Se houver dificuldade, contacte-me.`;
  const referencia = d.fracaoRef.trim().replace(/\s+/g, " ").slice(0, 60);
  const inicio = `Rendas por regularizar (${referencia}): `;
  return inicio + (inicio.length + periodo.length + final.length <= 400 ? periodo : resumo) + final;
}

function somaDias(iso: string, dias: number): string {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function passoDaEscada(f: {
  mesesEmAtraso: number; cartas: CartaEnviada[]; hoje: string;
}): PassoDaEscada {
  const enviadas = f.cartas.filter((c) => c.dia <= f.hoje);
  const resolucao = enviadas.some((c) => c.tipo === "resolucao");
  const interpelacao = enviadas.filter((c) => c.tipo === "interpelacao").map((c) => c.dia).sort()[0];
  const lembrete = enviadas.filter((c) => c.tipo === "lembrete").map((c) => c.dia).sort()[0];
  const passo = resolucao ? 3 : interpelacao ? 2 : lembrete ? 1 : 0;
  if (f.mesesEmAtraso <= 0) {
    return { passo, proxima: null, quando: null, motivo: "Sem rendas em atraso." };
  }
  if (resolucao) {
    return { passo, proxima: null, quando: null, motivo: "O aviso de resolução já foi enviado." };
  }
  if (interpelacao) {
    const quando = f.mesesEmAtraso >= 3 ? [f.hoje, somaDias(interpelacao, 9)].sort()[1] : null;
    return { passo, proxima: "resolucao", quando,
      motivo: quando === null ? "A resolução exige pelo menos três meses de mora." :
        quando > f.hoje ? "Aguardar mais de 8 dias após a interpelação." : "Três ou mais meses de mora e interpelação enviada há mais de 8 dias." };
  }
  if (f.mesesEmAtraso >= 2 || lembrete) {
    const quando = f.mesesEmAtraso >= 2 ? f.hoje : [f.hoje, somaDias(lembrete, 15)].sort()[1];
    return { passo, proxima: "interpelacao", quando,
      motivo: f.mesesEmAtraso >= 2 ? "Duas ou mais rendas mensais em atraso." :
        quando > f.hoje ? "Aguardar 15 dias após o lembrete." : "Decorreram pelo menos 15 dias após o lembrete." };
  }
  return { passo, proxima: "lembrete", quando: f.hoje, motivo: "Uma renda mensal em atraso, sem lembrete enviado." };
}
