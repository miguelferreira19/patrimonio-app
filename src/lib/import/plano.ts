// O PLANO de importação (PLANO.md §7.4, Fase 6): o que ESTE ficheiro faria à base de dados.
//
// Módulo PURO — não lê nem escreve nada. Recebe as linhas do ficheiro e o que a base já
// tem, e devolve a lista do que é novo, do que é duplicado, do que diverge e do que é
// inválido. É isso que se mostra ANTES de escrever, e é a razão de a Fase 6 não poder
// estragar dados: a escrita passa a ser a confirmação de um plano visível, e não o efeito
// colateral de largar um ficheiro.
//
// As regras são as do pipeline Python (`dados/gerar_sql_import.py`), que continua a ser a
// reversão oficial. Reproduzi-las aqui é o gate desta fase:
//
//   1. recibos "Anulado" NÃO entram (mas contam-se, para o total bater com o ficheiro);
//   2. um recibo que abrange N meses vira N linhas, uma por mês de calendário;
//   3. o valor divide-se em N parcelas de 2 casas cuja soma é EXATAMENTE o total — o resto
//      fica na última, senão perdem-se cêntimos por arredondamento;
//   4. `receipt_number` = "contrato/recibo" e, quando N > 1, "#i" no fim. É a chave de
//      dedupe GLOBAL: o mesmo recibo aparece no export de dois senhorios quando a fração
//      está em compropriedade, e tem de colidir na mesma linha (CLAUDE.md);
//   5. `withholding` = parcela do bruto − parcela da importância recebida, das MESMAS
//      parcelas, para a soma bater com o recibo original.

/** Uma linha do ficheiro do Portal, já com tipos. O mapeamento de colunas é de quem lê o
 *  ficheiro; aqui as datas são ISO e os valores são números. */
export interface LinhaRecibo {
  nContrato: string;
  nRecibo: string;
  matriz: string;
  locatario: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  dataRecibo: string | null;
  valor: number | null;
  importanciaRecebida: number | null;
  estado: string;
}

/** Uma linha de recibo pronta a inserir, já mensalizada. */
export interface ReciboPlaneado {
  receipt_number: string;
  pf_contract_no: string;
  matriz: string;
  tenant_name: string | null;
  ref_month: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  withholding: number;
  issue_date: string | null;
}

export interface Divergencia {
  receipt_number: string;
  ref_month: string;
  valorNaBase: number;
  valorNoFicheiro: number;
}

export interface PlanoDeImportacao {
  /** Recibos que não existem na base. É a ÚNICA coisa que o apply insere. */
  novos: ReciboPlaneado[];
  /** Já existem com o mesmo valor: não se toca. */
  duplicados: number;
  /** Já existem com valor DIFERENTE. Não se sobrescreve — mostra-se e decide-se à mão. */
  divergencias: Divergencia[];
  /** Linhas "Anulado" no ficheiro, excluídas de propósito. */
  anulados: number;
  /** Linhas que não dão para ler (sem datas, sem valor, sem contrato). */
  invalidas: Array<{ linha: number; porque: string }>;
  /** Matrizes do ficheiro que a base não conhece — teriam de dar origem a frações novas. */
  matrizesDesconhecidas: string[];
  /** Contratos do Portal que a base não conhece. */
  contratosDesconhecidos: string[];
  /** Σ do valor dos recibos novos. */
  totalNovos: number;
}

/** O que a base já tem, para se poder comparar sem ir lá outra vez. */
export interface EstadoAtual {
  /** receipt_number -> valor guardado. */
  recibos: Map<string, number>;
  matrizes: Set<string>;
  contratos: Set<string>;
}

/** Divide `total` em `n` parcelas de 2 casas cuja soma é EXATAMENTE `total`.
 *  O resto fica na última parcela — é o `split_amount` do gerador Python, e é o que
 *  impede a soma das fatias de fugir do valor do recibo por arredondamento. */
export function dividirValor(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  if (n <= 1) return [cents / 100];
  const parts: number[] = [];
  let somaParcial = 0;
  for (let i = 0; i < n - 1; i++) {
    const parte = Math.round(cents / n);
    parts.push(parte / 100);
    somaParcial += parte;
  }
  parts.push((cents - somaParcial) / 100);
  return parts;
}

