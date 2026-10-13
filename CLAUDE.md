# CLAUDE.md — património-app

Contexto operacional para agentes, sobre o ESTADO ATUAL. Roteiro ativo: **PLANO_CLAREZA.md**.
Conhecimento de domínio e metodologias: **PLANO.md** (o Apêndice A é obrigatório antes de mexer em
atrasos, import ou schema; o Apêndice B lista o que só o utilizador resolve). Setup: SETUP.md.
Planos e auditorias antigos (V3, V4, V5): `docs/historico/`. Os comentários do código que citam
"REDESENHO.md §x", "V3.md" ou "IMPLEMENTACAO_GESTAO.md" referem-se a essa pasta.

## O que é
App interna da família para ~53 frações arrendadas (61 com terrenos e vendidos): contratos, recibos
do Portal das Finanças, cobranças, despesas, rentabilidade, IRS. **PT-PT sempre.** Ótica de FAMÍLIA:
valores por inteiro ("bolo"); as quotas de `property_owners` só entram em Impostos e Senhorios.
Quem usa é a família: **respostas diretas e visuais** (caixas, barras, tiras de meses), sem
storytelling; explicações só dentro de "Detalhes". Ver PLANO_CLAREZA.md §3.

## Ambiente (Windows)
- Node NÃO está no PATH global. Em Git Bash, prefixar sempre:
  `export PATH="/c/Users/migue/AppData/Local/Logi/LogiPluginService/PluginHosts/node22/node:$PATH"`
- Gates (obrigatórios antes de dar uma tarefa por terminada): `npm run build` e `npm run check`
  (27 self-checks puros, uma compilação `tsconfig.check.json` strict, runner `scripts/checks.cjs` que
  descobre sozinho todo o `src/lib/**/*.check.ts`). Casos novos vão para o `*.check.ts` do módulo,
  nunca um framework novo.
- **Nunca correr `npm run build` com o dev ligado** (partilham a `.next`): parar o dev, apagar
  `.next`, voltar a arrancar.
- Dev: `npm run dev` (launch.json "patrimonio-dev", porta 3000). A sessão do browser de dev está
  autenticada contra a BD de produção: só leitura, salvo pedido explícito.
- Deploy: `npx vercel@latest deploy --prod --yes` (manual, com o PATH do node). **Um push para o
  GitHub também dispara um deploy de produção** (integração Git da Vercel).
- Supabase `iidvzcgtfbpzhjbsrqql` (UE). Schema em `supabase/schema.sql` (idempotente). RLS:
  authenticated lê tudo, só admin escreve; os GRANTs no fim do schema são NECESSÁRIOS (sem eles 42501).
- Smoke sem login NÃO chega: o `anon` não tem GRANT em `payments`. Validar autenticado.

## Regras de trabalho
- Sem dependências novas sem justificação forte (lucide-react, recharts, clsx/tailwind-merge,
  papaparse, xlsx já existem).
- Não fazer commits/push sem pedido explícito. **Um pedido de deploy inclui o git:** build e check
  verdes → deploy → `git add -A`, commit, push. Gate vermelho = não deployar nem commitar.
- Alterações de schema: idempotentes, ao fim de `supabase/schema.sql`, coladas pelo utilizador no
  SQL Editor (o bloco da V5 também vive em `supabase/gestao-operacional.sql`).
- `dados/` tem dados pessoais reais (gitignored): nunca commitar nem expor. Ler `dados/README.md`
  antes de mexer (na raiz só os `.py` são fonte).

## Dados e domínio (não voltar a partir)
- **PostgREST devolve no máximo ~1000 linhas** e `.limit()` não passa por cima: `paginateAll`
  (`src/lib/paginate.ts`) em `payments`/`receipts`/tudo o que possa crescer.
- **Leituras nunca engolem erros**: `linhas()`/`linha()` (`lib/supabase/dados.ts`) lançam com o
  nome da tabela; `(q.data ?? []) as T[]` é proibido. **Escritas validam no servidor** (`lib/validar.ts`;
  números escritos à mão por `parseAmount`). Titulares: upsert e poda. Upload: nunca `upsert: true`.
- Escrita na BD só via server actions com `requireAdmin` (`src/lib/actions/*`) ou SQL no editor.
- Recibos: dedupe GLOBAL por `receipt_number` = "contrato/recibo(#parte)". **`receipts.amount` é
  ILÍQUIDO**; o líquido é `amount - withholding`; `payments.amount` é cash líquido (bug B1).
