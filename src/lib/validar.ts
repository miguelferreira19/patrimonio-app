// Guardas de entrada das server actions (2026-10-03). Módulo PURO.
//
// Só o admin escreve, por isso isto não é uma questão de segurança: é de integridade. Um
// formulário com um bug, ou um número mal lido, gravava `NaN`, uma renda negativa ou uma
// quota de 250% sem que a BD se queixasse (as colunas são `numeric` sem CHECK), e esse
// valor seguia direto para o Anexo F e para o AIMI.
//
// ponytail: guardas à mão em vez de zod. São seis formas de dados; uma dependência nova
// para isto pesava mais do que o código que substitui.

/** Lança com uma mensagem que o utilizador lê tal e qual (`fail()` passa-a ao formulário). */
export function exigir(cond: unknown, mensagem: string): asserts cond {
  if (!cond) throw new Error(mensagem);
}

export function eNumero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** `YYYY-MM-DD` de um dia que existe (2026-02-30 não passa). */
export function eData(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Soma das quotas pode ficar ABAIXO de 100 (compropriedade fora da família, o tio
 *  Ilídio sem exports: CLAUDE.md, "o que NÃO é anomalia"), mas nunca acima. */
export function validarTitulares(owners: Array<{ landlord_id: string; quota: number }>): void {
  const ids = new Set<string>();
  let soma = 0;
  for (const o of owners) {
    exigir(o.landlord_id, "Há um proprietário por escolher.");
    exigir(!ids.has(o.landlord_id), "O mesmo senhorio aparece duas vezes nos proprietários.");
    ids.add(o.landlord_id);
    exigir(
      eNumero(o.quota) && o.quota > 0 && o.quota <= 100,
      "Cada quota tem de estar entre 0 e 100%.",
    );
    soma += o.quota;
  }
  // Tolerância de um cêntimo de ponto: 33,33 × 3 é 99,99, e 33,34 + 33,33 × 2 é 100,00.
  exigir(soma <= 100.01, `As quotas somam ${Math.round(soma * 100) / 100}%, mais do que 100%.`);
}

export function validarContrato(c: {
  tenant_name: string;
  rent: number;
  due_day: number;
  start_date?: string | null;
  end_date?: string | null;
}): void {
  exigir(c.tenant_name?.trim(), "Falta o nome do inquilino.");
  exigir(eNumero(c.rent) && c.rent >= 0, "A renda tem de ser um valor igual ou acima de zero.");
  exigir(
    Number.isInteger(c.due_day) && c.due_day >= 1 && c.due_day <= 28,
    "O dia de vencimento tem de estar entre 1 e 28.",
  );
  exigir(!c.start_date || eData(c.start_date), "A data de início não é uma data válida.");
  exigir(!c.end_date || eData(c.end_date), "A data de fim não é uma data válida.");
  exigir(
    !c.start_date || !c.end_date || c.end_date >= c.start_date,
    "A data de fim é anterior à de início.",
  );
}

/** Despesas são saídas de dinheiro: positivas. Um reembolso regista-se a abater à despesa
 *  original, não como despesa negativa (o Anexo F soma-as tal e qual). */
export function validarDespesa(d: { expense_date: string; amount: number }): void {
  exigir(eData(d.expense_date), "A data da despesa não é uma data válida.");
  exigir(eNumero(d.amount) && d.amount > 0, "O valor da despesa tem de ser acima de zero.");
}

export function validarAtualizacaoRenda(u: { new_rent: number; effective_date: string }): void {
  exigir(eNumero(u.new_rent) && u.new_rent > 0, "A nova renda tem de ser acima de zero.");
  exigir(eData(u.effective_date), "A data de efeito não é uma data válida.");
}

/** Área e VPT: ou não vêm, ou são positivos. */
export function validarPositivoOpcional(v: number | null | undefined, campo: string): void {
  exigir(v == null || (eNumero(v) && v > 0), `${campo} tem de ser um valor acima de zero.`);
}
