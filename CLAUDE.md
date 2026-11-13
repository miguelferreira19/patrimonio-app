# CLAUDE.md · património-app

Contexto operacional sobre o estado atual. Roteiro ativo:
**docs/superpowers/specs/2026-11-11-reforma-design.md**.
Implementação: `docs/superpowers/plans/2026-11-11-reforma.md`.
Domínio: **PLANO.md**, Apêndice A obrigatório antes de mexer em atrasos, import ou schema;
Apêndice B para pendências do utilizador. Arranque inicial: `SETUP.md`.
Histórico: `docs/historico/`, incluindo `PLANO_CLAREZA.md`, `AUDITORIA_CLAREZA.md`,
`PLANO_VISUAL.md` e `PLANO_VISUAL_RESULTADO.md`. Citações antigas de REDESENHO/V3 vivem aí.

## O que é
App interna da família para ~53 frações arrendadas (61 com terrenos e vendidos): contratos,
recibos do Portal das Finanças, cobranças, despesas, rentabilidade e IRS. **PT-PT sempre.**
Ótica de família: valores por inteiro; quotas de `property_owners` só em Impostos e Senhorios.
Respostas diretas e visuais: caixas, barras, tiras de meses. Explicações só em "Detalhes".

## Ambiente (Windows)
- Node NÃO está no PATH global. Antes de npm/npx, em PowerShell:
  `$env:PATH = "C:\Users\migue\AppData\Local\Logi\LogiPluginService\PluginHosts\node22\node;" + $env:PATH`
  Em Git Bash:
  `export PATH="/c/Users/migue/AppData/Local/Logi/LogiPluginService/PluginHosts/node22/node:$PATH"`
- Gates: `npx tsc --noEmit` e `npm run check`; antes de deploy, também `npm run build`.
  Check compila uma vez com `tsconfig.check.json`, descobre `src/lib/**/*.check.ts` e depois
  executa `src/components/**/*.check.cjs` por `scripts/checks-ui.cjs`, em processos separados.
  Casos novos no check do módulo, sem framework novo. Os testes usam dados sintéticos.
- Checks em paralelo: `npx tsc -p tsconfig.check.json --outDir .check-<id>` e, em PowerShell,
  `$env:CHECK_DIR = ".check-<id>"; node scripts/checks.cjs`. Em Bash:
  `CHECK_DIR=.check-<id> node scripts/checks.cjs`. Nunca apagar a `.check` de outro agente.
  Sem agentes em paralelo: `npm run check` completo, com `CHECK_DIR` removido do ambiente.
- Nunca correr build com o dev ligado: partilham a `.next`. Build só na porta de fase,
  com dev parado; os construtores da reforma não o correm.
- Dev: `npm run dev` (launch.json "patrimonio-dev", porta 3000). Browser autenticado na BD de
  PRODUÇÃO: só leitura, salvo pedido explícito. Smoke sem login não valida páginas com dados.
- Live: https://patrimonio-app-beryl.vercel.app. Supabase `iidvzcgtfbpzhjbsrqql` (UE).
- Deploy manual: `npx vercel@latest deploy --prod --yes`. Um push para GitHub também pode
  disparar produção pela integração Vercel. Na reforma, `main` e produção só com OK explícito.
- Schema idempotente em `supabase/schema.sql`; reforma aditiva em `supabase/reforma.sql`,
  repetida no fim do schema. GRANTs são necessários (sem eles, 42501).

## Regras de trabalho
- Sem dependências novas sem justificação forte; usar as bibliotecas já instaladas.
- Sem commits/push sem pedido explícito. Pedido de deploy inclui build e check verdes,
  deploy, commit e push. Gate vermelho impede deploy e commit. Respeitar o ramo e o caderno ativo.
- Schema só aditivo, idempotente e compatível com produção; o utilizador cola no SQL Editor.
- `dados/` tem dados pessoais reais, gitignored: nunca commitar nem expor. Ler `dados/README.md`
  antes de mexer. Respeitar as restrições de acesso do caderno; não abrir exports ou segredos.
- Ficheiros novos até 400 linhas, funções até 50; páginas até 200, resto em componentes da área.
- Fim de tarefa: ficheiros alterados, verificações e ações do utilizador.

## Dados e domínio (não voltar a partir)
- PostgREST corta a ~1000 linhas; `.limit()` não resolve. Usar `paginateAll` em tabelas crescentes.
- Leituras por `linhas()`/`linha()` (`lib/supabase/dados.ts`), com erros visíveis e nome da tabela;
  nunca `(q.data ?? []) as T[]`. Escritas validadas no servidor por `lib/validar.ts`.