/** Meses de calendário abrangidos por [inicio, fim], como "YYYY-MM-01". */
export function mesesAbrangidos(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let ano = parseInt(inicio.slice(0, 4), 10);
  let mes = parseInt(inicio.slice(5, 7), 10);
  const anoFim = parseInt(fim.slice(0, 4), 10);
  const mesFim = parseInt(fim.slice(5, 7), 10);
  if (ano * 12 + mes > anoFim * 12 + mesFim) return out;
  // Teto de segurança: um período de mais de 10 anos é erro de leitura de datas, não um
  // recibo — sem isto uma data mal lida gerava milhares de linhas.
  while (ano * 12 + mes <= anoFim * 12 + mesFim && out.length < 120) {
    out.push(`${ano}-${String(mes).padStart(2, "0")}-01`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return out;
}

export function construirPlano(linhas: LinhaRecibo[], estado: EstadoAtual): PlanoDeImportacao {
  const novos: ReciboPlaneado[] = [];
  const divergencias: Divergencia[] = [];
  const invalidas: Array<{ linha: number; porque: string }> = [];
  const matrizesDesconhecidas = new Set<string>();
  const contratosDesconhecidos = new Set<string>();
  // Dedupe DENTRO do próprio ficheiro: o mesmo recibo pode vir repetido quando se juntam
  // exports de dois senhorios da mesma fração.
  const vistos = new Set<string>();
  let duplicados = 0;
  let anulados = 0;

  linhas.forEach((l, i) => {
    const nLinha = i + 2; // +1 pelo cabeçalho, +1 porque as folhas contam de 1

    if (l.estado?.trim().toLowerCase() === "anulado") {
      anulados += 1;
      return;
    }
    if (!l.nContrato?.trim() || !l.nRecibo?.trim()) {
      invalidas.push({ linha: nLinha, porque: "sem nº de contrato ou de recibo" });
      return;
    }
    if (!l.dataInicio || !l.dataFim) {
      invalidas.push({ linha: nLinha, porque: "sem período (data de início ou fim)" });
      return;
    }
    if (l.valor === null || !Number.isFinite(l.valor)) {
      invalidas.push({ linha: nLinha, porque: "sem valor legível" });
      return;
    }

    const meses = mesesAbrangidos(l.dataInicio, l.dataFim);
    if (meses.length === 0) {
      invalidas.push({ linha: nLinha, porque: "período invertido (fim antes do início)" });
      return;
    }

    const n = meses.length;
    const partesValor = dividirValor(l.valor, n);
    const partesRecebido = dividirValor(l.importanciaRecebida ?? l.valor, n);

    if (!estado.matrizes.has(l.matriz)) matrizesDesconhecidas.add(l.matriz);
    if (!estado.contratos.has(l.nContrato)) contratosDesconhecidos.add(l.nContrato);

    meses.forEach((mes, k) => {
      const receipt_number = n > 1 ? `${l.nContrato}/${l.nRecibo}#${k + 1}` : `${l.nContrato}/${l.nRecibo}`;
      if (vistos.has(receipt_number)) {
        duplicados += 1;
        return;
      }
      vistos.add(receipt_number);

      const naBase = estado.recibos.get(receipt_number);
      if (naBase !== undefined) {
        // Cêntimo de tolerância: o mesmo recibo escrito por dois caminhos pode diferir no
        // último cêntimo do arredondamento, e isso não é uma divergência real.
        if (Math.abs(naBase - partesValor[k]) > 0.01) {
          divergencias.push({
            receipt_number,
            ref_month: mes,
            valorNaBase: naBase,
            valorNoFicheiro: partesValor[k],
          });
        } else {
          duplicados += 1;
        }
        return;
      }

      novos.push({
        receipt_number,
        pf_contract_no: l.nContrato.trim(),
        matriz: l.matriz,
        tenant_name: l.locatario?.trim() || null,
        ref_month: mes,
        period_start: l.dataInicio,
        period_end: l.dataFim,
        amount: partesValor[k],
        withholding: Math.round((partesValor[k] - partesRecebido[k]) * 100) / 100,
        issue_date: l.dataRecibo,
      });
    });
  });

  return {
    novos,
    duplicados,
    divergencias,
    anulados,
    invalidas,
    matrizesDesconhecidas: Array.from(matrizesDesconhecidas).sort(),
    contratosDesconhecidos: Array.from(contratosDesconhecidos).sort(),
    totalNovos: Math.round(novos.reduce((a, r) => a + r.amount, 0) * 100) / 100,
  };
}

/** Frase para o cabeçalho do diff. Determinística, PT-PT, sem adjetivos. */
export function resumirPlano(p: PlanoDeImportacao): string {
  const partes = [`${p.novos.length} ${p.novos.length === 1 ? "recibo novo" : "recibos novos"}`];
  if (p.duplicados > 0) partes.push(`${p.duplicados} já importados`);
  if (p.divergencias.length > 0) partes.push(`${p.divergencias.length} divergentes`);
  if (p.anulados > 0) partes.push(`${p.anulados} anulados`);
  if (p.invalidas.length > 0) partes.push(`${p.invalidas.length} ilegíveis`);
  return partes.join(", ") + ".";
}
