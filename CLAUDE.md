# CLAUDE.md — património-app

Contexto operacional para agentes. Plano completo, backlog e conhecimento de domínio: **PLANO.md**
(o Apêndice A desse ficheiro é obrigatório antes de mexer em atrasos, import ou schema). Setup
inicial: SETUP.md.

## O que é
App interna (família) de gestão de ~50 arrendamentos: frações, contratos, recibos do Portal das
Finanças, pagamentos, despesas, benchmarks INE, atrasos, IRS. **PT-PT sempre.** Ótica de FAMÍLIA:
valores por inteiro ("bolo"), sem repartir por quotas — as quotas ficam em `property_owners` só
para o IRS.

**A V2 está construída** (arrancou 2026-07-24, Fases 0 a 7 fechadas — ver PLANO.md §0). Trocou 9
páginas por 3 superfícies (Agora, Carteira, Ano), o dashboard por uma fila de decisões com preço em
euros, e as grelhas por um objeto único (a faixa).

**A app está a passar para a V3** (arrancou 2026-07-26). A V3 não mexe no paradigma da V2: separa o
que o viewer vê do que o administrador vê, troca prosa por gráficos, e acrescenta uma quarta
superfície `/analise` (admin-only) com projeção de cashflow e recomendações. Regras visuais da V3 em
**V3.md**; roteiro por fases no plano da sessão.

## Ambiente (Windows)
- Node NÃO está no PATH global. Em Git Bash, prefixar sempre:
  `export PATH="/c/Users/migue/AppData/Local/Logi/LogiPluginService/PluginHosts/node22/node:$PATH"`
- Build (gate obrigatório antes de dar qualquer tarefa por terminada): `npm run build`
- `npm run check` = **15 self-checks puros** (arrears, health, calc, parse, irs, monthcell, rent,
  snapshot, insights, risk, import, renda, futuro, conselhos, inquilinos), sem BD nem framework. Casos novos vão para o `*.check.ts` do módulo respetivo — nunca um framework novo.
- Dev: `npm run dev` (ou `start.cmd`; launch.json tem "patrimonio-dev", porta 3000)
- Deploy: `npx vercel@latest deploy --prod --yes` (manual, com o PATH do node).
- Supabase: projeto `iidvzcgtfbpzhjbsrqql` (UE). Schema em `supabase/schema.sql` (idempotente, pode
  re-correr-se). RLS: authenticated lê tudo, só admin escreve; os GRANTs no fim do schema são
  NECESSÁRIOS (sem eles o PostgREST dá 42501).
- **Smoke sem login NÃO chega** para validar páginas com dados: o `anon` não tem GRANT em `payments`
  e `fetchAllPayments` rebenta com 42501. Validar autenticado, em dev ou produção.

## Regras
- Sem dependências novas sem justificação forte (lucide-react, recharts, clsx/tailwind-merge,
  papaparse, xlsx já existem).
