# PLANO.md — roteiro do património-app

> **Para quem lê isto (humano ou modelo):** este documento é a fonte de verdade do estado do
> projeto e do que falta fazer. Foi escrito para que um modelo mais económico consiga pegar em
> qualquer item do backlog e implementá-lo sem redescobrir contexto. Antes de tocar em código,
> ler também `CLAUDE.md` (regras operacionais) e, para dados, `dados/analise_senhorio.py`
> (docstring tem as convenções todas). Atualizar este ficheiro no fim de cada sessão relevante.

---

## 1. Visão e estado atual (2026-07-22)

**Objetivo:** a família emite recibos no Portal das Finanças mas não tem controlo agregado.
A app dá esse controlo: carteira, recebimentos, atrasos, despesas, benchmarks de mercado, e no
futuro apoio ao IRS. 4 senhorios singulares (avô Miguel, avó Eva, pai António, tio Ilídio);
análises sempre em ótica de família (valores por inteiro).

**Feito:**
- v1 completa: dashboard, frações (+detalhe), pagamentos (grelha 12 meses), despesas, mercado
  (INE automático: indicadores 0014771 rendas medianas e 0012246 vendas), senhorios, admin
  (wizard de import, INE, utilizadores). Auth Supabase, 1.º utilizador = admin (trigger).
- Supabase criado e ligado (projeto `iidvzcgtfbpzhjbsrqql`, UE), schema corrido, RLS ativo.
- **Import de dados reais por SQL** (pipeline `dados/`): Pai ✔ e Avô Miguel ✔ (ver §4).
- Redesign visual (2026-07-19): design system coerente, ver CLAUDE.md §Design system.
- Página de Atrasos com metodologia própria (ver §5).
- 2026-07-22: checklist "Este mês" de recibos por emitir (P1-3), StatCard de ocupação (P2-9
  parcial), backup `.xlsx` da carteira em Admin (P1-7), página **Saúde dos dados** (P1-5) e
  atalho de pagamento em dinheiro (P1-2). Em produção.

**Pendências imediatas de dados (não de código):**
- Tio Ilídio: exports do Portal ainda não existem em `dados/Tio/` — quando existirem, correr o
  pipeline (§4) tal e qual.
- Avó Eva: NÃO terá pasta própria — o export do avô representa o casal (decisão 2026-07-18).
- Áreas (m²), tipologia e freguesia/dicofre das frações estão vazias — preencher à mão a partir
  das cadernetas prediais (UI de edição de fração já existe) para ativar €/m² vs INE no Mercado.
- Confirmar com o pai: titularidade dos 2/3 restantes do `182341-U-6004`; gralha `2783-L` vs
  `2783-K` (dados do pai); `182341-U-4364` (avô) aparece em contratos/recibos mas não no
  património predial — apurar código correto.

---

## 2. Ambiente e comandos

- Windows 11; node NÃO está no PATH — ver CLAUDE.md para o prefixo do PATH (Logitech node22).
- `npm run build` = gate de qualidade obrigatório. `npm run dev` na porta 3000.
- `npm run check` = self-checks puros (atrasos + saúde dos dados), sem BD nem framework.
- Smoke sem login NÃO chega para validar páginas com dados: o `anon` não tem GRANT em
  `payments` e `fetchAllPayments` rebenta (42501). Validar autenticado, em dev ou produção.
- Deploy: ainda NÃO há commits nem repo remoto (decisão pendente do utilizador) — ver P0-3.
- Supabase SQL Editor = via de administração de dados (corre como superuser, ignora RLS).
- Python (para `dados/`): pandas, xlrd, openpyxl já instalados no ambiente do utilizador.

## 3. Arquitetura (mapa rápido)

- **BD (supabase/schema.sql):** profiles (role admin/viewer), landlords, properties,
  property_owners (quota %), contracts (pf_contract_no único por índice, rent, status),
  rent_updates, receipts (dedupe global por receipt_number), payments (unique
  contract_id+ref_month; source manual/extrato/recibo), expenses, market_benchmarks (INE),
  update_coefficients, função `sync_contract_rents()`.
