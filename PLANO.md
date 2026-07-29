# PLANO.md — roteiro do património-app (V2)

> **Para quem lê isto (humano ou modelo):** este documento é a fonte de verdade do estado do projeto e
> do que falta fazer. Substituiu o plano da V1 em 2026-07-24. Antes de tocar em código, ler também
> `CLAUDE.md` (regras operacionais) e, para dados, `dados/analise_senhorio.py` (a docstring tem as
> convenções todas). Atualizar este ficheiro no fim de cada sessão relevante.
>
> **O Apêndice A não é histórico: é conhecimento comprado com erros já pagos.** Nunca redescobrir o que
> lá está. Nunca apagar.

---

## 0. Estado

**Em produção:** https://patrimonio-app-beryl.vercel.app · repo https://github.com/miguelferreira19/patrimonio-app
(privado) · Supabase `iidvzcgtfbpzhjbsrqql` (UE) · deploy manual `npx vercel@latest deploy --prod --yes`.

**A carteira, em números reais (2026-07):** 4 senhorios singulares (avô Miguel, avó Eva, pai António,
tio Ilídio), dos quais 2 modelados. ~61 frações, 92 contratos (**43 ativos**), ~5.800 linhas de recibos
com cobertura 2014-08 a 2026-08, ~5.100 pagamentos. Renda contratada 15.441 €/mês. Recebido nos últimos
12 meses 162.304 €. VPT total 1.846.727 €. 15 frações nunca arrendadas (terrenos).

**V1 concluída** (dashboard, frações + ficha, pagamentos, atrasos, despesas, mercado com INE
automático, senhorios, saúde dos dados, IRS/Anexo F, carta de atualização de renda, admin com wizard,
auth, PWA, tema escuro, CI). Import real por SQL feito para o Pai e o Avô Miguel. Backlog P0–P3 da V1
fechado.

**A V2 arrancou em 2026-07-24.** Ver §1 em diante.

**Fase 0 (fundação) FEITA:** tokens semânticos papel-e-tinta no `@theme` (as escalas Tailwind foram
redefinidas, por isso a app inteira mudou de aparência sem editar as ~6.300 linhas de UI); Newsreader
para ledes; kit `Money`/`Figure`/`Lede`/`Confianca`/`Cobertura`; `Modal` com Esc, focus trap e scroll
lock em ficheiro próprio; `buttonClass` (matou as 5 strings de CTA copiadas); célula do mês unificada
(`lib/monthcell.ts` + `components/faixa/celula.tsx`) onde a V1 tinha três implementações; bugs B1,
B2, B3 e B4 corrigidos; migração S1/S2/S6 escrita. Contraste medido no browser nos dois temas.

**Fase 1 (snapshot) FEITA no essencial:** `lib/portfolio/{load,snapshot,index}.ts` — uma leitura e um
cálculo por request, com `getSnapshot()` embrulhado em `cache()`. `buildSnapshot` é puro e
`check:snapshot` **prova paridade** contra a lógica antiga do dashboard (fluxo mensal, atrasos,
ocupação, vazios, mercado) sobre o mesmo conjunto de dados, mais 8 invariantes. Já leem o snapshot:
dashboard, Atrasos, Pagamentos, Saúde dos dados, Mercado e Frações — as três primeiras corriam
`computeArrears` sobre o histórico completo, cada uma por sua conta, no mesmo request.

**Fase 2 (Agora) FEITA na forma mínima:** `lib/portfolio/insights.ts` — 9 geradores puros sobre o
snapshot, gate de materialidade a 250 €/ano, e `check:insights` com o **teste de aceitação C1** (a
fila tem de caber em 8 itens). O dashboard morreu: `/` é a linha de dinheiro mais a fila agrupada por
natureza do dinheiro. Zero componentes client novos, zero dependências, ações são links.

**C1 falhou à primeira com os dados reais e foi corrigido:** o gerador de atrasos emitia um item por
contrato, dando 20 linhas. Passou a UM item agregado que nomeia os maiores e remete para `/atrasos`.
O detalhe já existia lá; a fila prioriza, a página detalha. O invariante está agora no check.

**Estado real da carteira, medido em 2026-07-25:** 3 decisões, 25.411 €. Emitir 19 recibos (6.480 €),
cobrar 19 contratos em atraso (18.931 €), preencher 47 fichas (até 10.830 €/ano, marcado `assumido` e
por isso FORA do número de topo). O grupo "Dinheiro a poupar" está VAZIO — art. 72.º, atualizações de
renda e desvio ao mercado dependem todos de tipologia, área e DICOFRE, que faltam em 47 fichas. É por
isso que preencher fichas é hoje a ação de maior valor por minuto, e é a app que o diz.

**Fase 2 FECHADA (2026-07-25):** S3 feito — tabela `insight_state`, ações `snoozeInsight`/
`dismissInsight`/`restoreInsight`, botões "Adiar 30 dias" e "Dispensar" em cada decisão e um
`<details>` no fim com as silenciadas e um link para repor. Nenhuma das duas pede confirmação: são
reversíveis num clique e nenhuma apaga um facto — o gerador continua a correr, o item só deixa de se
mostrar. Caso H do `insights.check.ts` prova as três direções (adiar esconde, adiar expirado volta a
mostrar, dispensar esconde) e que o total do topo desce em conformidade.

**Ainda por fazer na Fase 2, e movido para a Fase 5:** geradores de regime de IRS, despesas
dedutíveis em falta e AIMI. Precisam de recibos por ANO FISCAL, e o snapshot não os carrega de
propósito (§7.1). O sítio natural é o `/ano/[ano]`, que já vai ler esses dados — construí-los agora
obrigaria a alargar o snapshot só para eles.

**Fase 3 (Carteira) FEITA no essencial (2026-07-25):** `/carteira` é uma superfície e um objeto — a
faixa. `components/faixa/faixa.tsx` acrescenta à célula o que faltava para ela ser o objeto central:
eixo temporal com o ano em janeiro, a **linha da fronteira desenhada com rótulo**, a coluna da
direita ditada pela lente e a linha final com a carteira inteira (que é o que torna o gráfico
"Últimos 12 meses" redundante). Cinco lentes (`Cobrança · Renda · Mercado · Risco · Vazios`), janela
12/24 meses e escopo por senhorio, tudo em `searchParams` — partilhável por link e sobrevive a um F5,
o que uma tabela filtrada em `useState` nunca fez. O segmented control são `<Link>`s: zero estado de
cliente.

**A Faixa não é código novo, é a grelha de Pagamentos promovida.** Foi isso que permitiu apagar três
vistas — `payments-grid.tsx` (322), `arrears-client.tsx` (436) e `properties-table.tsx` (203), 961
linhas — sem perder nada: clicar numa célula continua a abrir o mesmo formulário de pagamento, que
mudou de casa para `components/faixa/pagamento-modal.tsx`, e o botão de nova fração passou para o
cabeçalho da Carteira. `DeviationBadge`/`PropertyStatusBadge` foram salvos para `kit/badges.tsx`.
**Métrica "implementações da grelha mensal: 1" atingida.**

**Redirects feitos:** `/pagamentos` → `?lente=cobranca`, `/atrasos` → `?lente=risco&filtro=atraso`,
`/fracoes` → `?lente=renda`. O rail passou a **Agora + Carteira** mais o grupo Referência.

**Deliberadamente NÃO redirecionados, contra a tabela do §3:** `/mercado`, `/senhorios`, `/saude` e
`/fracoes/[id]`. A lente não absorve o detalhe destas quatro — a Saúde dos dados lista a ocorrência
concreta por anomalia, que a fila só agrega, e a ficha da fração são 736 linhas que o `?ficha=` ainda
não replica. Redirecioná-las agora era perder informação, não simplificar. O padrão certo é o que já
se usou nos Atrasos: a fila prioriza, a página detalha. Ficam para quando o `Sheet` da ficha existir.

**Também por fazer na Fase 3:** o zoom de 60 meses e "tudo" (o `getSnapshot()` não recebe argumentos
de propósito, para o `cache()` do React deduplicar — a janela de 60 obriga a decidir isso primeiro) e
o agrupamento por freguesia/estado (`?grupo=senhorio` já funciona).

**Fase 4 (Risco) FEITA (2026-07-25):** `lib/portfolio/risk.ts` — prior da carteira por ajuste de
MOMENTOS às taxas de liquidação dos contratos, posterior Beta-Binomial com `n` e intervalo sempre ao
lado, curva de cura medida em `received_date − ref_month` (custou UMA coluna a mais no histórico que
já se lia, zero queries novas), perda esperada `Σ valor × (1 − cura(idade)) × (1 − p̂)`, estágios
IFRS 9 e a frase de calibração. `check:risk` com 10 casos.

**Duas janelas, de propósito:** `liquidados`/`devidos` varrem o histórico TODO (é o que dá sentido ao
shrinkage — 140 meses contra 2); as `faltas` que alimentam a perda ficam nos últimos 24 meses, o mesmo
cap do `debt` do arrears.ts. Sem isso a perda esperada ultrapassava a dívida que veio substituir e as
duas deixavam de ser comparáveis.

**A fila do Agora passou a valer PERDA ESPERADA em vez de dívida ingénua**, com a ingénua ao lado na
conta. É a app a descontar-se a si própria, que era o ponto do §6.3.

**Correção ao PLANO — o teste do n=2 (§6.2) estava mal especificado.** "Com n=2 o contrato fica a
menos de 1 p.p. do prior" NÃO é uma propriedade do modelo, é uma propriedade do prior: só se verifica
com n₀ ≳ 200. Com o prior ajustado a esta carteira n₀ ≈ 31, e aí dois meses falhados movem ~6 p.p. —
o que está CERTO, porque numa carteira onde quase todos liquidam 100% dos meses, falhar dois meses
seguidos é informativo. O `check:risk` testa agora a forma exata do shrinkage, que vale sempre:
`p̂ = w·observado + (1−w)·prior` com `w = n/(n₀+n)`, exigindo `w < 10%` a n=2 — e verifica à parte que
o critério do PLANO se cumpriria com n₀=400. Também se apanhou uma segunda asserção falsa pelo
caminho: "mais dados, intervalo mais estreito" só vale a taxa observada constante (a largura do Beta
depende de `p`, é máxima a 0,5).

