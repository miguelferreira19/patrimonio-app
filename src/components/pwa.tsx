"use client";

import { useEffect } from "react";

/**
 * Regista o service worker que torna a app instalável no telemóvel.
 *
 * Ficheiro próprio por causa do `useEffect`: a diretiva "use client" nunca entra
 * no `ui.tsx` nem no `kit/` (ver CLAUDE.md — cria uma fronteira de serialização e
 * as páginas server que passam `icon={LucideIcon}` crasham em runtime).
 *
 * O service worker em si (`public/sw.js`) não faz cache de nada. Ver o comentário
 * lá para o porquê.
 */
export function RegistarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Poder instalar é um extra: se o registo falhar (browser antigo, modo privado,
    // política do dispositivo), o site continua a funcionar exatamente na mesma.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