- **App:** páginas server-first em `src/app/(app)/**` (fetch com `getSession()` +
  `createClient()` de `src/lib/supabase/server`), client components só para interação
  (tabelas com filtros, grelhas, formulários em modal via `src/components/forms.tsx` +
  server actions em `src/lib/actions/*` com `requireAdmin`).
- **Cálculo:** `src/lib/calc.ts` (mercado, contratos ativos por mês), `src/lib/arrears.ts`
  (atrasos, ver §5), `src/lib/format.ts` (fmtEur, fmtDate, monthKey…).
- **Import em massa:** `dados/gerar_sql_import.py` (reusa `analise_senhorio.py`) gera SQL
  idempotente; `dividir_sql.py` parte em blocos <150KB coláveis; verificação no fim.

## 4. Pipeline de import de um senhorio (receita completa)

1. Obter do Portal das Finanças: `ListaContratos.xls`, `ListaRecibos.xlsx`,
   `patrimonio_predial.csv` → pôr em `dados/<Pasta>/` (ex.: `dados/Tio/`).
2. `python dados/analise_senhorio.py <Pasta>` → gera `Analise_<Pasta>.md`; LER e validar
   (divergências, anulados, multi-mês, VPT plausível).
3. Garantir que `FOLDER_TO_LANDLORD` em `gerar_sql_import.py` mapeia a pasta ao nome certo do
   senhorio no seed (`Miguel`, `Eva`, `António`, `Ilidio`).
4. `python dados/gerar_sql_import.py <Pasta>` → `import_<pasta>.sql` (idempotente).
5. `python dados/dividir_sql.py import_<pasta>.sql` → partes; colar POR ORDEM no SQL Editor.
6. Conferir os SELECTs de verificação da última parte contra o `Analise_<Pasta>.md`.
7. Na app: Admin → sincronizar rendas se necessário (`sync_contract_rents`).

Notas: recibos multi-mês são divididos por mês em cêntimos EXATOS; "Anulado" excluído;
"Importância recebida" (líquida de retenção) é o cash; payments nunca pisam marcações manuais
(`on conflict do nothing`). O import do avô (2026-07-19) incluiu um bloco de LIMPEZA que apagou
os dados errados introduzidos pelo wizard — padrão a reutilizar se voltar a acontecer.

## 5. Metodologia de Atrasos (implementada em src/lib/arrears.ts)

Fonte: `payments` (recebimentos reais) × contratos ativos. Conceitos:
- **Renda de referência (`referenceRent`, base de TUDO):** `min(contract.rent, mediana dos meses
  com pagamento nos últimos 24m)`. `contract.rent` é escalar, bruto e com o valor de HOJE, mas
  os payments são cash LÍQUIDO e histórico — compará-los diretamente gerava falsos positivos
  em massa (ver correção 2026-07-20 abaixo). A mediana absorve retenção na fonte (25% em
  inquilinos-empresa) e atualizações de renda sem precisar de `rent_updates` nem de coluna
  `withholding`. Nunca sobe acima de `rent`; onde diverge, a UI mostra "recebe X".
- **Mês liquidado (`isMonthSettled`):** recebido ≥ 90% da renda de referência (`PAID_TOLERANCE`).
- **Mês vencido:** renda vence ao dia 1; conta como devido a partir do dia 8 (`GRACE_DAYS = 8`).
- **Horizonte de dados (`dataHorizonMonth`, trava CRÍTICA):** o último mês devido nunca passa o
  mês mais recente (não futuro) com pagamentos na carteira. Os recibos são importados em lote
  (§4); enquanto o mês corrente não é importado, cobrar atraso por ele dava dívida falsa a TODOS
  os contratos. É a causa de fundo dos falsos positivos (RCFDT ficava com meses recentes ainda
  não importados a contar como atraso). A página da fração faz a mesma trava via query barata do
  máximo `ref_month`. Inquilino que parou mesmo continua apanhado — os outros contratos empurram
  o horizonte para a frente.
