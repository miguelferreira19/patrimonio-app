// Service worker mínimo. Existe por UMA razão: o Chrome no Android só oferece
// "Instalar aplicação" a sites que registem um service worker com handler de fetch.
// No iOS não é preciso nenhum — o Safari instala com o apple-touch-icon e o manifest.
//
// NÃO faz cache de nada, de propósito. Esta app mostra rendas, NIF e moradas de
// inquilinos; guardar respostas no disco do telemóvel seria espalhar dados pessoais
// para fora do Supabase, onde as políticas de RLS deixam de valer. Um "modo offline"
// aqui seria uma funcionalidade a pedir um problema.
//
// O handler de fetch abaixo é um no-op deliberado: como nunca chama respondWith(),
// o browser trata cada pedido exatamente como trataria sem service worker nenhum.
// Não há caminho por onde este ficheiro possa partir a app.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", () => {});