**Fase 5 (Ano) FEITA (2026-07-25):** `/ano/[ano]` é um DOCUMENTO, não um dashboard — lê-se de cima a
baixo pela ordem em que a pergunta se resolve (§11): cascata rendas → despesas → líquido → imposto →
sobra, a decisão do ano numerada (regime, art. 72.º, AIMI), o quadro 4.1 do Anexo F com exportação
pelo `/api/irs` que já existia, e as despesas em `#despesas`. `lib/portfolio/ano.ts` paga a sua
própria leitura — o snapshot não carrega recibos de anos passados de propósito. Tudo o que é fiscal
continua a vir do `irs.ts` já testado, incluindo o B1.

**O AIMI não se mostra em euros, de propósito.** O `irs.ts` dá VPT imputado e que limites são
cruzados, não um imposto — a taxa e o limite dependem de se há tributação conjunta, e isso a app não
sabe. Inventar o número era o oposto do princípio da conta visível.

**Redirects feitos:** `/irs` → `/ano/<ano>`, `/despesas` → `/ano/<ano>#despesas`. O rail é agora
**Agora · Carteira · Ano** (mais Mercado, e Administração para admin).

**Fase 6 (Captura) FEITA (2026-07-25), com o diff a proteger os dados.** `lib/import/plano.ts` é um
módulo PURO que, dadas as linhas do ficheiro e o que a base já tem, diz o que é novo, duplicado,
divergente, anulado e ilegível — sem tocar em nada. `check:import` tem 13 casos e é o gate: reproduz
as regras do `dados/gerar_sql_import.py` (anulados fora, multi-mês repartido por meses de calendário,
parcelas que somam EXATAMENTE o valor do recibo, numeração `contrato/recibo#parte`, dedupe global).

**Cinco regras que tornam este caminho incapaz de estragar dados:**
1. `preverImport` não escreve nada.
2. `aplicarImport` **recalcula o plano no servidor** a partir das mesmas linhas — nunca confia no
   plano que o browser mandou, senão bastava adulterá-lo.
3. Só INSERE (`upsert` com `ignoreDuplicates`). Nunca update, nunca delete.
4. **Não cria frações nem contratos.** Era o que o wizard fazia, e é assim que entra lixo: uma matriz
   mal lida virava uma fração nova. O plano NOMEIA o que falta e a criação fica humana.
5. Pagamentos só onde ainda não há nenhum — um pagamento marcado à mão vence sempre o inferido.

Um recibo que já existe com valor diferente é uma **divergência**: aparece no diff e nunca é escrito.
O pipeline Python continua a ser a reversão oficial.

**Wizard antigo REMOVIDO** (766 linhas) e com ele as três ações de import por lotes do
`actions/import.ts` (~570 linhas), que escreviam sem diff e criavam entidades sozinhas. Sobrou o
`syncContractRents`.

**S4 (`app_events`) e S5 (`properties.use_kind`) NÃO feitos, de propósito.** São colunas que nada
consome hoje — o `use_kind` só vale quando o `classifyUso` do `irs.ts` deixar de inferir por regex, e
o `app_events` quando existir o diário da carteira. Criar schema para features não construídas é o
oposto da disciplina do resto do plano; entram com quem os usar.

**Fase 7 (Acabamento) FEITA no que era mensurável (2026-07-25):** gráfico "Últimos 12 meses" removido
do Agora e `charts.tsx` apagado (370 linhas) — **o Recharts saiu do caminho crítico da página mais
visitada**, que era a consequência prometida no §5. Skip-link e `<main id="conteudo" tabIndex={-1}>`
no layout: 40 links de rail antes do conteúdo era o que tornava a app impraticável só com teclado.
Bloco `@media print` no `globals.css` — papel branco e tinta preta, navegação e seletores fora,
`<details>` abertos (em papel não há como os abrir) e `break-inside: avoid` nos blocos.

**UI: 6.300 (V1) → 6.102 linhas**, com muito mais funcionalidade. O alvo de ≤5.000 não está atingido
e o que falta está identificado: `forms.tsx` (706), a ficha `fracoes/[id]` (736) e `/mercado` (204)
continuam em estilo V1 e são o que o `Sheet` da ficha e o ⌘K viriam dissolver.

**RETRATO no Agora (2026-07-25, a pedido do utilizador) — e uma correção de rumo.** A V2 matou o
dashboard porque para quem DECIDE a fila é melhor: diz o que fazer e quanto vale. O que a decisão não
viu é que a app tem um SEGUNDO público — a família, em modo viewer, sem um único botão — para quem a
pergunta não é "o que faço?" mas "como é que isto está?". Essa não tinha resposta em lado nenhum: o
viewer via um cabeçalho sobre uma fila que não lhe aparecia, seguido de um parágrafo.

O que se fez: `components/agora/retrato.tsx`, seis números com unidade e contexto (renda contratada,
recebido 12m, entrado no mês, ocupação, contratos em atraso com a perda esperada ao lado, VPT), por
baixo da tira de Cobertura e acima da fila, visível aos DOIS públicos. Sem StatCards e sem verde de
"ok" — a regra do §10.1 mantém-se. O cabeçalho e as ações passaram a ser conscientes do papel: um
viewer vê uma lede sobre a carteira, não sobre uma fila que não tem; e deixou de ver o botão "registar
pagamento" e a checklist de recibos por emitir, que eram ações que não pode executar.

**O gráfico dos últimos 12 meses VOLTOU, revertendo a decisão da Fase 7.** A justificação para o
apagar era que a faixa da Carteira o tornava redundante, e isso está errado: a faixa responde "que
meses falharam, em que fração" e o gráfico responde "quanto entrou contra o esperado, mês a mês" — e
é esta a leitura que a família quer. Fica DEPOIS da fila, porque contexto não se põe à frente de uma
decisão. O `charts.tsx` foi reposto do git e o Recharts volta ao caminho crítico do Agora, com o custo
assumido (~50 kB). UI: 6.102 → 6.588 linhas.

**Por fazer, e assumido:** o ⌘K (`Comando`) e a `SequenciaDeFichas` da Fase 6; a ficha em `?ficha=`;
`/mercado` como redirect (a lente não traz o valor estimado nem o yield bruto, por isso a página fica
como detalhe); e o Lighthouse de acessibilidade, que precisa de uma sessão autenticada para medir.

**Desempenho do snapshot (medido 2026-07-25, ligação doméstica → Supabase UE).** A Fase 1 pôs todas
as páginas a pagar a leitura mais pesada e as Frações/Atrasos ficaram a "pensar". Três correções,
todas medidas e não adivinhadas (as duas primeiras hipóteses estavam erradas):
- `paginateAllParallel` — o histórico eram 6 idas ao Supabase **em série** em cada página.
- Histórico em **3 colunas** (`contract_id, ref_month, amount`) em vez de 10; as linhas completas
  ficam só nos 12 meses que a grelha de Pagamentos mostra.
- `market_benchmarks` filtrado pelos dicofres em uso. Traz o país inteiro (~3.000 freguesias) e o
  PostgREST cortava a 1000 em silêncio, o que podia esconder a freguesia certa. Hoje nenhuma fração
  tem dicofre, logo a query nem acontece.
- **`getSnapshotLeve()`** para Frações e Mercado: não usam pagamentos para nada.

Resultado: Mercado 3.600 → **657 ms**; Frações → **1.697 ms** (1 s disso é a lista de territórios do
INE para o dropdown do formulário, sem filtro possível); Agora **1.430 ms** e Atrasos **1.567 ms**,
que carregam mesmo os 5.116 pagamentos.

**Próximo passo de desempenho, só se ainda incomodar em produção:** cachear o snapshot entre pedidos.
Não está feito porque `unstable_cache` não pode usar o cliente ligado aos cookies — teria de usar a
service-role key e assumir que o snapshot é igual para todos, o que HOJE é verdade (o RLS dá
`using (true)` a qualquer autenticado) mas deixa de ser no dia em que houver RLS por senhorio. Medir
em Vercel UE antes de decidir: a base de dados fica na mesma região, o que deve cortar a maior parte
da latência que medi de casa.

**Ainda com queries próprias (deliberado, por agora):** `/irs` e `/despesas` (são parametrizadas por
ANO e o snapshot não carrega recibos de anos passados de propósito), `/senhorios` (YTD),
`/admin` (contagens de plumbing), `carta/[contractId]` e `fracoes/[id]` (entidade única).

---

## 1. Porque existe uma V2

A V1 funciona e o rigor dela não se atira fora. O problema é que **é um espelho contabilístico da
carteira, e o dinheiro não está no espelho.** Mostra com precisão o que aconteceu e nunca diz o que
fazer nem quanto vale fazê-lo.

Enquanto o KPI mais destacado da app são 25.375 € de "dívida estimada" (cuja maior parte a própria
metodologia admite ser artefacto de recibos ainda não importados), os dois maiores levers reais da
carteira estão em zero:

1. **Quadro 4.2 do Anexo F vazio nos dois senhorios.** Todos os contratos a 28%, quando muitos são de
   habitação com 20+ anos e podiam estar a 5–15% (art. 72.º CIRS). Ordem de grandeza: **10.000 €/ano**.
2. **Despesas dedutíveis subaproveitadas:** o Pai deduziu 1.500 € contra 26.587 € do Avô, em carteiras
   equivalentes.

A app tem os dados para descobrir os dois. Não os usa para nada.

**A V2 troca a pergunta que a app responde:** de *"como está a minha carteira?"* para *"o que vale a
minha atenção hoje, e onde?"*

### Limitações da V1, com evidência