- **Streak de atraso:** nº de meses consecutivos não liquidados desde o último mês liquidado até
  ao último mês devido. Sem pagamentos de todo → desde o início do contrato (ou "sem histórico").
- **Dívida estimada:** `min(streak, 24) × renda de referência`. Meses parciais NÃO somam défice
  por cima (o streak já os conta como mês inteiro). Contratos sem recibos há >12m (`STALE_MONTHS`)
  não somam dívida — badge "confirmar se cessou" (ex.: 512797/Ilídio, sem recibos desde 2021-10).
- **Cadência própria:** mediana do intervalo entre meses liquidados (janela 36m); se ≥2 (ex.:
  Loja S. Pedro paga ao trimestre), severidade ajustada + badge "paga a cada ~N meses".
- **Severidade:** ok / atenção (1) / atraso (2-3) / crítico (>3), ajustada pela cadência.
- **Gráfico esperado-vs-recebido:** 12 meses FECHADOS (exclui o corrente, que tem recibos por
  emitir); esperado = Σ renda de referência dos contratos JÁ em vigor nesse mês; recebido só de
  contratos ativos (mesmo universo). Antes usava renda atual constante → gap fantasma + penhasco.
- **Armadilha CRÍTICA (resolvida 2026-07-20):** `.limit(50000)` NÃO passa por cima do max-rows
  do Supabase (~1000). A leitura do histórico COMPLETO (>5000 linhas) vinha truncada → contratos
  para lá da linha 1000 apareciam como "nunca"/24 e o que ficava a cavalo aparecia parcial (o
  RCESQ mostrava jun 2025 em vez de jun 2026, contradizendo a ficha da fração). Fix: `fetchAllPayments`
  em `data.ts` pagina por `.range()` (helper puro `paginateAll` em `paginate.ts`, testado no
  self-check G/H). As leituras com piso de 12-13 meses (dashboard 535, pagamentos 493) ficam bem
  abaixo das 1000 — só precisam de paginar acima de ~80 contratos ativos.
- **Self-check:** `npm run check:arrears` (src/lib/arrears.check.ts) — 6 casos reais que davam
  falso positivo; corre o `computeArrearsRow` real, sem framework. Vitest completo continua P2-4.

**Correção de falsos positivos (2026-07-20):** a comparação contra `contract.rent` fazia meses
perfeitamente pagos parecerem em falta; quando NENHUM mês atingia a renda atual, caía no ramo
"sem mês pago" e inventava 24×renda. Casos nos dados reais: retenção na fonte (6204271: recibo
600/pago 450 → falso 7200€), atualização de renda sem recibos novos (RCFDT 68686 → falso 7104€),
dupla contagem de parciais, contratos-zombie. Resultado nos dados atuais: dívida total estimada
44.539€ → 25.375€ (−43%). O 512797 mantém-se (é atraso real, provável contrato por cessar).
**Ronda 2 (mesma data):** a causa de fundo era o horizonte de dados — na BD live os recibos dos
meses recentes ainda não estavam importados e o app cobrava atraso por eles a toda a gente. Trava
`dataHorizonMonth` limita o último mês devido ao último mês importado. Com isto o RCFDT vai a 0
(toda a dívida dele era falsa: meses não importados). Ficheiros: `src/lib/arrears.ts`,
`src/app/(app)/atrasos/arrears-client.tsx`, `src/app/(app)/fracoes/[id]/page.tsx`,
`src/lib/arrears.check.ts`. Deploy manual (`npx vercel deploy --prod`) — 2 deploys nesta sessão.

Limitações honestas (não esconder ao utilizador): payments derivam de RECIBOS — renda paga em
dinheiro sem recibo aparece como atraso; a app mede "recibos em falta", que é o proxy possível.
A renda de referência normaliza quem paga sistematicamente a menos do que devia — daí o desvio
ser mostrado ("recebe X"), não escondido. Quando o P2-2 importar a retenção real, a referência
passa a sair do dado em vez da mediana.

## 6. Backlog priorizado

