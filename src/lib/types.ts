// Tipos das tabelas Supabase (escritos à mão — manter em sincronia com supabase/schema.sql)

export type Role = "admin" | "viewer";

/** De onde vem um numero. Vive aqui, e nao no componente <Confianca>, porque e um facto
 *  de DOMINIO (proveniencia), nao de apresentacao: os geradores de decisoes atribuem-no.
 *  `medido` sai de um recibo/contrato; `estimado` de um modelo ou mediana; `assumido`
 *  depende de uma premissa que a app nao consegue confirmar. */
export type Nivel = "medido" | "estimado" | "assumido";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
}

export interface Landlord {
  id: string;
  name: string;
  nif: string | null;
  notes: string | null;
}

// "terreno" (não arrendável) e "vendido" (já não é da família) saem de todas as
// métricas correntes — ver isCurrentProperty em calc.ts.
export type PropertyStatus = "arrendado" | "vago" | "outro" | "terreno" | "vendido";

export interface Property {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  municipality: string | null;
  parish: string | null;
  dicofre: string | null;
  typology: string | null;
  area_m2: number | null;
  vpt: number | null;
  vpt_year: number | null;
  matriz_article: string | null;
  status: PropertyStatus;
  notes: string | null;
}

export interface PropertyOwner {
  property_id: string;
  landlord_id: string;
  quota: number;
}

export type ContractStatus = "ativo" | "cessado";

export interface Contract {
  id: string;
  property_id: string;
  tenant_name: string;
  tenant_nif: string | null;
  pf_contract_no: string | null;
  start_date: string | null;
  end_date: string | null;
  rent: number;
  due_day: number;
  status: ContractStatus;
  notes: string | null;
}

export interface RentUpdate {
  id: string;
  contract_id: string;
  effective_date: string;
  old_rent: number | null;
  new_rent: number;
  reason: "coeficiente" | "acordo" | "novo_contrato" | "outro";
}

export interface Receipt {
  id: string;
  landlord_id: string;
  property_id: string | null;
  contract_id: string | null;
  pf_contract_no: string | null;
  receipt_number: string | null;
  ref_month: string;
  period_start: string | null;
  period_end: string | null;
  // ATENÇÃO (bug B1, 2026-07-24): `amount` é o valor ILÍQUIDO, a coluna "Valor" do
  // ListaRecibos — NÃO a "Importância recebida". O líquido é `amount - withholding`.
  // É o que os dois caminhos de import escrevem (gerar_sql_import.py e o wizard).
  // Quem guarda o cash líquido é `payments.amount`. Ver a nota em irs.ts.
  amount: number;              // valor ilíquido faturado (coluna "Valor")
  withholding: number;         // retenção na fonte (ilíquido menos importância recebida)
  issue_date: string | null;
  source: string;
  /** Recibo "Anulado" no Portal (S2, Fase 0). Hoje o import descarta os anulados, por
   *  isso está sempre false; a partir da Fase 6 passam a ser gravados marcados, e as
   *  leituras que contam dinheiro filtram `cancelled = false`. */
  cancelled?: boolean;
}

export type PaymentMethod = "transferencia" | "dinheiro" | "outro";

export interface Payment {
  id: string;
  contract_id: string;
  ref_month: string;
  amount: number;
  received_date: string | null;
  method: PaymentMethod;
  source: "manual" | "extrato" | "recibo";
  notes: string | null;
}

export type ExpenseCategory =
  | "imi"
  | "condominio"
  | "seguro"
  | "obras"
  | "financiamento"
  | "outras";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  imi: "IMI",
  condominio: "Condomínio",
  seguro: "Seguro",
  obras: "Obras",
  financiamento: "Financiamento",
  outras: "Outras",
};

export interface Expense {
  id: string;
  property_id: string | null;
  landlord_id: string | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
}

export interface MarketBenchmark {
  id: string;
  dicofre: string;
  parish_name: string | null;
  municipality: string | null;
  period: string;
  rent_median_m2: number | null;
  sale_median_m2: number | null;
  level: "freguesia" | "concelho";
  source: string;
}

export interface UpdateCoefficient {
  year: number;
  coefficient: number;
}

/** Estado de uma decisão da fila do Agora (S3). A chave é (kind, subject); `subject`
 *  vazio significa "a decisão é da carteira inteira", que é o caso da maioria dos
 *  geradores — eles emitem UM item agregado, não um por contrato. */
export interface InsightState {
  kind: string;
  subject: string;
  snoozed_until: string | null;
  dismissed_at: string | null;
  note: string | null;
  updated_at: string;
}