| # | Limitação | Onde |
|---|---|---|
| L1 | 9 destinos de navegação para 1 utilizador que escreve e 3 que leem | `nav.tsx:41-72` |
| L2 | **Duas verdades para a mesma célula:** a grelha de Pagamentos decide "em falta" com `contract.rent` e qualquer pagamento = pago; `arrears.ts` usa renda de referência, tolerância de 90% e horizonte de dados | `payments-grid.tsx:66-75` vs `arrears.ts:173-215` |
| L3 | Duas implementações independentes da mesma grelha mensal, mesmo vocabulário de 4 estados, legendas iguais | `arrears-client.tsx` (`MonthsGrid`) e `fracoes/[id]/page.tsx` (`YearBlock`) |
| L4 | Toda a vista densa escrita duas vezes (`hidden md:block` + `md:hidden`), em 8 lugares | dashboard ×2, properties-table, ficha ×3, atrasos, despesas, mercado, senhorios |
| L5 | Zero camada de dados: 13 páginas com o seu `Promise.all`, `force-dynamic` em todas, nenhum `cache()`, nenhuma view. O dashboard lê os ~5.100 pagamentos e recalcula `computeArrears` que a página de Atrasos volta a calcular | `data.ts` só tem 2 helpers |
| L6 | Zero tokens de design: o `@theme` declara 2 fontes e nada mais; a paleta é convenção em classes cruas por ~6.300 linhas de UI | `globals.css:3-8` |
| L7 | `Button` só renderiza `<button>`, por isso todo o CTA que navega é uma string de classes copiada à mão | dashboard ×2, atrasos, IRS, admin |
| L8 | A app mede operação, não decisão. Nenhum ecrã diz "faz isto, vale X" | transversal |
| L9 | A dívida estimada é o número mais destacado e o menos fiável; a app nunca mede o seu próprio erro | `arrears.ts` |
| L10 | A incerteza vive em rodapés de prosa, que ninguém lê | Atrasos, Mercado, IRS |
| L11 | Entrada de dados toda por formulário modal (706 linhas, 9 formulários) e o import a sério acontece fora da app (Python → blocos <150 KB → SQL Editor) | `forms.tsx`, `dados/` |
| L12 | "Saúde dos dados" é uma lista de anomalias sem preço, admin-only, que ninguém tem incentivo para abrir | `saude/page.tsx` |
| L13 | Papéis por esconder botões: o viewer vê a mesma grelha densa com menos ações | transversal |
| L14 | `/senhorios` mostra `"n/d"` nas colunas por senhorio embora os totais calculem valores reais | `senhorios/page.tsx` |

### Bugs reais encontrados na análise da V2 (entram como Quick Wins, §9)

| # | Bug | Onde |
|---|---|---|
| B1 | **O Anexo F vai sobre-declarar rendas ilíquidas.** `irs.ts` faz `grossRent += r.amount + r.withholding` assumindo `amount` líquido (como diz `types.ts:81`), mas o gerador escreve o **bruto** em `amount` e a retenção em `withholding`. Latente hoje (`withholding` = 0 em toda a BD); explode no reimport pendente | `irs.ts:154` vs `dados/gerar_sql_import.py:264-269` |
| B2 | Grelha de Pagamentos contradiz Atrasos (ver L2) | `payments-grid.tsx:66-75` |
| B3 | `/senhorios` com `"n/d"` fixo (ver L14) | `senhorios/page.tsx` |
| B4 | **Deriva de schema:** `properties_matriz_uq` e `contracts_pfno_uq` só existem no gerador Python. Uma BD criada do `schema.sql` não tem dedupe por matriz nem por nº de contrato | `gerar_sql_import.py:298,351` |
| B5 | ~~Códigos INE têm 7/9 caracteres; `properties.dicofre` está documentado como 6 dígitos e o match de concelho é `startsWith`~~ **CORRIGIDO 2026-07-29**: o `geocod` do INE é NUTS III + DICOFRE (`1941823` = `194`+`18`+`23`); `ine.ts` grava agora só o DICOFRE e o SQL converte o que já estava. Era isto que fazia o Mercado nunca casar benchmark nenhum | `ine.ts`, `calc.check.ts` |
| B6 | `Modal` sem Esc, sem focus trap, sem scroll lock | `ui.tsx:347` |
| B7 | 64 recibos "Anulado" (21 Pai + 43 Avô) não têm representação na BD | filtro no parse de `analise_senhorio.py` |

---

## 2. Filosofia da V2

Sete princípios. Se um ecrã falha um princípio, o ecrã está errado, não o princípio.

1. **A app não mostra números. Mostra o que a tua atenção vale.** Todo o número visível responde a "e
   então?". Um número que não muda uma decisão não aparece.
2. **O que está feito é tinta. O que falta é cor.** Recebido, liquidado, emitido: preto sobre papel. Cor
   só para o que exige atenção ou tem valor por capturar. Uma carteira sã parece um livro de contas bem
   tratado, não um semáforo verde.
3. **A app diz sempre o que não sabe.** A incerteza é estrutural (pagamentos derivam de recibos; o Tio
   não está modelado; 15 fichas incompletas; retenção a zero na BD). Passa a ser propriedade de primeira
   classe de cada número, não rodapé.
4. **Cada desconhecido tem um preço.** "Faltam 15 áreas" é administrativo. "Estas 15 fichas valem até
   8.400 €/ano em decisões que não podes tomar" é financeiro.
5. **Gate de materialidade: a app recusa-se a mostrar ruído.** Um sinal só aparece acima de 250 €/ano ou
   25 €/mês. É a disciplina dos gates de validação quantitativa transposta para a UI.
6. **Uma substância, várias lentes.** Há um objeto de dados (a carteira ao longo do tempo) e um objeto
   visual que o representa (a faixa). Pagamentos, atrasos, ocupação, vazios, mercado e risco são lentes.
7. **O fim é finito.** Um dashboard nunca acaba; uma fila esvazia-se. A app é feita para chegar a "nada
   a decidir" e dizê-lo.

---

## 3. O novo paradigma e a nova navegação

**Substância + fila + ficha.** Três destinos, nada mais entra no rail:

| Destino | Pergunta | Cadência real |
|---|---|---|
| **Agora** (`/`) | "O que devo fazer, e quanto vale?" | diária de relance; intensa nos dias 1–8 |
| **Carteira** (`/carteira`) | "Como está tudo, e o que aconteceu?" | semanal / quando há dúvida |
| **Ano** (`/ano/[ano]`) | "Quanto ganhámos, quanto vamos pagar, que decisão tomar?" | anual, consultado a meio do ano |

Mais dois gestos, que não são destinos: **⌘K** (única entrada de dados e único motor de busca) e
**clicar em qualquer coisa** (abre a ficha por cima; nunca se "vai a" uma fração).

- **Lentes** são um segmented control na Carteira: `Cobrança · Renda · Mercado · Risco · Vazios`.
- **Escopo por senhorio** é um filtro persistente em `searchParams`, não uma página.
- **Admin** sai da navegação para o menu de conta (usa-se 4× por ano).
- **Saúde dos dados** dissolve-se na fila, com preço em euros por anomalia.

### Redirects obrigatórios (ninguém perde um bookmark)

| Antiga | Nova |
|---|---|
| `/pagamentos` | `/carteira?lente=cobranca` |
| `/atrasos` | `/carteira?lente=risco&filtro=atraso` |
| `/fracoes` | `/carteira?lente=renda` |
| `/fracoes/[id]` | `/carteira?ficha=fracao:[id]` |
| `/mercado` | `/carteira?lente=mercado` |
| `/senhorios` | `/carteira?grupo=senhorio` |
| `/despesas` | `/ano/<ano>#despesas` |
| `/irs` | `/ano/<ano>` |
| `/saude` | `/?bloco=porsaber` |
| `/admin`, `/carta/[contractId]` | mantêm-se |

O ⌘K aceita os nomes antigos ("pagamentos", "atrasos", "mercado") e leva à lente equivalente.

---

## 4. Agora: o centro de controlo

Não é um dashboard. É uma fila de decisões com uma linha de dinheiro no topo.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  JULHO 2026                                          [Importar]  [⌘K]        │
│  Se fizeres estas 6 coisas, ganhas                                           │
│  11.430 €                                                                    │
│  este ano. 9.240 € disso é imposto que estás a pagar a mais.                 │
│  Conhecido até jun 2026 · 3 de 4 senhorios · 15 fichas por completar   ⓘ     │
└──────────────────────────────────────────────────────────────────────────────┘
  DINHEIRO A POUPAR                                                    9.240 €
  · Comunicar 7 contratos à AT para taxa reduzida do art. 72.º   +6.180 €/ano
    7 de habitação com 20+ anos, hoje a 28%. Podem ir a 5%.
    4 confirmados · 3 dependem da tipologia por preencher
                                     [Ver os 7]  [Preencher tipologias]
  · Escolher englobamento vs 28% no IRS do António                 +2.310 €
  · Atualizar 9 rendas pelo coeficiente de 2026 (1,0216)            +750 €/ano
  A FAZER ESTE MÊS                                                  46 recibos
  · Emitir 46 recibos de julho                     13.480 €   ▓▓▓▓░░░░ 18/46
  RISCO                                                    1.940 € esperados
  · 512797 Loja S. Pedro, sem recibo desde out 2021          perda 1.510 €
    57 meses. Prob. de recuperar 6% (n=4 casos na carteira).
                          [Marcar cessado]  [Gerar carta]  [Recebi em €]
  POR SABER                                     desbloqueia até 8.400 €/ano
  · 15 fichas sem área, tipologia ou DICOFRE       [Preencher (2 min)]
  ──────────────────────────────────────────────────────────────────────────
  8 sinais abaixo do limiar de materialidade (< 250 €/ano)         [Mostrar]