Formato: cada item tem Objetivo / Ficheiros / Passos / Aceitação / Armadilhas. Implementar UM
item de cada vez, `npm run build` no fim, atualizar este ficheiro.

### P0 — fundações (fazer primeiro)

**P0-1 · Importar o Tio Ilídio** (bloqueado por dados do utilizador)
- Seguir §4 com `dados/Tio/`. Aceitação: SELECTs de verificação = Analise_Tio.md; frações em
  compropriedade com o Pai NÃO duplicam (dedupe por matriz/receipt_number fazem o trabalho);
  quota família por imóvel ~100% no consolidado (`python dados/analise_senhorio.py` sem args).

**P0-2 · Completar fichas das frações** (utilizador + UI existente)
- Preencher area_m2, typology, dicofre/freguesia via UI (Frações → editar) a partir das
  cadernetas. Aceitação: página Mercado mostra €/m² e desvio vs INE para as frações arrendadas.

**P0-3 · Versionar e fazer deploy (Vercel)** — ✅ FEITO 2026-07-20
- Commit inicial `main` (60 ficheiros; .gitignore verificado: dados/ e .env* fora; identidade
  git repo-local Miguel/margaridaministro2002@gmail.com, igual ao palpites).
- **PRODUÇÃO: https://patrimonio-app-beryl.vercel.app** (projeto Vercel "patrimonio-app",
  conta miguelferreira19, CLI autenticada). Deploy por `npx vercel@latest deploy --prod --yes`
  (com o PATH do node Logitech). Sem env vars no Vercel: `src/lib/env.ts` tem fallbacks
  (anon key é pública por design; RLS protege). Login verificado no domínio de produção.
- **Repo GitHub FEITO 2026-07-22:** https://github.com/miguelferreira19/patrimonio-app (privado),
  remote `origin`, `main` com histórico. Falta ligar o repo ao projeto no Vercel
  (Settings → Git → Connect) para o deploy deixar de ser manual.
- FALTA (opcional): Supabase Auth → definir Site URL para o domínio se um dia se usarem links
  por email (password login funciona sem isso).

**P0-5 · Fechar o registo de contas no Supabase** (AÇÃO DO UTILIZADOR — segurança, prioridade máxima)
- **Problema (encontrado 2026-07-22):** o registo público de contas está ABERTO
  (`GET /auth/v1/settings` devolve `"disable_signup": false`). Como a anon key é pública por
  design — vai no bundle JS do site em produção, não é o repo que a expõe — e o RLS dá
  `for select to authenticated using (true)` a TODAS as tabelas (schema.sql, bloco do loop de
  políticas), qualquer pessoa na internet se pode registar, confirmar o email no próprio inbox
  e ler a carteira inteira: frações, contratos, nomes e NIFs de inquilinos, rendas, recibos, VPT.
  O 1.º utilizador já existe (é admin), por isso um registo novo entraria como viewer — mas
  viewer LÊ TUDO. Tornar o repo privado não mitiga nada disto.
- **Fix:** Supabase → Authentication → Sign In / Providers → Email → desligar "Allow new users
  to sign up" (nalgumas versões: Authentication → Settings → "Allow new users to sign up").
  Depois: Authentication → Users, confirmar que só lá está a conta do utilizador.
- Custo zero em funcionalidade: as contas da família criam-se à mão em Authentication → Add user
  (é exatamente o fluxo do P0-4) e o ecrã de login nunca teve botão de registo — a porta aberta
  era a API do Supabase, não a UI.
- Aceitação: `curl "<url>/auth/v1/settings?apikey=<anon>"` devolve `"disable_signup": true`.
- Se um dia se quiser abrir o registo, o RLS tem de deixar de ser `using (true)` e passar a
  filtrar por senhorio/perfil — hoje não filtra nada.

**P0-4 · Contas da família (viewers)**
- Objetivo: criar utilizadores para pai/tio/avô (viewers) via Admin → utilizadores; testar que
  viewer não consegue escrever (RLS) e que a UI esconde botões de escrita. Aceitação: 2.º login
  real em leitura.

