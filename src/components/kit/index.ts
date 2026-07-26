// Kit da V2. Nenhum destes módulos leva "use client" (nenhum usa hooks), para que as
// páginas server os possam importar — mesma regra do ui.tsx, ver CLAUDE.md.
export { Money, Figure, TOM_TEXTO, type Tom } from "./money";
export { Lede } from "./lede";
export { Seccao } from "./seccao";
export { Confianca, type Nivel } from "./confianca";
export { Cobertura, type CoberturaFactos } from "./cobertura";
export { DeviationBadge, PropertyStatusBadge } from "./badges";