```

**Regras**

1. Uma linha de dinheiro no topo, sempre: soma do valor anualizado das decisões abertas. É o único
   número da app com contagem animada.
2. Grupos fixos pela natureza do dinheiro, nunca por módulo: `Dinheiro a poupar`, `A fazer este mês`,
   `Risco`, `Por saber`. Dentro de cada grupo, ordem por valor × confiança.
3. Todo o item tem verbo no infinitivo, valor, porquê com números, e 1 a 3 ações. Sem ação possível não
   é item: é informação e vive na Carteira.
4. Nada é inventado para encher. Fila vazia mostra "Nada a decidir. A carteira está em ordem até junho
   de 2026." mais o resumo do mês em prosa.
5. Adiar é de primeira classe (`e`, com data). Um item adiado não desaparece nem grita.
6. **Modo viewer:** a família não vê fila (não pode agir). Vê a mesma cabeça e por baixo "O mês em cinco
   frases" e o que está a ser tratado. Papel adaptativo, não papel escondido.

**Os 16 geradores de decisão** (funções puras sobre o snapshot):

| Família | Gerador | Preço |
|---|---|---|
| A fazer | `recibo_por_emitir` | renda do mês |
| A fazer | `import_em_atraso` (fronteira parada há > 35 dias) | dívida falsa evitada |
| Poupar | `art72_elegivel` | (28% − taxa) × renda anual × quota |
| Poupar | `regime_irs` | \|autónoma − englobamento\| |
| Poupar | `despesa_dedutivel_ausente` (fração sem dedutíveis vs mediana dos pares) | taxa marginal × mediana |
| Poupar | `atualizacao_renda_elegivel` | 12 × Δrenda (composto) |
| Poupar | `renda_abaixo_mercado` | 12 × `gapEurMonth` |
| Poupar | `aimi_limiar` | 0,7%/1% do excesso |
| Risco | `atraso_novo` / `atraso_agravado` (change-point) | perda esperada |
| Risco | `pagamento_a_menos` | défice × 12 |
| Risco | `contrato_zombie` | dívida falsa a remover |
| Risco | `contrato_a_terminar` (90d) | vazio esperado × renda |
| Por saber | `ficha_incompleta` | valor da informação (§6.4) |
| Por saber | `retencao_nao_importada` | exatidão do Anexo F |
| Por saber | `quota_incoerente` | erro de repartição no IRS |
| Higiene | `anomalia_estrutural` (sobreposição, renda ≤ 0, recibo órfão) | sem preço, sempre no fim |

---

## 5. A Faixa: o objeto central

Uma linha por fração. O tempo corre para a direita. Cada mês é uma barra cuja **altura é a fração da
renda de referência que entrou**. A faixa é ao mesmo tempo grelha de pagamentos, mapa de atrasos, linha
de ocupação e sparkline de cobrança.

```
┌ 260px ─────────────────────┬── 24 meses × 13px ────────────────┬ 128px ─────┐
│ ● R. das Flores 12, 2ºE    │ ███████████████▄████████████│░░   │    420 €   │
│   Maria Silva · T2 · 64 m² │                             │     │  ok        │
│ ● Loja S. Pedro            │ ██▁▁▁▁///////////////////▁▁│░░   │    250 €   │
│   Ilídio Costa · Loja      │                             │     │  1.510 €   │
│ ○ Repeses 4                │ ██████▨▨▨▨▨▨███████████████│░░   │    310 €   │
│   vago desde mai · T1      │                             │     │  ~930 €    │
└────────────────────────────┴──────────────────────────────┴──────────────────┘
                                                fronteira do conhecido ↑
  ═ CARTEIRA                  ████████████████████████████│░░   │ 13.480 €   │
```

Cinco estados de célula, sem exceções:

| Estado | Desenho | Significado |
|---|---|---|
| liquidado | barra cheia, **tinta** | ≥ 90% da renda de referência entrou |
| parcial | barra à altura proporcional, tinta | a altura **é** o valor |
| falta | linha de base + tique vermelho | mês devido sem entrada |
| vazio / fora do contrato | hachura diagonal ténue | não havia contrato |
| além da fronteira | hachura azul-ardósia | a app ainda não sabe |

Consequências que valem por si:
- A **fronteira do conhecido** é uma linha desenhada com etiqueta. A trava `dataHorizonMonth`
  (Apêndice A.2) deixa de ser detalhe de implementação e passa a ser o elemento mais honesto da app.
- **A última faixa é a carteira inteira**, logo o gráfico "Últimos 12 meses" desaparece: a substância já
  é o gráfico. Menos um Recharts no caminho crítico.
- Zoom temporal (12 / 24 / 60 / tudo) e agrupamento (senhorio, freguesia, estado, risco).
- Implementação em CSS grid, sem SVG e sem biblioteca: 43 linhas × 24 células = 1.032 nós.
- **Piso de 3px** para qualquer valor > 0, senão um parcial de 4% é visualmente igual a zero.

---

## 6. A IA invisível

Zero chatbot, zero dependências novas, zero chamadas a modelos. TypeScript puro com `*.check.ts`.

**6.1 Narrador.** Construtores de frase PT-PT determinísticos sobre factos do snapshot (`narrate.ts`).
Cada superfície abre com uma lede: máximo 3 frases, números sempre com unidade, nunca adjetivos de
julgamento, sempre a fonte quando é estimativa.

**6.2 Fiabilidade do inquilino (Bayes empírico).** `p_pagar` por Beta-Binomial com prior da carteira:

```
prior (α₀, β₀) ajustado por momentos à distribuição de taxas de liquidação dos 43 contratos
posterior  p̂ = (α₀ + meses_liquidados) / (α₀ + β₀ + meses_devidos)
```

O shrinkage é a razão de ser: com 4 meses de histórico o contrato fica praticamente na média da
carteira; com 140 meses (há contratos desde 2014) fica no seu próprio dado. Mostra-se sempre com `n` e
intervalo. **Self-check obrigatório:** um contrato com n=2 fica a menos de 1 p.p. do prior.

**6.3 Curva de cura, medida nos dados da própria carteira.** `receipts` tem `ref_month` **e**
`issue_date`, com cobertura 2014-08 a 2026-08. Isso permite medir empiricamente: dado um mês em falta k
meses depois de vencido, que fração acabou por ser paga?

```
cura(k) = # recibos com (issue_date − ref_month) > k  /  # meses em falta a k meses de idade
```

Daqui saem três coisas que nenhuma app de arrendamento tem:
- **Perda esperada** por contrato `= Σ valor_mês × (1 − cura(idade)) × (1 − p̂)`, em euros e com
  intervalo, em vez de `streak × renda`.
- **Estágios** 1/2/3 (normal, deterioração, incumprimento), com a disciplina de IFRS 9. Os buckets de
  severidade da V1 já são isto sem o saberem.
- **Fator de calibração da própria app.** Se `cura(1)` = 0,62, então 62% do que a app hoje chama dívida
  ao primeiro mês resolve-se sozinho no import seguinte. A app passa a descontar-se e a dizê-lo:
  *"1.940 € de perda esperada; a estimativa ingénua diria 8.750 €."*

**6.4 Valor da informação.** Para cada campo em falta, o valor da decisão que ele desbloqueia:

```
valor(tipologia de X)     = P(habitação) × (28% − taxa_art72(anos de X)) × renda_anual(X)
valor(área+dicofre de X)  = P(abaixo do mercado) × gap_estimado_da_freguesia × 12
```

Nunca como certeza: "pode valer até 1.560 €/ano; 4 dos 7 confirmados", com a conta visível.
**Valores assumidos nunca entram na linha de dinheiro do topo sem estarem separados dos confirmados.**

**6.5 Mudança de comportamento.** Quebra na série de liquidação por contrato (mediana móvel de 3 meses,
janelas de 6). Distingue quem sempre pagou mal de quem piorou, com data.

**6.6 Impressão digital de pagamento.** Dia típico do mês, cadência (já existe), número típico de
prestações, se retém na fonte. "Atrasado" passa a medir-se contra o normal daquele inquilino.

**6.7 Pares internos.** Com 43 contratos, o comparável mais relevante não é a mediana INE da freguesia:
é a própria carteira. Coorte por (freguesia, tipologia), com fallback a tipologia. z-score de €/m².

**6.8 Anomalia de despesa.** Fora de 2σ do histórico da mesma categoria/fração, ou categoria que
desapareceu (o IMI que não apareceu este ano).

**6.9 Gate de materialidade.** `|valor anual| ≥ 250 €` ou `|valor mensal| ≥ 25 €` ou severidade
estrutural. O que não passa é agregado numa linha única no fim.

**IA generativa: em nenhum sítio da V2.** Fica como opção de V3 apenas para ingestão de texto livre
(colar um email → propor uma despesa), nunca no caminho crítico.

---

## 7. Arquitetura técnica

### 7.1 O snapshot: uma substância, calculada uma vez

Resolve o maior problema da V1 (L5) e é a fundação de tudo.

```
src/lib/portfolio/
  load.ts        loadRaw(supabase): RawData          // TODAS as leituras, paginadas, uma vez
  snapshot.ts    buildSnapshot(raw, today): Snapshot // função PURA
  risk.ts        PD (Bayes empírico), curva de cura, perda esperada, estágios
  peers.ts       coortes internas, z-scores
  narrate.ts     construtores de frase PT-PT
  insights/
    index.ts     registo dos 16 geradores + rank.ts (valor × confiança + gate)
    recibos.ts  atrasos.ts  fiscal.ts  rendas.ts  informacao.ts  higiene.ts
  *.check.ts     um por módulo (padrão do projeto, sem framework)
```

```ts
interface Snapshot {
  hoje: string;
  cobertura: { fronteira: string | null; senhorios: { total: number; modelados: number };
               fichasIncompletas: number; ultimoImport: string | null };
  ativos: Ativo[];          // fração + contratos + células da faixa + mercado + risco
  carteira: FaixaCelula[];  // linha agregada
  totais: { rendaContratada: number; recebido12m: number; vptTotal: number };
  risco: { perdaEsperada: number; porEstagio: [number, number, number]; curaK: number[] };
  decisoes: Insight[];      // já ordenadas e filtradas pelo gate
}
```

- `buildSnapshot` é **pura** e recebe `today`: testável com relógio fixo, como `arrears.check.ts` já faz.
- `getSnapshot()` embrulhado em `cache()` do React: **uma construção por request**, não uma por página.
- `computeArrears` **não é reescrito**: passa a ser um passo interno de `buildSnapshot`, e o `months24`
  que já produz é a origem das células da faixa. A metodologia do Apêndice A.2 fica intacta, com os 9
  casos de self-check.
- Se ficar lento (medir antes de otimizar): primeiro uma view materializada
  `payments_by_contract_month`; só depois uma tabela `portfolio_snapshot`.

### 7.2 Alterações de schema (idempotentes, no fim de `supabase/schema.sql`)

| # | Alteração | Porquê |
|---|---|---|
| S1 | índices únicos `properties_matriz_uq` e `contracts_pfno_uq` | fecha B4 |
| S2 | `receipts.cancelled boolean not null default false` | modela os 64 anulados (B7) |
| S3 | `insight_state (kind, subject, snoozed_until, dismissed_at)` | adiar/dispensar tem de persistir |
| S4 | `app_events (id, at, actor, kind, subject, payload jsonb)` | diário da carteira + auditoria |
| S5 | `properties.use_kind check (habitacao/comercio/terreno/outro)` | hoje o uso é inferido de `typology` por regex (`irs.ts:287`); o campo remove metade dos "a confirmar" do art. 72.º |
| S6 | índices `receipts (contract_id, ref_month)` e `payments (contract_id, ref_month)` | o snapshot varre por contrato-mês |

Nada destrutivo. `properties.status` mantém-se (`terreno`/`vendido` continuam a governar
`isCurrentProperty`); `use_kind` é ortogonal e opcional.

### 7.3 Rotas e fronteiras

- `/` Agora (server) · `/carteira` (server, lentes por `searchParams`) · `/ano/[ano]` (server).
- Ficha por `searchParams` (`?ficha=fracao:<id>`) com `<Suspense>` a carregar um server component só
  daquele ativo. **Não** usar parallel/intercepting routes: a complexidade não se paga aqui.
- Client components só onde há interação: `Faixa`, `Comando`, `Importar`, `Decisao`, `Sheet`.
- Server actions existentes mantêm-se com `requireAdmin`. Novas: `snoozeInsight`, `dismissInsight`,
  `bulkMarkPayments`, `applyImport`.

### 7.4 Import dentro da app

O pipeline Python é a **especificação** e não desaparece: continua a ser a rede de segurança e a via
para reimports totais (Apêndice A.1). O que entra na app é a mesma lógica, portada para TS e testada
contra os mesmos números.

```
src/lib/import/
  read.ts      xlsx/csv → linhas (xlsx e papaparse já são dependências)
  normalize.ts norm(), split_amount em cêntimos exatos com resto na última fatia,
               mes_range, marcação de anulados
  diff.ts      linhas × BD → { novos, divergencias, duplicados, anulados, multiMes,
                               fracoesNovas, contratosNovos, fronteiraDepois }
  apply.ts     grava por lotes, dedupe por receipt_number, payments com on conflict do
               nothing, withholding = fatia bruta − fatia recebida
  import.check.ts