### P1 — valor rápido

**P1-1 · Alertas de coeficiente anual de rendas**
- Objetivo: quando sai o coeficiente anual (ex.: 1,0216 para 2026), sugerir a renda atualizável
  por contrato e registar a atualização.
- Ficheiros: `update_coefficients` (tabela já existe), nova secção em Admin para inserir o
  coeficiente do ano; em Contratos/Frações, badge "renda atualizável desde MM/AAAA" +
  ação admin "aplicar" que escreve em `rent_updates` e atualiza `contracts.rent`.
- Passos: server action `applyRentUpdate(contract_id, coefficient_year)`; cálculo = renda ×
  coeficiente (arredondar a 2 casas, regra: só aplicável 12 meses depois da última atualização/
  início; mostrar data-base). Aceitação: aplicar num contrato de teste cria rent_update com
  old/new e reason='coeficiente'; grelha de pagamentos passa a esperar a nova renda no mês certo.
- Armadilhas: NÃO aplicar automaticamente a todos — sempre ação explícita por contrato.

**P1-2 · Registo rápido de pagamentos em dinheiro** — ✅ FEITO 2026-07-22
- Botão "Em dinheiro" no modal da grelha de Pagamentos (só em meses ainda sem pagamento): grava
  com `method='dinheiro'`, valor = renda contratada e data = hoje, sem passar pelo Select.
  Reusa `markPayment`; o `save(method)` extraído do submit é a única alteração de lógica.

**P1-3 · Checklist mensal de recibos a emitir** — ✅ FEITO 2026-07-22
- Cartão "Este mês: recibos por emitir" no dashboard (`src/app/(app)/page.tsx`): contratos ativos
  sem recibo do mês corrente (query a `receipts` por `ref_month`, emitido = match por
  `contract_id` OU `pf_contract_no`), link para o Portal. Contratos de cadência própria só entram
  quando `lastPaidMonth + cadence <= mês corrente` (reusa as linhas de `computeArrears` que o
  dashboard já calcula). Falta validar a lista contra o Portal com dados reais.

**P1-4 · Refresh INE agendado**
- Objetivo: atualizar benchmarks trimestralmente sem clique manual. Vercel Cron (route handler
  `/api/cron/ine` com CRON_SECRET) → reutilizar a action de `src/lib/actions/market.ts`.
- Armadilha: a action atual exige admin — extrair o núcleo para função sem auth chamada pelo
  cron com secret, mantendo a action para o botão.

### P2 — consolidação

**P2-1 · Conciliação bancária (STANDBY até se saber o banco)**
- Import de extrato CSV → matching heurístico com payments/contratos (valor+mês+nome parecido),
  ecrã de revisão aceitar/rejeitar, source='extrato'. Desenhar tabela `bank_transactions` nova
  (migração idempotente no schema.sql). Só arrancar quando houver extratos reais.

**P2-2 · IRS Anexo F por senhorio**
- Objetivo: mapa anual por senhorio: rendas brutas por fração × quota (aqui SIM usam-se as
  quotas de property_owners), retenções (ListaRecibos tem retenção — hoje não é importada:
  acrescentar coluna `withholding` a receipts no schema + no gerador SQL), despesas dedutíveis
  por fração (expenses por categoria). Export CSV/Excel por ano fiscal.
- Armadilha: recibos multi-mês repartidos — o Anexo F é por ano de RECEBIMENTO; usar issue_date.

**P2-3 · Documentos por fração/contrato**
- Supabase Storage (bucket privado + RLS por role), upload na página da fração (cadernetas,
  contratos assinados, seguros). Tabela `documents` (property_id/contract_id, tipo, path).

**P2-4 · Testes automatizados mínimos**
- Vitest para `src/lib/arrears.ts` e `calc.ts` (casos: multi-mês, cadência trimestral, carência,
  parcial, contrato novo). Aceitação: `npm test` verde; casos de fronteira cobertos.

### P3 — mais tarde / estudo

