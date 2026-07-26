// A renda, inferida dos recibos. Módulo PURO.
//
// Porque existe: havia TRÊS sítios a responder "qual é a renda deste contrato" e os três
// respondiam mal da mesma maneira — pegavam no mês MAIS RECENTE com recibos.
//   - `sync_contract_rents()` (SQL)
//   - `importReceiptsChunk` (wizard) — pior ainda: um recibo, sem somar o mês
//   - a renda de referência dos Atrasos (essa usa mediana, e está bem)
//
// O mês mais recente é o menos fiável de todos: pode ter só parte dos recibos emitidos.
// Em contratos cuja renda vem repartida em vários recibos por mês (16 dos 24 meses no
// 1825765 "Repeses First"; 10 em 18 no 68665 "1PES"), o último mês trazia uma parcela e a
// renda ficou a valer essa parcela: 175 EUR em vez de 331, 179 em vez de 290. Isto é a
// definição única, e o SQL da função foi reescrito para fazer exatamente o mesmo.

export interface RendaObservada {
  /** O total mensal que a carteira repete. É a melhor estimativa da renda. */
  valor: number;
  /** Quantos meses da janela mostram esse total. 1 = não se repete, pouco fiável. */
  vezes: number;
}

/** Diferença relativa a partir da qual uma renda registada se considera desalinhada dos
 *  recibos. 5% deixa passar a atualização anual pelo coeficiente (~2%) e apanha os erros
 *  reais, que nos dados desta carteira estavam 38% e 47% abaixo. */
export const DESALINHAMENTO_MIN = 0.05;

/** Meses que o mesmo total tem de aparecer para se confiar nele como renda. */
export const REPETICOES_MIN = 3;

// Estes DOIS valores são também o travão do `sync_contract_rents()` (SQL, fim do
// schema.sql): o botão "Sincronizar rendas" só escreve quando o valor se repete
// REPETICOES_MIN meses E está a mais de DESALINHAMENTO_MIN da renda registada —
// isto é, só mexe no que a Saúde já sinalizava. Dentro dos 5% a renda REGISTADA
// vence a inferida, porque aí a diferença é a atualização anual e os recibos
// ainda estão a mostrar o valor velho. Se mudares um destes números, muda o SQL.

/**
 * A renda inferida dos totais mensais (`mês -> soma dos recibos desse mês`).
 *
 * Escolhe o total que MAIS SE REPETE, desempatando pelo mais recente. Assim:
 *   - um mês parcial aparece uma só vez e perde;
 *   - uma atualização de renda real aparece 2+ vezes e ganha, porque é a mais recente
 *     entre as que se repetem;
 *   - com um único mês de histórico devolve esse mês, com `vezes: 1` a dizer que é frágil.
 *
 * Nota: os totais têm de vir de `receipts.amount` (ILÍQUIDO). Com `payments.amount`
 * (líquido de retenção) todos os inquilinos-empresa pareceriam ter a renda errada.
 */
export function rendaObservada(porMes: Map<string, number>): RendaObservada | null {
  if (porMes.size === 0) return null;

  // Agrupa por valor (a 2 casas), guardando quantas vezes e o mês mais recente.
  const porValor = new Map<number, { vezes: number; ultimo: string }>();
  for (const [mes, total] of porMes) {
    if (!(total >= 1)) continue; // ruído de cêntimos, ou mês sem nada
    const chave = Math.round(total * 100) / 100;
    const atual = porValor.get(chave);
    if (!atual) porValor.set(chave, { vezes: 1, ultimo: mes });
    else {
      atual.vezes += 1;
      if (mes > atual.ultimo) atual.ultimo = mes;
    }
  }
  if (porValor.size === 0) return null;

  let melhor: { valor: number; vezes: number; ultimo: string } | null = null;
  for (const [valor, { vezes, ultimo }] of porValor) {
    const cand = { valor, vezes, ultimo };
    if (!melhor) {
      melhor = cand;
      continue;
    }
    const candRepete = cand.vezes >= 2;
    const melhorRepete = melhor.vezes >= 2;
    // 1) quem se repete vence quem aparece uma vez
    if (candRepete !== melhorRepete) {
      if (candRepete) melhor = cand;
      continue;
    }
    // 2) entre iguais nesse critério, o mais recente
    if (cand.ultimo !== melhor.ultimo) {
      if (cand.ultimo > melhor.ultimo) melhor = cand;
      continue;
    }
    // 3) desempate final pelo valor mais alto (mês com mais recibos emitidos)
    if (cand.valor > melhor.valor) melhor = cand;
  }
  return melhor ? { valor: melhor.valor, vezes: melhor.vezes } : null;
}

/** A renda registada está desalinhada dos recibos, e o suficiente para não ser a
 *  atualização anual? Devolve null quando não há base para afirmar nada. */
export function desalinhamentoDaRenda(
  rent: number,
  observada: RendaObservada | null,
): { direcao: "baixa" | "alta"; diferenca: number; racio: number } | null {
  if (!observada || observada.vezes < REPETICOES_MIN || rent <= 0) return null;
  const racio = rent / observada.valor;
  if (Math.abs(racio - 1) < DESALINHAMENTO_MIN) return null;
  return {
    direcao: racio < 1 ? "baixa" : "alta",
    diferenca: Math.round((observada.valor - rent) * 100) / 100,
    racio: Math.round(racio * 1000) / 1000,
  };
}