- Escrita só via server actions (`lib/actions/*`) com `requireAdmin` ou `requireGestor`, segundo
  a ação; nunca a partir de páginas. Números manuais por `parseAmount`. Upload sem `upsert: true`.
  Titulares: upsert e poda. Permissões exigidas no servidor, mesmo com botão escondido.
- Recibos: dedupe GLOBAL por `receipt_number` = "contrato/recibo(#parte)".
  `receipts.amount` é ilíquido; líquido = amount - withholding; `payments.amount` é cash líquido.
  Anulados nunca contam como pagos. Dividir recibos de vários meses em cêntimos exatos.
- VPT do CSV do Portal vem em cêntimos e × quota; o VPT inteiro vem da caderneta.
- Despesas por senhorio só por `expenseShare` (`irs.ts`): com `landlord_id`, a linha já é a parte
  dele; sem titular, reparte-se pela quota. Por inteiro, co-titulares da mesma fração/categoria/ano:
  soma declarado ÷ soma quotas de quem declarou (`quotasDeclarantes` + `scopedExpense`, gestao.ts).
  `origem != 'registada'` não chega ao fisco. Obras/conservação: média de três anos.
- IRS: taxa autónoma 28%, 25% na habitação celebrada desde 07/10/2023 (`taxaAutonoma`). Art. 72.º
  pela duração do prazo, nunca pelos anos de casa; sem prazo não há redução (`prazoDesconhecido`).
  AIMI exclui rústicos (`-R-`) e urbanos de comércio/serviços (`classifyUso`); taxas sobre VPT.
- Import: recolha local no HP (`ssh hp-coletor`, tarefa `patrimonio-recibos`, segunda e quinta
  às 09:00), `dados/recolher_recibos.py` e `scripts/importar_recibos_automatico.py`.
  Várias contas via `PF_CONTAS`, com compatibilidade para a conta antiga. Falha numa conta não
  impede as restantes; saída diferente de zero se alguma falhar. Credenciais nunca no código.
  Atualiza anulados, refresca meses e guarda `receipt_observations` e `collection_runs`.
  `first_seen` só quando medido; não inventar emissão anterior ao arquivo de recolhas.
  Import por ficheiro em `/admin` com diff: não atualiza/apaga nem cria frações ou contratos.
- Relógio de Lisboa no servidor (`instrumentation.ts`). CSP em `next.config.ts`; serviço novo
  do browser exige `connect-src`. Cron do INE falha fechado sem `CRON_SECRET`.

## Estado de um mês: uma só verdade
Vocabulário `ESTADO_MES_LABEL` (`monthcell.ts`): **Pago**, **Em atraso**, **Por receber**,
**Sem informação**, **Sem contrato**. `MonthCellStatus` só desenha a célula da faixa.
- Pago: recibo emitido ≥90% da referência (`isMonthSettled`) ou pagamento manual. Um recibo
  emitido conta como renda paga: é o senhorio que o emite quando recebe.
- Em atraso: mês já terminado de fonte ativa, sem recibo. `lastDueMonthKey` é o mês anterior.
  Por receber: mês corrente. Fonte parada ou por importar: sem informação.
- Horizonte por fonte (`horizontePorContrato`): última emissão há 2+ meses significa fonte parada.
- Pagamentos manuais (`payment_movements`/allocations) substituem o recibo do contrato-mês
  antes de calcular (`comPagamentosManuais` em load.ts); nunca somar as duas fontes.
- Dívida única: `emAtrasoDaCarteira` (`insights.ts`), usada em Início, Rendas, Imóveis e fichas.
  Contratos stale, sem recibos há 12+ meses, fora da dívida/por receber e com tarefa própria.

## Saúde dos dados: o que NÃO é anomalia
- `renda_desalinhada` só se os recibos não confirmarem a renda; retenção de 25% explica diferenças.
- `contratos_sobrepostos` só entre ativos; snapshot escolhe o mais recente.
- Quotas abaixo de 100% são informação, acima de 100% são erro (`health.ts`, C4/D/E).

## Navegação e superfícies
Cinco destinos no computador e no telemóvel (`components/shell.tsx`):
- **Início** (`/`): estado do mês, pagas/por receber, três maiores devedores, fontes e recolha.
  "A fazer": até seis linhas; até três de cartas, depois promessas, prazos e tarefas de admin.
  Se houver mais de três cartas, a terceira linha agrega as restantes e abre `/cartas`.
- **Rendas** (`/rendas`): inquilinos por estado, pesquisa e A vigiar; `/rendas/extrato` só admin.
- **Imóveis** (`/imoveis`): prédios; Com problemas só gravidade 2/3, gravidade 1 a acompanhar.
  Fichas em `/imoveis/[chave]` e `/fracoes/[id]`; histórico mensal continua na faixa.