- **P3-1 Emissão automática de recibos no Portal** — estudar viabilidade legal/técnica
  (autenticação AT, provavelmente não vale o risco; alternativa: deep-link + checklist P1-3).
- **P3-2 PWA/mobile** — manifest + ícones; a UI já é responsiva.
- **P3-3 Multi-tema (dark)** — só se a família pedir; hoje é light-only por decisão.
- **P3-4 Histórico/auditoria de alterações** — tabela audit_log via triggers nas tabelas core.

### Novos temas aprovados (2026-07-20) — "tornar mais profissional"

Origem: pedido do utilizador + análise dos IRS 2025 do Pai e do Avô (ver §9). Ordenados por valor.

**P1-5 · Página "Saúde dos dados"** — ✅ FEITO 2026-07-22
- `src/app/(app)/saude/page.tsx` (server, só leitura) + `src/lib/health.ts` (puro) +
  `src/lib/health.check.ts` (8 casos, `npm run check:health`); link em `nav.tsx` → Referência.
- 7 checks: contrato-zombie, renda desalinhada, contratos sobrepostos, rendas ≤0, quotas ≠100%,
  recibos órfãos, ficha incompleta. Severidade erro/aviso/"a completar" com contagem no topo e
  link por anomalia.
- Reutilização deliberada: contrato-zombie e renda desalinhada saem de `computeArrears`
  (`stale`, `expectedRent`) em vez de reanalisar recibos. Recibos órfãos por `count` (head:true),
  nunca por leitura das >5000 linhas.
- Decisões: a retenção na fonte aparece como AVISO (é causa legítima, a app não a distingue de
  renda desatualizada — resolve-se com o P2-5); frações SEM quotas registadas não contam como
  erro de quotas (é ficha incompleta); contrato cessado com data de fim não é sobreposição.
- `npm run check` corre os dois self-checks (arrears + health).

**P1-6 · CI no GitHub (Actions)** — ✅ FEITO 2026-07-22
- `.github/workflows/ci.yml`: node 22, `npm ci`, `npm run build` + `npm run check` (os dois
  self-checks) em push para `main` e em PR. Não precisa de segredos — `src/lib/env.ts` tem
  fallbacks e os self-checks são puros.
- **Repo: https://github.com/miguelferreira19/patrimonio-app (privado), `main` com histórico.**

**P1-7 · Export/backup que a família controla** — ✅ FEITO 2026-07-22
- Route handler `src/app/api/export/route.ts` (GET, `requireAdmin`, `paginateAll` por tabela com
  `.order()` obrigatório) devolve um `.xlsx` com uma folha por tabela (landlords, properties,
  property_owners, contracts, receipts, payments, expenses). Link `<a href="/api/export">` no
  cartão "Cópia de segurança" do Admin — sem JS de cliente. NÃO exporta `market_benchmarks`
  (regenerável do INE). Mais tarde: agendar (Vercel Cron → Storage).

**P2-5 · Retenção na fonte e caução no modelo** (pré-requisito do P2-6)
- Objetivo: `receipts.withholding` + `contracts.deposit` no schema e no gerador SQL de `dados/`.
  A retenção já vem no ListaRecibos (bruto − "Importância recebida"). Alimenta o Anexo F (crédito)
  E torna a renda de referência dos Atrasos EXATA em vez de mediana estimada (ver arrears.ts).
- Armadilha: inquilino-empresa retém ~25%; particular não. Migração idempotente no schema.sql.

**P2-6 · Otimizador de IRS Anexo F por senhorio** (evolui o P2-2)
- Objetivo: por senhorio/ano — rendas ilíquidas, gastos DEDUTÍVEIS (mapear `expenses`: só
  conservação/condomínio/IMI/selo/taxas; EXCLUIR financiamento e obras de valorização), retenções,
  predial líquido; e SIMULAR englobamento vs taxa autónoma 28% vs taxas reduzidas de longa duração
  (§9). Mostrar imposto estimado por opção + a melhor. Export Excel do Anexo F.