- Escrita na BD só via server actions com `requireAdmin` (src/lib/actions/*) ou SQL no editor do Supabase.
- **PostgREST devolve no MÁXIMO ~1000 linhas por defeito** e `.limit()` NÃO passa por cima disso —
  usar `paginateAll` (`src/lib/paginate.ts`) em `payments`/`receipts` (já há >5000 linhas).
- Import de dados reais: há DOIS caminhos, e ambos são legítimos. (a) pipeline SQL
  (`dados/gerar_sql_import.py` → `dados/dividir_sql.py` → colar no SQL Editor) — a reversão oficial,
  receita em PLANO.md Apêndice A.1; (b) largar o ficheiro em `/admin`, que mostra o DIFF e só insere
  depois de confirmado (`lib/import/plano.ts` + `actions/importar.ts`). O wizard de 5 passos da V1 foi
  removido na Fase 6. **O caminho (b) nunca faz update nem delete, e NÃO cria frações nem contratos** —
  se mudares isso, a app volta a poder inventar entidades a partir de uma matriz mal lida.
- Recibos: dedupe GLOBAL por `receipt_number` = "contrato/recibo(#parte)" — nunca relaxar
  (compropriedade: o mesmo recibo aparece no export de dois senhorios).
- **`receipts.amount` é o valor ILÍQUIDO** (coluna "Valor"); o líquido é `amount - withholding`.
  Quem guarda cash líquido é `payments.amount`. Foi o bug B1 (o Anexo F somava a retenção duas
  vezes) — está no `irs.check.ts` como caso de regressão, não voltar a trocar.
- VPT no CSV do Portal vem em CÊNTIMOS (÷100) — já tratado em `dados/analise_senhorio.py` — **e
  vem multiplicado pela QUOTA do titular**. O VPT por inteiro está na caderneta predial, em EUROS
  (`dados/ler_cadernetas.py`); a app assume-o por inteiro e aplica a quota no `irs.ts`.
- **Uma despesa com `landlord_id` é a PARTE daquele senhorio** (foi o que ele declarou no Anexo F)
  e não se volta a multiplicar pela quota; sem `landlord_id` é conta da família e reparte-se. A
  regra vive só em `expenseTotalsByProperty` (irs.ts). `origem != 'registada'` nunca chega ao fisco.
- `dados/` contém dados pessoais reais (está no .gitignore) — nunca commitar nem expor.
- Não fazer commits/push sem pedido explícito do utilizador. **EXCEÇÃO (2026-07-29): um pedido
  de deploy inclui o git.** "Faz deploy" = `npm run build` e `npm run check` verdes →
  `npx vercel@latest deploy --prod --yes` → `git add -A`, commit e `git push`. O deploy sai da
  máquina local por CLI, não do repo: sem isto, produção fica à frente do GitHub e a sessão
  seguinte lê um repo que já não descreve o que está live. Gate vermelho = não deployar nem
  commitar.
- Alterações de schema: sempre idempotentes, acrescentadas ao fim de `supabase/schema.sql` e
  coladas à mão no SQL Editor pelo utilizador.

## Design system V2 — "papel e tinta"
Tudo em `src/app/globals.css` (Tailwind v4, `@theme`; não existe tailwind.config). Ler o cabeçalho
desse ficheiro antes de mexer em cor: explica a estratégia inteira.

- **Regra fundadora:** o que está confirmado é **TINTA**; o que exige ação é **verde-cofre**; o que
  precisa de atenção é **âmbar**; o que é perda é **vermelho**; o que é desconhecido ou futuro é
  **ardósia**. **Não há verde de "ok"** — uma carteira sã é preta sobre papel. Se aparecer verde de
  sucesso em código novo, está errado.
- **Código NOVO usa só tokens semânticos**, que trocam de par com o tema sozinhos (zero `dark:`):
  `bg-papel bg-carta bg-elevado bg-vellum`, `text-tinta text-tinta-2 text-tinta-3`,
  `border-regua border-regua-forte`, `text-acao bg-acao-tenue`, `atencao`, `perda`, `futuro`.
- As classes `zinc/teal/emerald/amber/red/sky` são **LEGADO da V1**: as escalas foram redefinidas
  no `@theme` para a paleta nova, por isso as páginas antigas já aparecem em papel-e-tinta sem
  edição. Não escrever classes novas com elas.
- Fontes: Geist (UI) + Geist Mono (meses, códigos matriciais, NIF, recibos) + **Newsreader**
  (`font-serif`) só em ledes, títulos do Ano e a linha de dinheiro. Nunca serifa em chrome de UI.
- Separação por **hairline** (`border-regua`), não por sombra. Sombra só em overlay (Modal, ficha,
  comando). Raios: 10px controles, 12px cartões (`rounded-xl`), 3px células de faixa, `rounded-full`
  só badges.
- Números: `tabular-nums` sempre. **Todo o euro passa pelo `<Money>`** (magnitude a peso pleno,
  cêntimos e € esbatidos). Percentagens/áreas por `<Figure>`.
- Movimento: tokens `--t-*` e `--e-*`. Nada acima de 420ms, nada em loop, entrada só no mount,
  stagger com teto de 240ms. `prefers-reduced-motion` desliga tudo (bloco único no globals.css).
- Proibido na UI: travessões "—", emojis, gradientes néon/roxos, animações infinitas.

## Componentes
- `src/components/ui.tsx` — primitivas partilhadas (Card, Button, buttonClass, Input/Select/Textarea,
  Badge, Table/Th/Td, EmptyState, PageHeader e StatCard já marcados `@deprecated`).
  **NUNCA acrescentar `"use client"` a este ficheiro**: as páginas server passam `icon={LucideIcon}`
  a StatCard/EmptyState; a diretiva cria uma fronteira de serialização e TODAS essas páginas crasham
  em runtime (digest; o build não apanha). Foi o hotfix de 2026-07-20. Componentes com hooks vão para
  ficheiro próprio — foi o que se fez ao `Modal` (`src/components/modal.tsx`, com Esc, focus trap e
  scroll lock), que o `ui.tsx` re-exporta para os importadores não mudarem.
- `src/components/kit/` — primitivas da V2: `Money`, `Figure`, `Lede`, `Confianca`, `Cobertura`.
  Sem hooks, logo sem `"use client"` (mesma regra do ui.tsx).
- `src/components/faixa/` — a FAIXA, o objeto central da V2. `celula.tsx` é o mês (a **altura da
  barra é a fração da renda recebida**); `faixa.tsx` é a linha por fração com eixo, fronteira
  desenhada e coluna da direita por lente; `pagamento-modal.tsx` é o formulário de marcar pagamento.
  É a ÚNICA implementação da grelha mensal — as três da V1 foram apagadas na Fase 3.
- `src/components/{nav,forms,charts,setup-notice}.tsx` — V1. O `charts.tsx` chegou a ser apagado na
  Fase 7 e **voltou** a pedido do utilizador (2026-07-25): a faixa responde "que mês falhou em que
  fração", o gráfico responde "quanto entrou contra o esperado, mês a mês", e é essa a leitura que a
  família quer. O custo de ~50 kB do `recharts` está assumido. `forms.tsx` (706 linhas de formulários
  modais) vai ser dissolvido em edição inline e no comando ⌘K; ver PLANO.md §10.7.
- CTAs que navegam (`<Link>`, `<a href="/api/...">`) usam `buttonClass(...)`, nunca strings de
  classes copiadas.

## Estado de um mês: uma só verdade
`src/lib/monthcell.ts` define o vocabulário único (`pago | parcial | falta | fora | futuro`) e
`monthCellStatus()`. A tolerância de 90% continua a viver em `isMonthSettled` (arrears.ts) — não
reimplementar. **`futuro` = além da fronteira de dados**: um mês ainda não importado NUNCA é "falta"
(era o bug B2, que fazia o mesmo mês aparecer vermelho em Pagamentos e verde em Atrasos).

## Estrutura
- `src/app/(app)/` páginas autenticadas. **Viewer vê 3 destinos** (Agora, Carteira, Ano); o resto é
  admin-only, com guarda de página (`redirect("/")`), não só filtro no menu:
  - Agora (`page.tsx`) — duas leituras SEPARADAS, `Estado` para viewer e `Decisoes` para admin.
    Não voltar a entrelaçá-las com `isAdmin ?` no meio da árvore.
  - `carteira` — a faixa, com lentes por `searchParams`. Para viewer a lente é **forçada a
    `risco` no servidor**; não chega esconder o seletor.
  - `ano/[ano]` — o documento fiscal. `fracoes/[id]`, `carta/[contractId]`,
    `inquilinos/[chave]` (ficha do arrendatário, admin-only; a chave é a MESMA de
    `concentracao().porInquilino` — `nif:...` ou `nome:...`).
  - Admin: **`analise`** (projeção, série anual, concentração, conselhos), `mercado`, `senhorios`,
    `saude`, `admin`.
  - `pagamentos`, `atrasos`, `fracoes`, `despesas` e `irs` são só **redirects** — não voltar a pôr
    conteúdo lá.
- `src/components/` ui.tsx, modal.tsx, kit/, faixa/, nav.tsx, charts.tsx, forms.tsx, setup-notice.tsx
- `src/lib/` cn.ts, format.ts (fmtEur/fmtDate/monthKey/splitEur), calc.ts, arrears.ts (metodologia de
  atrasos — PLANO.md Apêndice A.2), monthcell.ts, health.ts, irs.ts, ine.ts, data.ts, paginate.ts,
  parse.ts, types.ts, supabase/, actions/ — cada um com o seu `*.check.ts`
- `src/lib/portfolio/` load.ts (o ÚNICO I/O), snapshot.ts, insights.ts (a fila do Agora), risk.ts,
  ano.ts, e os módulos da V3: **renda.ts** (acumulado do ano, série anual, CAGR, rendas paradas,
  concentração por inquilino com HHI), **futuro.ts** (projeção a 24 meses aplicando o `pPagar` do
  risk.ts) e **conselhos.ts**. Os conselhos são uma lista SEPARADA da fila do Agora: reusam o tipo
  `Insight` mas não entram no `GERADORES` do insights.ts, senão o ritual mensal enchia-se de
  estratégia de longo prazo.
- `dados/` scripts Python de análise/import + exports reais por senhorio (Pai, Avo_Miguel, …)
- `supabase/schema.sql` — fonte de verdade do modelo de dados

## Pendente do utilizador (bloqueia valor, não código)
Lista completa e priorizada em **PLANO.md, Apêndice B**. O mais urgente: colar no SQL Editor o bloco
"V2 · FASE 0" do fim de `supabase/schema.sql` (índices únicos que só existiam no gerador Python,
`receipts.cancelled`, índices de contrato-mês).
