import type { Role } from "./types";

export type Acao =
  | "registar_pagamento"
  | "registar_evento"
  | "gerir_caso"
  | "anular_pagamento"
  | "editar_contrato"
  | "ver_controlo"
  | "administrar";

const GESTOR: readonly Acao[] = ["registar_pagamento", "registar_evento", "gerir_caso"];

export function pode(role: Role, acao: Acao): boolean {
  if (role === "admin") return true;
  if (role === "gestor") return GESTOR.includes(acao);
  return false;
}

export const ROTULO_PAPEL: Record<Role, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  viewer: "Leitura",
};
