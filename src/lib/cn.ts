import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes com precedência correta do Tailwind.
 *
 *  Vive aqui, e não no ui.tsx, para que o kit (`components/kit/*`) e as primitivas
 *  possam usá-la sem que um importe o outro — um ciclo ui ↔ kit é frágil e não
 *  acrescenta nada. O `ui.tsx` re-exporta `cn` para o código que já a importa de lá.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