- Ficheiros: `src/lib/irs.ts` (puro + self-check) + página. Armadilha: é ESTIMATIVA — rótulo claro
  "confirmar no simulador da AT / com contabilista"; não é aconselhamento fiscal vinculativo.

**P2-7 · Elegibilidade de taxa reduzida (art. 72.º) por contrato**
- Objetivo: por contrato de HABITAÇÃO, usar início+duração para assinalar a taxa reduzida a que
  podia aceder (≥5a 15%, ≥10a 10%, ≥20a 5%) vs os 28% atuais, e estimar €/ano poupados. Requer o
  campo `typology`/uso (habitação vs comércio) e duração — depende do P0-2.
- Aceitação: lista acionável "contratos a comunicar à AT (Portaria 110/2019)"; não altera IRS
  sozinho, é um alerta. Armadilha: comércio/garagens NÃO beneficiam; confirmar caso a caso.

**P2-8 · Ciclo de vida dos contratos**
- Objetivo: avisos de fim/renovação/denúncia com antecedência legal; e GERAR a carta de
  atualização de renda no formato/prazo legais (liga ao P1-1). Aceitação: badge no dashboard +
  carta em PDF/docx pronta a enviar.

**P2-9 · Ocupação / vacância** — parcial 2026-07-22
- FEITO: StatCard "Ocupação" no dashboard (% de frações com contrato ativo + nomes das vagas,
  link para Frações). Deriva dos contratos, não de `properties.status` (campo manual que fica
  desatualizado). FALTA: período de vazio e renda perdida (precisa dos gaps entre contratos).

**P2-10 · Relatório anual PDF por senhorio**
- Objetivo: retrato da carteira (ocupação, yield, evolução de atrasos, despesas por categoria)
  exportável. Complementa o Anexo F do P2-6.

**P3-5 · Monitor de AIMI**
- Objetivo: somar VPT por proprietário e comparar com o limite (600k singular / 1,2M casal);
  sinalizar exposição a AIMI. A distribuição de propriedade por herdeiros reduz AIMI — MAS é
  planeamento sucessório: só sinalizar e remeter para contabilista, nunca recomendar a ação.

## 7. Armadilhas e decisões permanentes (não re-litigar)

- Ótica de família: valores por INTEIRO em toda a apresentação; quotas só para IRS (P2-2).
- Dedupe global de recibos por `receipt_number` composto — protege compropriedade Pai+Tio.
- VPT do CSV do Portal em cêntimos ÷100; "Importância recebida" = cash líquido de retenção.
- Recibos "Anulado" nunca contam; multi-mês divide-se em cêntimos exatos (resto na última).
- PostgREST: máx 1000 linhas por defeito → `.limit()` explícito em payments/receipts.
- Import por SQL Editor > wizard (superuser, idempotente, verificável). Wizard = casos pequenos.
- Payments com `on conflict do nothing` — reimports nunca pisam marcações manuais.
- Node só via pasta Logitech (CLAUDE.md); caminhos com espaços ("OneDrive - ISEG") → aspas.
- **`src/components/ui.tsx` NÃO pode levar `"use client"`** (é módulo partilhado): as páginas
  server passam `icon={LucideIcon}` a StatCard/EmptyState; com a diretiva cria-se uma fronteira
  de serialização e TODAS essas páginas crasham em runtime (digest, build não apanha). Foi o
  hotfix de 2026-07-20. Para reproduzir/validar sem login: página temporária em
  `src/app/login/debug/page.tsx` (o middleware deixa passar tudo o que começa por /login).
- `dados/` é gitignored e contém dados pessoais — nunca sair daí.
- Sem commits/push sem pedido explícito do utilizador.
- **A anon key é pública e o repo não é a fronteira de segurança.** Ela viaja no bundle JS do
  site em produção; privado ou público, o repo não muda a exposição. Quem protege os dados é
  (1) o registo de contas estar FECHADO e (2) o RLS. Como o RLS é `using (true)` para qualquer
  autenticado, uma conta = leitura total da carteira. Qualquer alteração a auth ou a políticas
  passa por aqui primeiro — ver P0-5.