- VPT do CSV do Portal vem em cêntimos e × quota do titular; o VPT por inteiro vem da caderneta.
- **Despesas:** a parte de um senhorio calcula-se só com `expenseShare` (irs.ts). Uma despesa com
  `landlord_id` é a PARTE dele; sem `landlord_id` é da família e reparte-se. Por inteiro, quando
  vários co-titulares declaram a mesma (fração, categoria, ano), o valor é Σ declarado ÷ Σ quotas de
  quem declarou (`quotasDeclarantes` + `scopedExpense`, gestao.ts); nunca cada linha a 100%.
  `origem != 'registada'` nunca chega ao fisco. Obras/conservação são pontuais: média de 3 anos.
- **IRS:** taxa autónoma 28%, mas 25% na habitação celebrada desde 07/10/2023 (`taxaAutonoma`,
  Lei 56/2023). Taxa reduzida do art. 72.º pela DURAÇÃO DO PRAZO do contrato, nunca pelos anos de
  casa; sem prazo registado não há redução (`prazoDesconhecido`). **AIMI**: fora os rústicos (`-R-`)
  e os urbanos de comércio/serviços (`classifyUso`); taxas no VPT.
- Import: (a) pipeline SQL e recolha automática dias 15 e último (`dados/recolher_recibos.py` →
  `scripts/importar_recibos_automatico.py`, só recibos novos); (b) largar ficheiro em `/admin` com
  diff. **O caminho (b) nunca faz update/delete nem cria frações ou contratos.** A recolha corre na
  máquina local (o Portal barra IPs de datacenter); segredos em `dados/.env`.
- Relógio de Lisboa no servidor (`instrumentation.ts`). CSP em `next.config.ts`: um serviço novo
  chamado do browser tem de entrar no `connect-src`. O cron do INE falha fechado sem `CRON_SECRET`.

## Estado de um mês: uma só verdade
Vocabulário único (`monthcell.ts`, `ESTADO_MES_LABEL`): **Pago** (recibo emitido ≥ 90% da renda de
referência, `isMonthSettled`, ou pagamento registado à mão) · **Em atraso** (mês JÁ TERMINADO, de
fonte ativa, sem recibo) · **Por receber** (o mês em curso) · **Sem informação** (fonte parada ou
por importar) · **Sem contrato**. `MonthCellStatus` fica só para desenhar a célula da faixa.
- Um recibo emitido conta como renda paga: quem o emite é o senhorio, quando recebe.
- `lastDueMonthKey` = sempre o mês ANTERIOR ao corrente (os recibos entram nas recolhas do 15 e do
  último dia; a carência de 8 dias fazia de outubro dívida a dia 13).
- A fronteira é POR FONTE (`horizontePorContrato`): uma fonte cuja última emissão ficou 2+ meses
  atrás é `parada` (a herança do avô, desde 02/07/2026) e os contratos dela ficam "sem informação".
- Pagamentos registados à mão (`payment_movements`/`allocations`, V5) substituem o recibo do mesmo
  contrato-mês ANTES de qualquer cálculo (`comPagamentosManuais` em `load.ts`); nunca se somam.
- A dívida é `emAtrasoDaCarteira` (insights.ts): a mesma lista no Hoje, na Cobranças (`devedores`,
  por inquilino), nos Imóveis, na ficha da fração e na do inquilino. Contratos sem recibos há 12+
  meses (`stale`) ficam fora da dívida e do "por receber" e têm uma tarefa própria.

## Saúde dos dados: o que NÃO é anomalia (`health.ts`, casos C4/D/E)
- `renda_desalinhada` só quando os recibos NÃO confirmam a renda (a retenção de 25% explica o buraco).
- `contratos_sobrepostos` só entre contratos ATIVOS; o snapshot usa o mais recente.
- `quotas` abaixo de 100% é `info` (o tio Ilídio, frações minoritárias); acima de 100% é erro.

## Navegação e superfícies
Cinco destinos, iguais no computador e no telemóvel (`components/shell.tsx`):
- **Hoje** (`/`): o mês em curso, os meses fechados, "Para fazer" (fila do `insights.ts`; admin) ou
  "Quem está em atraso" (viewer), oportunidades realizáveis, prazos. Liga a `/tarefas`.
- **Cobranças** (`/cobrancas`): em atraso por inquilino (barra + tira de 12 meses), sem informação,
  por receber. `/cobrancas/extrato` (admin) é a tabela mês a mês; `/cobrancas/[contrato]?mes=` é o
  extrato de um mês, com registo de pagamento sem recibo. `/inquilinos/[chave]` (todos).
- **Imóveis** (`/imoveis`, `/imoveis/[chave]`, `/fracoes/[id]`): prédios em cartões; atalhos para
  Contratos (`/contratos`), Documentos (`/arquivo`) e Histórico mensal (`/carteira`, a faixa).