```

**Gate de aceitação, não negociável:** `import.check.ts` reproduz ao cêntimo os totais dos dois
`Analise_*.md` (2.732 e 3.080 linhas mensais; 113 e 80 multi-mês; 21 e 43 anulados). Sem isto o import
da app **não** substitui o pipeline. Nunca grava sem o ecrã de diff.

### 7.5 Performance e correção

- Um `loadRaw` por request (hoje: 13 páginas × N queries).
- Faixa em CSS grid; virtualizar linhas só se falhar o orçamento de 60 fps com 43 × 60 células.
- `paginateAll` continua a ser a única forma de ler `payments`/`receipts` (Apêndice A.3).
- Gate por tarefa: `npm run build` + `npm run check` verdes. Cada módulo novo acrescenta o seu
  `check:<mod>` ao script `check`.

---

## 8. Roadmap de implementação

Sete fases. Cada uma é entregável e deixa a produção utilizável. Ordem escolhida para pôr valor
financeiro visível cedo (Fase 2) e deixar o maior bloco de UI (Fase 3) para depois de a fundação estar
provada.

| Fase | Entrega | Ficheiros principais | Pronta quando |
|---|---|---|---|
| **0** Fundação | este `PLANO.md` + `CLAUDE.md` reescrito; tokens semânticos em `@theme`; Newsreader; `Money`/`Figure`/`Lede`/`Confianca`/`Cobertura`; `Button as="a"`; `Modal` acessível; S1/S2/S6; Quick Wins §9 | `globals.css`, `ui.tsx`, `kit/*`, `layout.tsx`, `schema.sql` | build+check verdes, V1 inteira já em papel-e-tinta, zero regressões |
| **1** Snapshot | `portfolio/{load,snapshot,narrate}.ts` + checks; as 13 páginas passam a ler o snapshot | `lib/portfolio/*`, todas as `page.tsx` | um `loadRaw` por request; números idênticos aos de hoje |
| **2** Agora | 16 geradores + rank + gate; `LinhaDeDinheiro`, `Decisao`, `Cobertura`; S3; modo viewer | `lib/portfolio/insights/*`, `components/agora/*`, `app/(app)/page.tsx` | `/` é a fila; `/saude` redireciona; a linha de dinheiro bate com contas à mão |
| **3** Carteira | `Faixa` + eixo + fronteira + popover; lentes Cobrança/Renda/Vazios; `Sheet` + ficha; redirects | `components/faixa/*`, `app/(app)/carteira/*` | 4 rotas antigas redirecionam; a célula tem **uma** verdade (fecha B2/L2/L3) |
| **4** Risco | `risk.ts` (PD, cura, perda esperada, estágios); lente Risco; `BarrasDeEstagio`; frase de calibração | `lib/portfolio/risk.ts` + check | `check:risk` passa, incluindo o teste de shrinkage com n=2 |
| **5** Ano | documento, `Cascata`, decisão do ano, art. 72.º, AIMI, despesas, Anexo F (reusa `irs.ts` e `/api/irs`) | `app/(app)/ano/[ano]/*`, `components/ano/*` | `/irs` e `/despesas` redirecionam; B1 corrigido e coberto |
| **6** Captura | `Comando` (⌘K, 3 modos); largar-ficheiro + diff + apply; `SequenciaDeFichas`; S4; S5 | `components/kit/Comando`, `lib/import/*` | `import.check.ts` reproduz os `Analise_*.md`; wizard antigo removido |
| **7** Acabamento | a11y (foco, teclado, contraste, leitor de ecrã); 60 fps na Carteira; impressão do Ano; mercado como lente; remoção de código morto | transversal | Lighthouse a11y ≥ 95; linhas de UI abaixo da V1 |

**Ordem de risco:** a Fase 1 é a que pode dar números diferentes dos de hoje — validar página a página
contra produção antes de avançar. A Fase 6 é a que pode estragar dados — o gate do `import.check.ts` é
obrigatório e o pipeline Python fica como reversão.

### Critérios de sucesso (medidos no fim da Fase 7)

| Métrica | V1 hoje | Alvo V2 |
|---|---|---|
| Destinos de navegação | 9 | **3** |
| Ações no ritual mensal (46 recibos) | ~140 | **≤ 50** |
| Tempo até à primeira decisão acionável | não existe | **< 10 s** desde o login |
| Linhas de UI (`app/(app)` + `components`) | ~6.300 | **≤ 5.000** com mais funcionalidade |
| Implementações da grelha mensal | 2 | **1** |
| Vistas escritas duas vezes (desktop/mobile) | 8 | **0** |
| Construções do estado por request | 13 páginas × N queries | **1** |
| Itens na fila com a BD real | n/a | **≤ 8** |
| Números sem "porquê" acessível | maioria | **0** |
| Lighthouse acessibilidade | não medido | **≥ 95** |

### Regras de sessão

Uma fase por sessão, no máximo. `npm run build` + `npm run check` no fim de cada tarefa. Lista de
ficheiros alterados em cada relatório. PT-PT na UI. Zero "—" e zero emoji na UI. Sem commits nem push
sem pedido explícito. Alterações de schema sempre idempotentes e coladas à mão no SQL Editor.

---

## 9. Quick Wins (todos na Fase 0, nenhum depende de fase nenhuma)

| # | Ganho | Onde |
|---|---|---|
| QW1 | Corrigir **B1** (Anexo F ia sobre-declarar rendas por somar a retenção ao bruto) + caso no `irs.check.ts` | `irs.ts:154`, `types.ts:81` |
| QW2 | Unificar o estado da célula: a grelha de Pagamentos passa a usar `isMonthSettled` e a fronteira de dados | `payments-grid.tsx:66-75` |
| QW3 | Fundir as duas grelhas mensais numa só (Faixa embrionária): apaga ~200 linhas duplicadas | `arrears-client.tsx`, `fracoes/[id]/page.tsx` |
| QW4 | `Button` aceita `as="a"`: apaga 5 strings de classes copiadas | `ui.tsx` + 5 páginas |
| QW5 | `Modal` com Esc + focus trap + scroll lock | `ui.tsx:347` |
| QW6 | Corrigir `/senhorios`: colunas por senhorio deixam de dizer `"n/d"` | `senhorios/page.tsx` |
| QW7 | Índices únicos que só existem no Python entram no `schema.sql` (S1) | `schema.sql` |
| QW8 | `Money` aplicado a todos os euros da app | transversal |
| QW9 | Tira de `Cobertura` no topo (fronteira + senhorios + fichas) | `layout.tsx` |
| QW10 | Lista de decisões com gate de materialidade no dashboard atual, antes do Agora completo | `page.tsx` |
| QW11 | Apagar código morto: `StatCard.delta`, `Badge tone="blue"`, `COLOR_*` órfãos | `ui.tsx`, `charts.tsx` |
| QW12 | Confirmar que `dados/` continua fora do git antes de qualquer commit | `.gitignore` |

---

## 10. Sistema visual

### 10.1 Regra fundadora

> O que está confirmado é **tinta**. O que exige ação é **verde-cofre**. O que precisa de atenção é
> **âmbar**. O que é perda é **vermelho**. O que é desconhecido ou futuro é **ardósia**. **Não há verde
> de "ok"** — uma carteira sã é preta sobre papel.

### 10.2 Cores (tokens em `@theme`; nenhuma cor Tailwind crua na UI nova)

```css
/* superfície */
--color-papel:   #FBFAF8   (escuro #0C0C0D)
--color-carta:   #FFFFFF   (escuro #141416)
--color-elevado: #FFFFFF   (escuro #1B1B1E)
/* tinta (o que é real) */
--color-tinta:   #16161A   (escuro #F2F2F0)
--color-tinta-2: #5E5E68   (escuro #A0A0A8)
--color-tinta-3: #97979F   (escuro #6E6E76)
--color-regua:   rgba(22,22,26,.08)   (escuro rgba(255,255,255,.09))
/* significado: 4 papéis, 4 hues, sem sobreposição */
--color-acao:    #0D5A4E   hover #128572   tenue #E8F2EF
--color-atencao: #B4761A                    tenue #FBF1E1
--color-perda:   #B3352F                    tenue #FBEDEC
--color-futuro:  #4A5C78                    tenue #EDF0F5
```

| Papel | Cor | Usa-se em | **Não** se usa em |
|---|---|---|---|
| real / confirmado | tinta | mês liquidado, € recebido, valores fechados | nunca verde |
| ação / por ganhar | verde-cofre | botões, links, poupança possível, potencial | estados de "ok" |
| atenção | âmbar | parcial, elegível a agir, a confirmar | oportunidade (é ação) |
| perda | vermelho | falta, perda esperada, limiar excedido | avisos genéricos |
| desconhecido / futuro | ardósia | hachura além da fronteira, "por saber", projeções | dados medidos |

Notas: **verde-cofre serve dois papéis** (interativo e upside) porque são a mesma coisa, dinheiro que só
existe se agires — resolve a colisão da V1, onde âmbar era ao mesmo tempo atenção e oportunidade. Todos
os pares texto/fundo ≥ 4.5:1 (≥ 3:1 acima de 18px). Cor nunca é portadora única: cada estado da faixa
tem também forma (altura, hachura, tique). Tema escuro continua a seguir `prefers-color-scheme`, sem
seletor manual. `carta/[contractId]` continua sem tema escuro, de propósito.

### 10.3 Superfície e layout

Sem sombras em conteúdo (só em overlay); separação por hairline `--color-regua`. Raios: 10px controles,
12px cartões, 3px células de faixa, `999px` badges. Rail 216px. Carteira até 1.440px, Agora até 880px,
Ano até 720px (largura de leitura). Ritmo 4px: 4·8·12·16·24·32·48. Densidade da Carteira em 3 modos:
confortável 44px / normal 34px / compacta 26px.

### 10.4 Tipografia

| Família | Uso |
|---|---|
| **Geist Sans** (já existe) | toda a UI |
| **Newsreader** (nova, `next/font/google`, 400/500, latin, ~16 KB) | ledes, títulos do Ano, linha de dinheiro |
| **Geist Mono** (já existe) | meses, códigos matriciais, NIF, nº de recibo, DICOFRE |

| Papel | Tam./Alt. | Peso | Tracking | Fam. |
|---|---|---|---|---|
| Linha de dinheiro | 44 / 1.0 | 400 | −.02em | Newsreader |
| Título de superfície | 28 / 1.15 | 400 | −.01em | Newsreader |
| Lede | 16 / 1.5 | 400 | 0 | Geist |
| Título de bloco | 14 / 1.3 | 550 | 0 | Geist |
| Corpo | 13.5 / 1.5 | 400 | 0 | Geist |
| Rótulo de campo | 11 / 1.2 | 500 | .04em caixa alta | Geist |
| Célula densa | 12.5 / 1.2 | 400 | 0 | Geist |
| Figura em coluna | 13 / 1.2 | 500 | 0 | Geist + `tabular-nums` |
| Código / mês | 11.5 / 1.2 | 450 | .01em | Geist Mono |
| Micro-nota | 11 / 1.4 | 400 | 0 | Geist |

**Estilo monetário** (componente `Money`, para todo o euro da app): magnitude a peso 500; `,50` e `€` a
`0.72em` e 55% de opacidade; `tabular-nums` sempre; milhares com espaço fino; negativo com menos
verdadeiro (−), nunca parênteses. A magnitude lê-se primeiro e as colunas alinham pela vírgula.

Máximo 72 caracteres por linha em texto de leitura. Nunca duas famílias na mesma linha, exceto `Money`
dentro de prosa.

### 10.5 Animações

```
--t-instant 90ms · --t-fast 140ms · --t-base 200ms · --t-slow 280ms · --t-sheet 320ms · --t-count 420ms
--e-out cubic-bezier(.16,1,.3,1) · --e-in-out cubic-bezier(.4,0,.2,1) · --e-in cubic-bezier(.4,0,1,1)
```

1. Nada acima de 420 ms. Nada em loop.
2. Só se animam `transform`, `opacity`, `background-color`, `border-color` e altura via
   `grid-template-rows`. Nunca `width` de layout, `top/left` ou `box-shadow`.
3. Entrada só no mount. Re-render nunca reanima.
4. Stagger com teto absoluto de 240 ms (43 faixas × 20 ms seriam 860 ms: proibido).
5. Contagem de número só em: linha de dinheiro, subtotal de grupo, coluna da carteira.
6. `prefers-reduced-motion: reduce` desliga tudo num bloco único no `globals.css`.

### 10.6 Data visualization: sete objetos, e uma lista de proibidos

`Faixa` · `Faixa da carteira` · `Money` · `Tira de pares` (dot plot 1-D com mediana e INE) ·
`Barras de estágio` (€ por estágio 1/2/3) · `Cascata` (rendas → despesas → líquido → imposto →
retenção → a pagar) · `Escada de renda` (custo composto de não atualizar).

**Proibidos:** pie, donut, gauge, radar, 3D, área empilhada de séries não aditivas, eixo Y truncado,
duplo eixo Y, e qualquer gráfico cujo título não seja uma afirmação. Todo o eixo € começa em 0. Toda a
estimativa aparece com intervalo ou hachura.

### 10.7 Componentes

**Mantidos e estendidos** em `src/components/ui.tsx` (**nunca levar `"use client"`**, ver A.3):
`cn`, `Card`, `Button` (+ `as="a"`), `Input`/`Select`/`Textarea`/`Field`/`Label`, `Badge`,
`Modal` (+ Esc, focus trap, scroll lock), `EmptyState`.

**Removidos:** `PageHeader` (→ `Lede`), `StatCard` (a V2 não tem grelhas de KPI), `Table`/`Th`/`Td` no
caminho crítico (ficam para o Ano e Admin), `edgeFade`.

**Novos** `components/kit/`: `Money`, `Figure`, `Lede`, `Cobertura`, `Confianca`, `Sheet`, `Popover`,
`Comando`, `Grupo`.
**Novos** `components/faixa/`: `Faixa`, `FaixaCelula`, `FaixaEixo`, `FaixaCarteira`, `FaixaLegenda`,
`CelulaPopover`, `SeletorDensidade`, `SeletorZoom`.
**Novos** `components/agora/`: `LinhaDeDinheiro`, `GrupoDeDecisoes`, `Decisao`, `AcaoInline`,
`ProgressoDoCiclo`, `FilaVazia`, `AbaixoDoLimiar`, `SequenciaDeFichas`.
**Novos** `components/ano/`: `Cascata`, `DecisaoDoAno`, `BlocoColapsavel`, `TabelaQuadro`,
`AreaDeImpressao`.
**Novos** `components/viz/`: `TiraDePares`, `BarrasDeEstagio`, `MiniFaixa`, `EscadaDeRenda`.

**Removidos de `charts.tsx`:** `MonthlyFlowChart`, `CollectionRateChart`, `FlowLegend`,
`ArrearsFlowChart` e os dois tooltips duplicados. Recharts fica só no Ano (cascata) e, na V3, na
projeção; se no fim da Fase 4 não tiver uso, sai do `package.json`.

**Destino do `forms.tsx` (706 linhas, 9 formulários modais):** não sobrevive como ficheiro.

| Formulário V1 | Para onde vai |
|---|---|
| `ExpenseFormButton` | Comando (`IMI 213,40 bloco a 30/04`) + edição inline na ficha |
| `RentUpdateButton` | ação inline do item `atualizacao_renda_elegivel` |
| `PropertyFormButton` | edição inline no bloco "Ficha e proprietários" da ficha |
| `ContractFormButton` | edição inline no bloco de contratos da ficha |
| `EndContract`, `Delete*` | rodapé do bloco respetivo, com confirmação inline (não `window.confirm`) |
| `LandlordFormButton` | menu de conta → Senhorios (admin, raro) |
| `PaymentModal` | popover de célula da faixa + `bulkMarkPayments` para seleção múltipla |
| `useAction()` | mantém-se, movido para `lib/useAction.ts` |

Zero modais no caminho normal. Modal fica para o Admin e confirmações irreversíveis.

---

## 11. Fluxos de utilização

A V1 desenhou-se como se houvesse um hábito diário. Não há: os recibos entram em lote e o IRS é anual.

### O ciclo do mês (~7 minutos, dias 1 a 8)

```
1. Abrir Agora. A cabeça diz o que o mês vale e o que falta.               0:10
2. "Emitir 46 recibos": lista com [copiar dados] por linha, deep-link ao
   Portal. Emitir lá, marcar aqui em lote.                                5:00
