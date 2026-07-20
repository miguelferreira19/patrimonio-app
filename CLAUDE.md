# CLAUDE.md — património-app

Contexto operacional para agentes. Plano completo e backlog: **PLANO.md**. Setup inicial: SETUP.md.

## O que é
App interna (família) de gestão de ~50 arrendamentos: frações, contratos, recibos do Portal das Finanças, pagamentos, despesas, benchmarks INE, atrasos. **PT-PT sempre.** Ótica de FAMÍLIA: valores por inteiro ("bolo"), sem repartir por quotas — as quotas ficam em `property_owners` só para o IRS futuro.

## Ambiente (Windows)
- Node NÃO está no PATH global. Em Git Bash, prefixar sempre:
  `export PATH="/c/Users/migue/AppData/Local/Logi/LogiPluginService/PluginHosts/node22/node:$PATH"`
- Build (gate obrigatório antes de dar qualquer tarefa por terminada): `npm run build`
- Dev: `npm run dev` (ou `start.cmd`; launch.json tem "patrimonio-dev", porta 3000)
- Supabase: projeto `iidvzcgtfbpzhjbsrqql` (UE). Schema em `supabase/schema.sql` (idempotente, pode re-correr-se). RLS: authenticated lê tudo, só admin escreve; os GRANTs no fim do schema são NECESSÁRIOS (sem eles o PostgREST dá 42501).

## Regras
- Sem dependências novas sem justificação forte (lucide-react, recharts, clsx/tailwind-merge, papaparse, xlsx já existem).
- Escrita na BD só via server actions com `requireAdmin` (src/lib/actions/*) ou SQL no editor do Supabase.
- **PostgREST devolve no MÁXIMO 1000 linhas por defeito** — usar `.limit(N)` explícito em `payments`/`receipts` (já há >5000 linhas).
- Import de dados reais: preferir o pipeline SQL (`dados/gerar_sql_import.py <Pasta>` → `dados/dividir_sql.py` → colar partes no SQL Editor), NÃO o wizard da app. O wizard fica para reimportações pequenas.
- Recibos: dedupe GLOBAL por `receipt_number` = "contrato/recibo(#parte)" — nunca relaxar (compropriedade: o mesmo recibo aparece no export de dois senhorios).
- VPT no CSV do Portal vem em CÊNTIMOS (÷100) — já tratado em `dados/analise_senhorio.py`.
- `dados/` contém dados pessoais reais (está no .gitignore) — nunca commitar nem expor.
- Não fazer commits/push sem pedido explícito do utilizador.

## Design system (após redesign 2026-07)
- Tokens no `globals.css` (@theme, Tailwind v4 — não existe tailwind.config). Fontes Geist + Geist Mono via next/font.
- Acento ÚNICO teal (ações `bg-teal-800`, ativo `teal-700`, focus `ring-teal-600`); base zinc; cores semânticas só para estado real (emerald=ok/pago, amber=atenção/parcial, red=crítico, zinc=neutro).
- Forma: `rounded-lg` em tudo; `rounded-full` só badges. Números sempre `tabular-nums`; códigos matriciais e meses em `font-mono`.
- Primitivas em `src/components/ui.tsx` (PageHeader, Card, StatCard, Table, Badge, Button, Modal, EmptyState) — usar SEMPRE estas, não inventar markup ad-hoc.
- Proibido na UI: travessões "—", emojis, gradientes néon/roxos, animações infinitas.

## Estrutura
- `src/app/(app)/` páginas autenticadas: dashboard (page.tsx), fracoes (+[id]), pagamentos, atrasos, despesas, mercado, senhorios, admin
- `src/components/` ui.tsx (primitivas), nav.tsx, charts.tsx, forms.tsx, setup-notice.tsx
- `src/lib/` format.ts (fmtEur/fmtDate/monthKey), calc.ts, arrears.ts (metodologia de atrasos — ver PLANO.md §5), data.ts (getSession), types.ts, parse.ts, ine.ts, supabase/, actions/
- `dados/` scripts Python de análise/import + exports reais por senhorio (Pai, Avo_Miguel, …)
- `supabase/schema.sql` — fonte de verdade do modelo de dados
