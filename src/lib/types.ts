// Tipos das tabelas Supabase (escritos à mão — manter em sincronia com supabase/schema.sql)

export type Role = "admin" | "viewer";

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

export type PropertyStatus = "arrendado" | "vago" | "outro";

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
  amount: number;
  issue_date: string | null;
  source: string;
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