- Repo GitHub privado por decisão: não guarda dados, mas revela a estrutura da carteira.

## 8. Como orquestrar modelos económicos neste projeto

- Um item do backlog por agente/sessão; dar-lhe: o item copiado deste ficheiro + CLAUDE.md.
- Exigir sempre: ler os ficheiros na íntegra antes de editar; `npm run build` limpo no fim;
  lista de ficheiros alterados no relatório; PT-PT na UI; primitivas de `ui.tsx` (não inventar
  markup); zero "—"/emoji na UI.
- Mudanças de schema: sempre idempotentes (`create table if not exists`, `alter ... add column
  if not exists`) acrescentadas a `supabase/schema.sql` + coladas no SQL Editor manualmente.
- Rever com `git diff` depois de cada agente (quando houver repo) e só depois avançar.
- Em caso de dúvida de produto: perguntar ao utilizador, não assumir (ele decide rápido).

## 9. Análise IRS 2025 (Pai e Avô) — leveres fiscais para o produto

> NÃO é aconselhamento fiscal vinculativo. São estimativas/observações para desenhar as features
> P2-6/P2-7/P3-5. Qualquer decisão numa declaração real confirma-se no simulador da AT ou com
> contabilista. Fonte: `dados/Pai/IRS_PAI.pdf`, `dados/Avo_Miguel/IRS_Miguel.pdf` (ano 2025).

**Números-chave.** Pai (António, NIF 186274220, solteiro/divorciado, incapacidade 62%): Anexo F
rendas ilíquidas 45.835€, gastos só ~6.6k (conservação apenas **1.500€**), retenção 1.200€, pensão
10.440€; optou por ENGLOBAMENTO; AIMI 668€ (VPT 695k). Avô (Miguel 123645891 + Eva 123645905,
casados, tributação CONJUNTA, Miguel 60% incap.): Anexo F rendas 90.458€ (frações a 50/50, por isso
duplicadas A/B), gastos ~38.9k (conservação **26.587€**), retenção 150€, pensões 15.742€; optou por
ENGLOBAMENTO; AIMI 1.314€ (VPT 1,39M, usa o limite de casal 1,2M). Mais-valia rústica pequena (G).

**Levers (por ordem de impacto), que viram features:**
1. **Taxa reduzida de longa duração (art. 72.º) — Q4.2 VAZIO nos dois → maior lever.** TODOS os
   contratos estão no Q4.1 (regime geral). Muitos são antigos (1978, 1995, 1999, 2004, 2010-2016):
   contratos de HABITAÇÃO com ≥5/10/20 anos podiam estar a 15%/10%/5% em vez de 28%. Exige uso
   habitacional + duração + comunicação à AT (Portaria 110/2019). Comércio/garagens não entram
   (ex.: garagem 68631 a 25€/mês). → **P2-7**.
2. **Englobamento vs 28% autónoma — os dois escolheram englobar.** Não é claramente errado: para o
   Avô (casal, quociente, pensões baixas, incap.) englobar pode ganhar; para o Pai (individual,
   ~56k, taxa média mais alta) os 28% podem ganhar. É um cálculo a refazer TODOS os anos. → **P2-6**.
3. **Despesas dedutíveis subaproveitadas (sobretudo o Pai): 1.500€ vs 26.587€ do Avô** em 29 vs 46
   contratos. Se há manutenção real sem fatura com NIF do senhorio, perde-se dedução ao marginal
   (~28-40%). Dedutível em F: conservação/condomínio/IMI/selo/taxas; NÃO financiamento nem obras de
   valorização. → **P2-6** (mapa) + disciplina de faturas.
4. **Retenção na fonte** (inquilino-empresa retém ~25%): é crédito, não poupança, mas tem de ser
   modelada (crédito no Anexo F + exatidão da renda de referência). → **P2-5**.
5. **AIMI**: ambos pagam e deduzem no Anexo F (Q9). Distribuir propriedade por herdeiros reduz o
   AIMI (limite 600k/pessoa) — planeamento sucessório, só sinalizar. → **P3-5**.
