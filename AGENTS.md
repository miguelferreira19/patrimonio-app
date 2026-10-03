# AGENTS.md — património-app

Ficheiro-índice para qualquer agente de IA (Codex, ChatGPT, Claude, …). O conteúdo operacional
vive em **`CLAUDE.md`** — lê-o inteiro antes de tocar em código; este ficheiro só diz por onde começar.

## Ordem de leitura
1. `CLAUDE.md` — regras operacionais, ambiente, design system, estrutura, o que NÃO é anomalia.
2. `PLANO.md` — estado (§0), roteiro V2, **Apêndice A** (obrigatório antes de mexer em atrasos, import ou schema), **Apêndice B** (pendências que só o utilizador resolve).
3. `V3.md` — briefing da V3 e regras visuais R1–R5.
4. `dados/README.md` — pipeline de import (fonte vs gerado); `SETUP.md` — arranque inicial.

## O essencial em dez linhas
- App interna da família para ~61 frações arrendadas. **PT-PT sempre.** Ótica de família (valores por inteiro).
- Live: https://patrimonio-app-beryl.vercel.app · Supabase `iidvzcgtfbpzhjbsrqql` · repo privado `miguelferreira19/patrimonio-app`.
- Node: bundled da Logitech (`start.cmd` mete o PATH). Gates: `npm run build` + `npm run check` (21 self-checks puros numa compilação só; um `*.check.ts` novo em `src/lib` é descoberto sozinho, nunca framework novo).
- Deploy é manual por CLI: **"faz deploy" = build + check verdes → `npx vercel@latest deploy --prod --yes` → commit + push.** Gate vermelho = não deployar nem commitar. Fora de um deploy, sem commits sem pedido.
- `dados/` tem dados pessoais reais (gitignored) — nunca commitar, nunca expor. Recolha automática de recibos a correr no Agendador do Windows (dias 15 e último).
- PostgREST corta a 1000 linhas → `paginateAll`. Smoke sem login não valida páginas com dados.
- `src/components/ui.tsx` **nunca** leva `"use client"`. A faixa (`components/faixa/`) é a única grelha mensal. Marcar pagamentos à mão acabou.
- Design "papel e tinta": tokens semânticos, sem verde de "ok", sem travessões, sem emojis, sem sombras fora de overlays.
- Schema: alterações idempotentes ao fim de `supabase/schema.sql`, coladas pelo utilizador no SQL Editor.
- Fim de tarefa: lista de ficheiros alterados + ações do utilizador.

Contexto pessoal e transversal do dono: `..\_CONTEXTO_IA\` (perfil, ambiente, estado de todos os projetos).