3. Largar o ListaRecibos.xlsx na app. Diff: "44 novos, 2 divergências,
   0 duplicados, 1 anulado". Confirmar.                                   0:40
4. A fronteira do conhecido avança um mês; os atrasos recalculam-se.
   Os que sobram são reais.                                               0:10
5. Resolver o que sobrou: 2 itens, ações inline.                          1:00
6. "Ciclo de julho fechado." A linha de dinheiro desce.                   0:05
```

Cliques no passo mais pesado: V1 ≈ 46 × modal de 3 campos ≈ 140 ações. V2 ≈ 46 × 1 + 1 import ≈ 47.

### A verificação de 60 segundos

Agora → ler a cabeça → se a fila está vazia, fechar. Nunca é preciso abrir a Carteira para saber se
está tudo bem.

### O fecho do ano (março a junho)

Ano → escolher senhorio → o documento explica, por ordem: quanto entrou, quanto se gastou, quanto se
retém, que regime paga menos e porquê, que contratos comunicar à AT, exposição a AIMI. Exportar Anexo F,
imprimir o relatório para a família.

### O momento do viewer

Entra, lê cinco frases sobre o mês, vê a faixa da carteira, fecha. Nenhum formulário, nenhuma fila,
nenhum número sem contexto.

---

## 12. Riscos assumidos (e o que os mitiga)

| # | Risco | Mitigação |
|---|---|---|
| C1 | A fila torna-se um segundo inbox que ninguém esvazia | **Teste de aceitação da Fase 2: com a BD real, a fila cabe em 8 itens.** Se não couber, o limiar sobe |
| C2 | O modelo de risco tem n=43; nenhum shrinkage salva uma amostra pequena | A **ordenação** é o produto; o nível em euros é sempre secundário e sempre com intervalo |
| C3 | O valor da informação é estimativa sobre estimativa | Sempre "até X", com a conta e o número de casos confirmados vs assumidos; assumidos nunca somam na linha do topo |
| C4 | A faixa pode ser ilegível no telemóvel | 8 meses com snap; telemóvel é triagem (Agora), desktop é análise. Se o uso for sobretudo móvel, a escolha está errada de raiz |
| C5 | Altura como codificação falha em valores pequenos | Piso de 3px + tique de parcial + coluna de números + popover |
| C6 | Sete fases é otimista para noites e fins de semana | A Fase 0 repalete a V1 inteira primeiro, para o híbrido nunca existir visualmente |
| C7 | "Zero páginas novas" é meio slogan: há 3 destinos, lentes, agrupamentos, fichas e um comando | A aposta é que se aprende uma vez em vez de nove. É crença, não dado |
| C8 | O viewer pode continuar cidadão de segunda: não houve investigação com o pai nem com o avô | **Perguntar antes de construir a Fase 2** |
| C9 | O Anexo F continua a ser estimativa, e a app ficar melhor aumenta o risco de excesso de confiança | Avisos estruturais ("o que a app sabe / o que tens de confirmar"), não rodapés |
| C10 | Metade do valor depende de dados que só o utilizador pode preencher | Dar preço à informação é a melhor resposta que conheço, mas continua a depender das cadernetas |

---

## 13. V3 (fora do âmbito da V2)

1. **Valor e yield modelados** — valor por fração com intervalo (área × mediana de venda INE, ±30%
   declarado), yield bruto e líquido, "vender e reinvestir?" por ativo. Depende das áreas.
2. **Projeção a 12 meses com fan chart** (P10/P50/P90).
3. **Superfície de calibração** — previsto vs realizado ao longo do tempo.
4. **Cenários "e se…"** — mudar uma renda, aplicar o art. 72.º, vender um ativo, e ver o efeito em
   rendimento, imposto, risco e yield.
5. **Viagem no tempo** — arrastar a fronteira para trás e ver a carteira como era conhecida então.
6. **Modo herança** — repartir por herdeiros minimizando AIMI e IRS. Sensível: simulação, nunca conselho.
7. **Documentos** — contratos assinados e cadernetas em Storage privado (era o P2-3 da V1).
8. **Digestão de texto livre com LLM** — colar um email ou fotografar uma fatura. Única entrada possível
   para IA generativa, sempre com confirmação humana.
9. **Digest mensal por email.**
10. **RLS por senhorio** — hoje qualquer autenticado lê tudo.

---

# Apêndice A — conhecimento de domínio (nunca redescobrir, nunca apagar)

## A.1 Ambiente, comandos e pipeline de import

**Ambiente.** Windows 11; node **não** está no PATH. Em Git Bash, prefixar sempre:
`export PATH="/c/Users/migue/AppData/Local/Logi/LogiPluginService/PluginHosts/node22/node:$PATH"`.
`npm run build` é gate obrigatório. `npm run dev` na porta 3000 (ou `start.cmd`; `launch.json` tem
"patrimonio-dev"). `npm run check` corre os self-checks puros (atrasos, saúde, calc, parse, IRS), sem BD
nem framework. Deploy: `npx vercel@latest deploy --prod --yes`. O SQL Editor do Supabase é a via de
administração de dados (corre como superuser, ignora RLS). Python de `dados/`: pandas, xlrd, openpyxl já
instalados. Caminhos com espaços ("OneDrive - ISEG") sempre entre aspas.

**Smoke sem login NÃO chega** para validar páginas com dados: o `anon` não tem GRANT em `payments` e
`fetchAllPayments` rebenta com 42501. Validar autenticado, em dev ou produção.

**Pipeline de import de um senhorio (receita completa):**

1. Obter do Portal das Finanças `ListaContratos.xls`, `ListaRecibos.xlsx` e `patrimonio_predial.csv` →
   pôr em `dados/<Pasta>/` (ex.: `dados/Tio/`).
2. `python dados/analise_senhorio.py <Pasta>` → gera `Analise_<Pasta>.md`; **ler e validar**
   (divergências, anulados, multi-mês, VPT plausível).
3. Garantir que `FOLDER_TO_LANDLORD` em `gerar_sql_import.py` mapeia a pasta ao nome certo do senhorio
   no seed (`Miguel`, `Eva`, `António`, `Ilidio`).
4. `python dados/gerar_sql_import.py <Pasta>` → `import_<pasta>.sql` (idempotente).
5. `python dados/dividir_sql.py import_<pasta>.sql` → partes <150 KB; colar **por ordem** no SQL Editor.
6. Conferir os SELECTs de verificação da última parte contra o `Analise_<Pasta>.md`.
7. Na app: Admin → sincronizar rendas se necessário (`sync_contract_rents`).

Notas: recibos multi-mês são divididos por mês em **cêntimos exatos** (resto na última fatia);
"Anulado" excluído; "Importância recebida" (líquida de retenção) é o cash; `payments` nunca pisam
marcações manuais (`on conflict do nothing`). O import do avô (2026-07-19) incluiu um bloco de LIMPEZA
que apagou os dados errados introduzidos pelo wizard — padrão a reutilizar se voltar a acontecer.

**Convenções de parsing** (docstring de `analise_senhorio.py`): a chave única de contrato é `NContrato`
(a `Referencia` repete-se entre contratos diferentes); `Valor`/`Valor Inicial` do CSV vêm em **CÊNTIMOS**
(÷100 — sem isso os yields dariam 0,1-0,3% em vez de 5-12%); `Parte` é uma fração parseada para `Quota`;
dedupe de recibos por `(NContrato, NRecibo)`, contratos por `NContrato`, património por `Identificador`.

## A.2 Metodologia de Atrasos (`src/lib/arrears.ts`)

Fonte: `payments` (recebimentos reais) × contratos ativos. Constantes: `GRACE_DAYS = 8`,
`DEBT_CAP_MONTHS = 24`, `CADENCE_WINDOW_MONTHS = 36`, `MISSED_WINDOW_MONTHS = 12`, `EPSILON_EUR = 1`,
`REFERENCE_WINDOW_MONTHS = 24`, `PAID_TOLERANCE = 0.9`, `STALE_MONTHS = 12`.

- **Renda de referência (`referenceRent`, base de TUDO):** `min(contract.rent, mediana dos meses com
  pagamento nos últimos 24m)`. `contract.rent` é escalar, bruto e com o valor de HOJE, mas os payments
  são cash LÍQUIDO e histórico — compará-los diretamente gerava falsos positivos em massa. A mediana
  absorve retenção na fonte (25% em inquilinos-empresa) e atualizações de renda sem precisar de
  `rent_updates` nem da coluna `withholding`. Nunca sobe acima de `rent`; onde diverge, a UI mostra
  "recebe X".
- **Mês liquidado (`isMonthSettled`):** recebido ≥ 90% da renda de referência **e** ≥ 1 €.
- **Mês vencido:** a renda vence ao dia 1 e conta como devida a partir do dia 8.
- **Horizonte de dados (`dataHorizonMonth`, trava CRÍTICA):** o último mês devido nunca passa o mês mais
  recente (não futuro) com pagamentos na carteira. Os recibos são importados em lote; enquanto o mês
  corrente não é importado, cobrar atraso por ele dava dívida falsa a TODOS os contratos. É a causa de
  fundo dos falsos positivos. A ficha da fração faz a mesma trava via query barata do máximo `ref_month`.
  Um inquilino que parou mesmo continua apanhado: os outros contratos empurram o horizonte para a frente.
- **Streak:** meses consecutivos não liquidados desde o último mês liquidado até ao último mês devido.
  Sem pagamentos de todo → desde o início do contrato (ou "sem histórico", streak 24 se não houver
  `start_date`). `lastPaidMonth` inclui meses futuros, para não penalizar quem pagou adiantado.
- **Dívida estimada:** `min(streak, 24) × renda de referência`. Meses parciais **não** somam défice por
  cima (o streak já os conta como mês inteiro). Contratos sem recibos há >12m não somam dívida: badge
  "confirmar se cessou" (ex.: 512797/Ilídio, sem recibos desde 2021-10).
- **Cadência própria:** mediana do intervalo entre meses liquidados (janela 36m); se ≥2 (ex.: Loja S.
  Pedro paga ao trimestre), severidade ajustada + badge "paga a cada ~N meses".
- **Severidade:** ok / atenção (1) / atraso (2-3) / crítico (>3), ajustada pela cadência.
- **Gráfico esperado-vs-recebido:** 12 meses FECHADOS (exclui o corrente, que tem recibos por emitir);
  esperado = Σ renda de referência dos contratos JÁ em vigor nesse mês; recebido só de contratos ativos
  (mesmo universo). Antes usava renda atual constante → gap fantasma + penhasco.

**Armadilha CRÍTICA (resolvida 2026-07-20):** `.limit(50000)` **NÃO** passa por cima do max-rows do
Supabase (~1000). A leitura do histórico completo (>5000 linhas) vinha truncada → contratos para lá da
linha 1000 apareciam como "nunca"/24 e o que ficava a cavalo aparecia parcial. Fix: `fetchAllPayments`
em `data.ts` pagina por `.range()` (helper puro `paginateAll` em `paginate.ts`, testado nos casos G/H).

**Correção de falsos positivos (2026-07-20):** a comparação contra `contract.rent` fazia meses
perfeitamente pagos parecerem em falta; quando nenhum mês atingia a renda atual, caía no ramo "sem mês
pago" e inventava 24×renda. Casos reais: retenção na fonte (6204271: recibo 600/pago 450 → falso
7.200 €), atualização de renda sem recibos novos (RCFDT 68686 → falso 7.104 €), dupla contagem de
parciais, contratos-zombie. Resultado: 44.539 € → 25.375 € (−43%). **Ronda 2 (mesma data):** a causa de
fundo era o horizonte de dados; com a trava, o RCFDT vai a 0 (toda a dívida dele era falsa).

**Self-check:** `npm run check:arrears` (`src/lib/arrears.check.ts`) — 9 casos, relógio fixo
(`LAST_DUE = 2026-07-01`), corre o `computeArrearsRow` real sem framework: A retenção 25% → expected 450
e dívida 0; B RCFDT expected 290 e não 24×296; B2 horizonte a 2026-01 → dívida 0; B3 quem parou mesmo
continua apanhado; C parcial não conta duas vezes; D zombie com dívida 0; E referência nunca acima da
contratada; F sem pagamentos → expected = rent; G/H `paginateAll` sem perder nem repetir linhas.

**Limitações honestas (nunca esconder ao utilizador):** os payments derivam de RECIBOS — renda paga em
dinheiro sem recibo aparece como atraso; a app mede "recibos em falta", que é o proxy possível. A renda
de referência normaliza quem paga sistematicamente a menos do que devia — daí o desvio ser mostrado,
não escondido.

## A.3 Armadilhas e decisões permanentes (não re-litigar)

- **Ótica de família:** valores por INTEIRO em toda a apresentação; as quotas de `property_owners` só
  servem para o IRS.
- **Dedupe global de recibos por `receipt_number` composto** (`contrato/recibo(#parte)`) — protege a
  compropriedade: o mesmo recibo aparece no export de dois senhorios. Nunca relaxar.
- VPT do CSV do Portal em cêntimos ÷100; "Importância recebida" = cash líquido de retenção.
- Recibos "Anulado" nunca contam; multi-mês divide-se em cêntimos exatos (resto na última fatia).
- **PostgREST devolve no MÁXIMO ~1000 linhas por defeito** e `.limit()` não resolve → `paginateAll`.
- Import por SQL Editor > wizard (superuser, idempotente, verificável). O wizard fica para casos
  pequenos até a Fase 6 o substituir por largar-ficheiro + diff.
- `payments` com `on conflict do nothing`: reimports nunca pisam marcações manuais.
- **`sync_contract_rents()` tem de AGRUPAR e SOMAR por `(contract_id, ref_month)`** antes de escolher o
  mês mais recente. Bug corrigido 2026-07-23: quando um contrato tem a renda mensal dividida em mais de
  um recibo no mesmo mês (ex.: 1905921 "lote 2e": 260 € + 70 € = 330 €), a versão antiga
  (`distinct on (contract_id) order by ref_month desc`) escolhia uma linha sem critério e podia gravar
  70 € em vez de 330 €. Depois de colar no SQL Editor, correr "Sincronizar rendas" (Admin).
- **`src/components/ui.tsx` NÃO pode levar `"use client"`.** É módulo partilhado: as páginas server
  passam `icon={LucideIcon}`; com a diretiva cria-se uma fronteira de serialização e TODAS essas páginas
  crasham em runtime (digest; o build não apanha). Foi o hotfix de 2026-07-20. Componentes com hooks vão
  para ficheiros próprios. Para reproduzir/validar sem login: página temporária em
  `src/app/login/debug/page.tsx` (o middleware deixa passar tudo o que começa por `/login`), apagada
  antes do deploy.
- Node só via a pasta Logitech (A.1).
- **Senhorios e Saúde dos dados são admin-only** (2026-07-23): fora do menu do viewer **E** com guard na
  própria página — esconder o link não bastava, a rota continuava acessível por URL direto.
- **A anon key é pública e o repo não é a fronteira de segurança.** Ela viaja no bundle JS em produção.
  Quem protege os dados é (1) o registo de contas estar FECHADO no Supabase e (2) o RLS. Como o RLS é
  `using (true)` para qualquer autenticado, uma conta = leitura total da carteira (frações, contratos,
  nomes e NIFs de inquilinos, rendas, recibos, VPT). Qualquer alteração a auth ou a políticas passa por
  aqui primeiro. Repo GitHub privado por decisão: não guarda dados, mas revela a estrutura da carteira.
- Os GRANTs no fim de `supabase/schema.sql` são NECESSÁRIOS (sem eles o PostgREST dá 42501).
- `dados/` é gitignored e contém dados pessoais reais — nunca commitar nem expor.
- **Sem commits nem push sem pedido explícito do utilizador.**
- **P0-1 Tio Ilídio: BLOQUEADO indefinidamente** (o utilizador não terá acesso aos exports do Portal).
  Confirmado que "tudo o que o António tem é igual para o Ilídio", mas o CSV do Pai mostra quota=100% na
  generalidade das frações — os dados **não** indicam compropriedade generalizada Pai/Tio. **Não
  inventar quotas.** Avó Eva não terá pasta própria: o export do avô representa o casal.
- **P2-1 Conciliação bancária: RECUSADA** (2026-07-23) — os recibos são emitidos manualmente, não
  compensa cruzar com extrato. **P3-1 Emissão automática de recibos no Portal: RECUSADA
  DEFINITIVAMENTE** (2026-07-24) — 2FA associado ao telemóvel do tio Ilídio, a quem não há acesso.
  **P2-4 Vitest: FECHADO** — os `*.check.ts` puros já correm o código real com `assert`, sem framework
  nem devDep, e já estão no CI. Casos novos vão para o `*.check.ts` do módulo respetivo.
- Terrenos e vendidos fora das métricas correntes via `isCurrentProperty(p)` /
  `currentProperties(list)` em `calc.ts` (`status !== 'terreno' && status !== 'vendido'`). O histórico
  fica na BD e continua visível na lista e na ficha; só deixa de contar para métricas correntes.
- Escalões de IRS em `IRS_BRACKETS_BY_YEAR` (`irs.ts`), tabela POR ANO com 2025 e 2026.
  **Ano novo = acrescentar uma entrada e confirmar contra a tabela oficial da AT** (a fonte usada,
  doutorfinancas.pt, não é oficial).

## A.4 Análise IRS 2025 (Pai e Avô) — levers fiscais

> NÃO é aconselhamento fiscal vinculativo. São estimativas para desenhar o produto. Qualquer decisão
> numa declaração real confirma-se no simulador da AT ou com contabilista.
> Fonte: `dados/Pai/IRS_PAI.pdf`, `dados/Avo_Miguel/IRS_Miguel.pdf` (ano 2025).

**Números-chave.** Pai (António, NIF 186274220, solteiro/divorciado, incapacidade 62%): Anexo F rendas
ilíquidas 45.835 €, gastos ~6,6k (conservação apenas **1.500 €**), retenção 1.200 €, pensão 10.440 €;
optou por ENGLOBAMENTO; AIMI 668 € (VPT 695k). Avô (Miguel 123645891 + Eva 123645905, casados,
tributação CONJUNTA, Miguel 60% incap.): Anexo F rendas 90.458 € (frações a 50/50, por isso duplicadas
A/B), gastos ~38,9k (conservação **26.587 €**), retenção 150 €, pensões 15.742 €; optou por
ENGLOBAMENTO; AIMI 1.314 € (VPT 1,39M, usa o limite de casal de 1,2M). Mais-valia rústica pequena (G).

**Levers, por ordem de impacto:**

1. **Taxa reduzida de longa duração (art. 72.º) — Q4.2 VAZIO nos dois, o maior lever.** TODOS os
   contratos estão no Q4.1 (regime geral). Muitos são antigos (1978, 1995, 1999, 2004, 2010-2016):
   contratos de HABITAÇÃO com ≥5/10/20 anos podiam estar a 15%/10%/5% em vez de 28%. Exige uso
   habitacional + duração + comunicação à AT (Portaria 110/2019). Comércio e garagens não entram
   (ex.: garagem 68631 a 25 €/mês).
2. **Englobamento vs 28% autónoma — os dois escolheram englobar.** Não é claramente errado: para o Avô
   (casal, quociente, pensões baixas, incapacidade) englobar pode ganhar; para o Pai (individual, ~56k,
   taxa média mais alta) os 28% podem ganhar. **É um cálculo a refazer TODOS os anos.**
3. **Despesas dedutíveis subaproveitadas (sobretudo o Pai): 1.500 € vs 26.587 € do Avô**, em 29 vs 46
   contratos. Se há manutenção real sem fatura com NIF do senhorio, perde-se dedução ao marginal
   (~28-40%). Dedutível em F: conservação, condomínio, IMI, selo, taxas; **NÃO** financiamento nem obras
   de valorização.
4. **Retenção na fonte** (inquilino-empresa retém ~25%): é crédito, não poupança, mas tem de ser
   modelada (crédito no Anexo F + exatidão da renda de referência). Particular não retém.
5. **AIMI:** ambos pagam e deduzem no Anexo F (Q9). Distribuir propriedade por herdeiros reduz o AIMI
   (limite 600k/pessoa) — planeamento sucessório, só sinalizar, nunca aconselhar.

**Decisões fiscais assumidas no código** (todas comentadas em `irs.ts`): despesas dedutíveis = `imi` e
`condominio`; `obras` e `outras` ficam "a confirmar" e NÃO deduzem (obras tanto pode ser conservação
como valorização); `seguro` e `financiamento` excluídas (art. 41.º). Ano fiscal por `issue_date` (ano de
recebimento) — um recibo multi-mês emitido em janeiro conta todo no ano de emissão. Simulação de
englobamento isolada ao predial líquido do senhorio, sem quociente conjugal nem outras categorias: é o
limite honesto do que a app sabe, e está escrito na página. Colunas em branco no export por não serem
determináveis: "Natureza", NIF do arrendatário e "atualização de renda > 1,02".

---

# Apêndice B — pendências que só o utilizador pode resolver

Bloqueiam **valor**, não código. Por ordem de impacto:

1. **Reimport dos recibos** para preencher `receipts.withholding` (§4 de A.1). Sem isto o Anexo F mostra
   retenção zero. Atenção: fazer **depois** de QW1 estar corrigido, senão as rendas ilíquidas passam a
   vir sobre-declaradas (B1).
2. **Áreas (m²), tipologia e freguesia/DICOFRE das frações**, a partir das cadernetas prediais (a UI de
   edição já existe). Desbloqueia €/m² vs INE, valor estimado, e metade dos casos de art. 72.º. São ~15
   fichas; é o item de maior valor por minuto de trabalho em todo o projeto.
3. **Conferir `IRS_BRACKETS_BY_YEAR`** (`src/lib/irs.ts`, 2025 e 2026) contra a tabela oficial da AT.
4. **Colar no SQL Editor** as migrações idempotentes S1/S2/S6 do fim de `supabase/schema.sql`
   (acrescentadas na Fase 0) e depois as de fases seguintes (S3/S4/S5).
5. **Confirmar se há mais imóveis vendidos por identificar** (só se conhece o `182341-U-4364`) e se
   alguma fração marcada `terreno` é terreno para CONSTRUÇÃO (sujeito a AIMI, ao contrário do rústico;
   hoje são todas excluídas).
6. **Ligar o repo ao projeto no Vercel** (Settings → Git → Connect) para o deploy deixar de ser manual.
7. **Gralha `2783-L` vs `2783-K`** nos dados do Pai: `181710-U-2783-L` aparece em contratos e recibos
   mas não no CSV de património predial.
8. **Tio Ilídio:** se um dia aparecerem os exports, a receita de A.1 aplica-se tal e qual
   (`FOLDER_TO_LANDLORD` já mapeia `"Tio": "Ilidio"`).
