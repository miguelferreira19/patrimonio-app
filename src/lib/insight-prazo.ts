/** Dias que um "adiar" dura por defeito. Um mês: a cadência real da carteira é mensal, e
 *  o que se adia é quase sempre "trato disto no próximo ciclo de recibos".
 *
 *  Vive num módulo só seu porque um ficheiro "use server" (lib/actions/insights.ts) não
 *  pode exportar nada que não seja uma função async, e o botão precisa do número para o
 *  rótulo. */
export const ADIAR_DIAS = 30;