- **Finanças** (`/financas`): Resultado, Impostos, Calendário e Poupança. Mercado dentro de
  Resultado; Despesas e Projeção só admin. Calendário com valores estimados e estados feitos;
  IMI pelo ano mais recente com despesas do titular, até três anos atrás; feed `.ics` mantido.
  Poupança por contrato (art. 72.º), despesas por lançar e englobamento por senhorio.
- **Mais** (`/mais`): Tarefas, Contratos, Documentos, Cartas e Conta; admin também vê Controlo,
  Senhorios, Saúde dos dados e Administração. Rotas antigas redirecionam em `next.config.ts`.
- A ficha `/inquilinos/[chave]` é o centro: estado, tira, registo, cartas em escada, diário e factos.
  Prédio = artigo sem fração; frações por `nomeDaFracao()`, pessoas por `nomeProprio()`.
- Papéis: admin, gestor, viewer. `getSession()` dá role/isAdmin/isGestor; `pode(role, acao)` em
  `lib/papeis.ts`. Gestor regista pagamentos, diário e casos; viewer só lê. Controlo só admin,
  protegido na página, ações e RLS das observações. Menu e botões respeitam o papel.

## Design system · direção C "Sinal"
- Tokens semânticos em `src/app/globals.css` (Tailwind v4, `@theme`, sem tailwind.config).
  Tinta: pago/confirmado; perda: atraso, laranja; futuro: por receber, azul; cinza tracejado:
  sem informação. Sem verde de "ok". Usar papel/carta/tinta/regua/perda/futuro e suas variantes.
- Bricolage Grotesque nos títulos/números, DM Sans no texto. Corpo 15/16 px, mínimo 12 px.
  `tabular-nums`; euros por `<Money>`, percentagens por `<Figure>`/`fmtPct`, meses por `monthLabel()`.
- Cor em blocos inteiros, cantos de 20 px, botões em pílula. Sem sombras fora de overlays,
  gradientes, travessões ou emojis. Números dominam; explicações só em `<details>` "Detalhes".
- Uma coluna a 375 px, sem scroll horizontal, toque ≥44 px; computador com largura máxima.
  Movimento existente: `.stagger`, `.cartao-link`, `.barra-cresce`, `.celula-in`, `.destaque`.
  Esqueletos estáticos e `.vazio`; respeitar reduced-motion e impressão. Sem loops.

## Componentes
- `src/components/ui.tsx` e `kit/` nunca levam `"use client"`. Hooks em ficheiro próprio.
  Primitivas: `Bloco`, `Tira`, `Pilulas`, `Linha`, `Barra`, `Money`, `Figure`, `Iniciais`, `Seccao`,
  `Lede`; exemplos em `/admin/catalogo`. Reutilizar, sem estilos ou primitivas paralelos.
- Páginas server; carteira só por `getSnapshot()`/`getSnapshotComRaw()` (`portfolio/load.ts`).
  Módulos puros sem I/O, React, Next ou Supabase; hoje recebido como argumento.
- `faixa/` é a única grelha mensal. Pagamento sem recibo regista-se no extrato, por RPC idempotente.
- Diário: `registarNoDiario` (`lib/actions/diario.ts`), contacto/promessa/carta/nota, com autor/data.
  Registar em folha própria; botões só com isGestor. Promessas têm data e montante.
- Cartas: lembrete, interpelação, resolução; passos saltados ficam Dispensado. Também acordo,
  atualização e oposição. Texto em `lib/minutas.ts`, .docx em `api/minuta/[tipo]/[contractId]`.
- Arquivo privado `documentos`, caminho `<artigo matricial>__<ficheiro>` (`lib/documentos.ts`).
  CTAs de navegação por `buttonClass(...)`. Charts: recebido contra referência, nunca despesas
  anuais a 31-12 tratadas como fluxo mensal. `charts.tsx` respeita reduced-motion.

## Estrutura de src/lib
`portfolio/load.ts` é o único I/O da carteira; `snapshot.ts` puro. Cálculos em módulos com
`*.check.ts`: atrasos, estado mensal, gestão, IRS, saúde, agenda, poupança, problemas, rendas,
diário, controlo e restantes módulos de portfolio. Loaders específicos mantêm paginação e erros.

## Pendente do utilizador
- Herança: credenciais e pasta no HP, configuração e ensaio seco conforme `dados/README.md`.
- NIF dos inquilinos e prazos dos contratos exigem documentos; não vêm nos exports habituais.
- Recibos sem contrato, confirmação do lote 2e e quotas por fechar: lista em PLANO.md, Apêndice B.