- **Rentabilidade** (`/rentabilidade`): resultado por prédio e fração (`portfolio/rentabilidade.ts`,
  12 meses até à fronteira comum), oportunidades; separadores Mercado, Despesas e Projeção (admin).
- **Impostos** (`/impostos`): o documento do ano (`/ano/[ano]`), Anexo F, art. 72.º, AIMI.
- Admin (menu da conta): Tarefas, Senhorios, Documentos, Saúde dos dados, Admin.
- Redirects estáticos das rotas antigas em `next.config.ts`; `/dinheiro` e `/relatorios` são páginas
  porque o destino depende do separador. `/tarefas` é UMA lista (tarefas, cobranças, manutenção,
  vagas) com o tipo em etiquetas.
- Prédio = artigo matricial sem a fração (`predios.ts`): fora do prédio usar `nomeDaFracao()`, nunca
  `property.name` cru; nomes de pessoas por `nomeProprio()`; meses por `monthLabel()`.

## Design system "banca calma"
Tudo em `src/app/globals.css` (Tailwind v4, `@theme`; não existe tailwind.config).
- **Tinta** = confirmado; **verde-cofre** (`acao`) = exige ação; **âmbar** (`atencao`) = atenção;
  **vermelho** (`perda`) = perda; **ardósia** (`futuro`) = desconhecido/futuro. **Não há verde de "ok".**
- Código novo usa só tokens semânticos (`bg-papel bg-carta bg-elevado bg-vellum`, `text-tinta(-2/-3)`,
  `border-regua(-forte)`, `acao atencao perda futuro`). `zinc/teal/emerald/amber/red/sky` são legado.
- Tipografia Inter; Geist Mono para códigos. Cartões `rounded-2xl`, botões `rounded-full`.
  Separação por hairline; sombra só em overlay. Movimento ≤ 420 ms, sem loops; reduced-motion desliga.
- **Todo o euro passa pelo `<Money>`**; percentagens pelo `<Figure>`/`fmtPct`; `tabular-nums` sempre.
- Proibido na UI: travessões "—", emojis, gradientes néon, animações infinitas.

## Componentes
- `src/components/ui.tsx`: primitivas. **NUNCA `"use client"` neste ficheiro** (as páginas server
  passam ícones; a diretiva rebenta em runtime, o build não apanha). Componentes com hooks vão para
  ficheiro próprio (`modal.tsx`, `folha.tsx`). `kit/` (Money, Figure, Lede, Seccao, Confianca,
  Cobertura) também sem hooks.
- `faixa/` é a ÚNICA grelha mensal. Não há marcação manual de pagamentos nas células; o pagamento
  sem recibo regista-se no extrato do mês (V5, `actions/gestao.ts`, RPCs transacionais e idempotentes).
- `charts.tsx`: o `FluxoMensalChart` do Hoje (recebido por mês contra a renda de referência).
  Nunca o líquido mês a mês (as despesas do Anexo F ficam todas a 31-12).
- `forms.tsx` e `gestao/forms.tsx`: formulários (≈730 linhas cada, abaixo do limite de 800).
- CTAs que navegam usam `buttonClass(...)`.
- Cartas: `api/minuta/[tipo]/[contractId]` (.docx, texto em `lib/minutas.ts`); `/carta/[id]` explica
  quando a atualização de renda não se aplica. `enquadrarMinutas()` decide quais se oferecem.
- Arquivo: bucket privado `documentos`, caminho `<artigo matricial>__<ficheiro>` (`lib/documentos.ts`);
  upload direto do browser para o Storage.

## Estrutura de `src/lib`
`portfolio/load.ts` é o ÚNICO I/O da carteira (`getSnapshot`, `getSnapshotComRaw`); `snapshot.ts`
puro. Módulos puros com check: arrears, monthcell, gestao, irs, health, calc, rent, minutas,
portfolio/{insights, inquilinos, mes, rentabilidade, futuro, renda, risk, conselhos, agenda, imoveis,
predios, pesquisa, ano}. Os conselhos (`/rentabilidade?tab=projecao`) são uma lista separada da fila
do Hoje; os que ordenavam património ao lado de rendimento saíram (PLANO_CLAREZA.md 3.5).

## Pendente do utilizador
- Herança do avô: código do Portal → pasta e credenciais em `dados/` para a recolha (PLANO_CLAREZA.md,
  Fase 2). Os recibos retroativos resolvem os 21 contratos "sem informação".
- NIF dos inquilinos e prazos dos contratos: não vêm nos exports do Portal, só dos documentos.
- 62 recibos sem contrato (`/saude/recibos`); lote 2e (confirmar se cessou); 3 quotas por fechar.
- Lista completa e antiga: PLANO.md, Apêndice B.
