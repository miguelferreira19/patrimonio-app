// Corre UMA vez, no arranque de cada instância do servidor (convenção do Next).
//
// O relógio da app é o de Lisboa (2026-10-03). A Vercel corre em UTC, e a app decide
// "hoje" e "o mês corrente" com `new Date()` e getters locais em dezenas de sítios
// (format.ts, arrears.ts, snapshot.ts). Entre a meia-noite e a uma da manhã de Lisboa, no
// verão, o servidor ainda vivia no dia anterior: no dia 1, mostrava o mês ANTERIOR.
//
// Fixar o fuso aqui, em vez de reescrever cada `new Date()`, também põe produção a correr
// no mesmo fuso que a máquina onde os checks e o dev sempre correram. O Node relê
// `process.env.TZ` quando é atribuído, por isso basta uma linha.
//
// A Vercel não deixa definir TZ como variável de ambiente (é reservada), daí ser em código.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = "Europe/Lisbon";
}
