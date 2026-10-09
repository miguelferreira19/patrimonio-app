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
- `npm run check` = **25 self-checks puros** (os 18 de sempre, mais validar, agenda, ics, predios, mes, imoveis e pesquisa), sem BD
  nem framework. Desde 2026-10-03 é UMA compilação (`tsconfig.check.json`, modo strict) e um runner
  (`scripts/checks.cjs`) que descobre sozinho todo o `src/lib/**/*.check.ts`: um check novo não se
  regista em lado nenhum. ~10 s (eram 73). Os 19 scripts `check:<mod>` saíram: compilavam sem `strict` e
  divergiam do gate. Casos
  novos vão para o `*.check.ts` do módulo respetivo — nunca um framework novo.
- **Nunca correr `npm run build` com o dev ligado**: os dois escrevem na mesma `.next` e o dev
  passa a dar páginas em branco (`Cannot find module './vendor-chunks/...'`). Parar o dev, apagar
  `.next`, voltar a arrancar.
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
  Desde 2026-08-17 o caminho (a) corre **sozinho, dias 15 e último de cada mês**
  (`dados/recolher_recibos.py`, Agendador de Tarefas do Windows): Playwright faz login no Portal,
  exporta o histórico inteiro de recibos, corre o `gerar_sql_import.py` e aplica o SQL por ligação
  direta ao Postgres. Segredos em `dados/.env`, log em `dados/recolha.log`, cópia datada de cada
  recolha em `dados/_recolhas/`. Corre na máquina local com sessão iniciada — não na Vercel: as
  credenciais teriam de viver no servidor e o Portal barra IPs de datacenter.
- Recibos: dedupe GLOBAL por `receipt_number` = "contrato/recibo(#parte)" — nunca relaxar
  (compropriedade: o mesmo recibo aparece no export de dois senhorios).
- **`receipts.amount` é o valor ILÍQUIDO** (coluna "Valor"); o líquido é `amount - withholding`.
  Quem guarda cash líquido é `payments.amount`. Foi o bug B1 (o Anexo F somava a retenção duas
  vezes) — está no `irs.check.ts` como caso de regressão, não voltar a trocar.
- VPT no CSV do Portal vem em CÊNTIMOS (÷100) — já tratado em `dados/analise_senhorio.py` — **e
  vem multiplicado pela QUOTA do titular**. O VPT por inteiro está na caderneta predial, em EUROS
  (`dados/ler_cadernetas.py`); a app assume-o por inteiro e aplica a quota no `irs.ts`.
- **A parte de um senhorio numa despesa calcula-se SÓ com `expenseShare` (irs.ts)**, usada pelo
  Anexo F e pela página de Senhorios. `apenasRegistadas: true` ao fisco, `false` na análise de
  carteira. Somar o valor inteiro da fração a cada co-titular fazia cada um ver o dobro.
- **AIMI (`aimiExposure`/`aimiTax` no irs.ts)**: a base NÃO é a soma dos VPT. Ficam de fora,
  por lei (art. 135.º-B n.º 2 do CIMI), os **rústicos** — teste é o `-R-` do artigo matricial,
  não o `status`, que nos rústicos importados do Portal diz "vago" — e os urbanos de
  **comércio, indústria ou serviços**, reconhecidos pelo mesmo `classifyUso` do art. 72.º.
  Sem tipologia na ficha a fração CONTA (não se abate imposto por um campo vazio). Uma só
  fração de serviços (`182341-U-2198-A`, VPT 310.492 €) inflacionava o AIMI do avô em mais de
  1.500 €/ano. As taxas do art. 135.º-F medem-se no VPT, não no que sobra da dedução.
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
  desenhada e coluna da direita por lente.
  É a ÚNICA implementação da grelha mensal — as três da V1 foram apagadas na Fase 3.
  **Marcar pagamentos à mão acabou (2026-07-31)**: o dinheiro entra todo pelo import do Portal
  das Finanças, por isso as células deixaram de ser clicáveis e foram apagados o
  `pagamento-modal.tsx`, o CTA "Registar pagamento" do Início e as actions `markPayment`/
  `removePayment` do `crud.ts`. Uma correção pontual faz-se por SQL. Não voltar a acrescentar
  escrita manual de pagamentos sem o utilizador pedir.
- **`src/components/masthead.tsx`** — a navegação desde 2026-07-29: cabeçalho em papel com o nome
  em Newsreader e os destinos como separadores (colam ao topo no scroll), admin num menu à direita.
  Substituiu o rail escuro por o rail ser vocabulário de dashboard SaaS colado a um sistema de
  papel-e-tinta — a app tinha duas personalidades. **O `nav.tsx` fica no repo, intacto**: voltar
  atrás é trocar o import no `(app)/layout.tsx` e repor a margem do `<main>` (instruções em
  comentário no próprio ficheiro).
- `src/components/{nav,forms,charts,setup-notice}.tsx` — V1. O `charts.tsx` chegou a ser apagado na
  Fase 7 e **voltou** a pedido do utilizador (2026-07-25): a faixa responde "que mês falhou em que
  fração", o gráfico responde "quanto entrou contra o esperado, mês a mês", e é essa a leitura que a
  família quer. Desde 2026-07-31 a abertura do Início usa o `FluxoMensalChart` (barras do
  recebido, âmbar no mês que fica aquém, linha tracejada da renda de REFERÊNCIA) em vez da curva
  do acumulado — o acumulado subia sempre e escondia o mês mau. **Nunca pôr o líquido mês a mês**:
  as despesas do Anexo F ficam todas a 31-12 e o gráfico desenhava um penhasco em dezembro que é
  artefacto da data (V3.md, achado 7 da auditoria de 2026-07-29). O custo de ~50 kB do `recharts` está assumido. `forms.tsx` (706 linhas de formulários
  modais) vai ser dissolvido em edição inline e no comando ⌘K; ver PLANO.md §10.7.
- CTAs que navegam (`<Link>`, `<a href="/api/...">`) usam `buttonClass(...)`, nunca strings de
  classes copiadas.

## V4 · "banca calma" (2026-10-09, REDESENHO.md §11)
- **Quatro destinos** no `components/shell.tsx` (barra lateral; separadores EM BAIXO no
  telemóvel): **Hoje** (`/`), **Imóveis** (`/imoveis`, `/imoveis/[chave]`), **Dinheiro**
  (`/dinheiro?tab=irs|analise|mercado`, que embebe Ano, Análise e Mercado) e **Arquivo**
  (`/arquivo`; `?fracao=` mostra a vista antiga de uma fração com as minutas). As rotas antigas
  continuam a funcionar e acendem o destino certo (`DONO` no shell). `masthead.tsx` e `nav.tsx`
  ficam no repo para voltar atrás.
- **Prédio = artigo matricial sem a fração** (`lib/portfolio/predios.ts`): `nomeDaFracao()` é o
  nome a usar FORA do prédio ("Rua X, 68 · 1.º Esq."), nunca `property.name` cru. Nomes de pessoas
  passam por `nomeProprio()`.
- **A manchete de Hoje é o `mes.ts`**: recebido / por receber do mês corrente, sem "em atraso"
  (os recibos só entram nos dias 15 e último). Em atraso = `emAtrasoDaCarteira()` (insights.ts),
  a MESMA definição na tarefa "Cobrar", no cartão do mês e nos Imóveis.
- **Tipografia: só Inter** (`--font-inter`); `font-serif` legado cai na Inter. Geist Mono para
  códigos. Cartões `rounded-2xl`, botões `rounded-full`. O `Modal` é uma folha lateral; listas
  longas abrem em `components/folha.tsx` (`<dialog>` nativo).
- **Pesquisa global**: `/api/pesquisa` devolve o índice uma vez; `procurar()` (pesquisa.ts) filtra
  no browser. Números curtos casam a palavra inteira.
- **Acabamento de 2026-10-09**: `AUDITORIA_UX.md` contém o plano e a validação. Ajuda no
  invólucro; «Verificar dados» abre `/saude` (admin), com `?gravidade=erro|aviso|info`.
  `/imoveis?f=parados` encontra fontes paradas mesmo que o prédio também tenha atraso.
  Marca corrente: `public/marca.svg`; regenerar os ícones com `node scripts/gerar-icons.cjs`.
  `Field` associa a etiqueta por envolvimento; não pôr vários campos dentro do mesmo `Field`.

## Regras da remodelação de 2026-10-03 (ver RELATORIO_FINAL.md)
- **Leituras nunca engolem erros.** `linhas()`/`linha()` de `lib/supabase/dados.ts` lançam com o
  nome da tabela; `(q.data ?? []) as T[]` é proibido (tratava uma falha como carteira vazia, e o
  Anexo F podia sair sem rendas). Quem lança cai no `(app)/error.tsx`.
- **Escritas validam no servidor** com as guardas puras de `lib/validar.ts` (quotas em ]0,100] e
  soma ≤ 100, datas reais, valores finitos). Números escritos à mão passam SEMPRE por
  `parseAmount` (lê "1.200" como 1200; o `Number(s.replace(",", "."))` lia 1,2).
- **Titulares: upsert e depois poda**, nunca apagar e inserir. **Upload: nunca `upsert: true`** (o
  arquivo não tem versões); um nome repetido ganha sufixo (`comSufixo`).
- **Relógio de Lisboa no servidor** (`src/instrumentation.ts` fixa `TZ`; a Vercel corre em UTC).
- **CSP em `next.config.ts`**: o browser só fala com a própria app e com o Supabase. Um serviço
  externo novo chamado do BROWSER tem de entrar no `connect-src`, senão é bloqueado em silêncio.
- **O cron do INE falha fechado** sem `CRON_SECRET`; o núcleo `runIneRefresh` vive em
  `lib/ine-refresh.ts` porque num ficheiro `"use server"` qualquer export vira endpoint.
- **Agenda** (`lib/portfolio/agenda.ts`, `lib/ics.ts`, `/api/agenda`): prazos fiscais de
  calendário fixo e cartas de atualização de renda; os fins de contrato NÃO entram porque 0 de 42
  contratos ativos têm `end_date`.

## Saúde dos dados: o que NÃO é anomalia (2026-07-30)
Três checks estavam a acusar factos normais da carteira. As três regras novas vivem em
`src/lib/health.ts` e têm caso de regressão no `health.check.ts` (C4, D, E):
- **`renda_desalinhada`** compara a renda do contrato com a MEDIANA DOS PAGAMENTOS, que é cash
  LÍQUIDO. `payments.amount` é a "Importância recebida" do recibo, por isso só pode ficar abaixo do
  ilíquido por **retenção na fonte** ou por um mês parcial. Quando `rendaObservada` (os recibos)
  confirma a renda do contrato, o buraco está explicado e não se assinala. Eram as 4 linhas da
  carteira real, todas inquilinos-empresa a reter 25%.
- **`contratos_sobrepostos`** só conta entre contratos **ATIVOS**. Dois cessados que coincidiram em
  2015 não se "fecham com data de fim" — já estão fechados — e um andar mais a garagem no mesmo
  artigo matricial é a realidade. Quando há mesmo dois ativos, o snapshot já usa **o mais recente**
  (ordena por `start_date` desc e apanha o primeiro ativo); o aviso diz que a app está a escolher.
- **`quotas`**: somar MENOS de 100% é `info`, não erro. O import do Portal só cria a linha do
  senhorio importado, e o tio Ilídio (metade de quase tudo o que é do Pai) nunca terá exports; há
  ainda frações onde a família é mesmo minoritária (a garagem `182321-U-1217-A` tem 15 titulares).
  Passar dos 100% é que continua a ser erro. O upsert dos titulares está pronto em
  `dados/update_cadernetas_pai.sql` e falta colá-lo.

## Estado de um mês: uma só verdade
`src/lib/monthcell.ts` define o vocabulário único (`pago | parcial | falta | fora | futuro`) e
`monthCellStatus()`. A tolerância de 90% continua a viver em `isMonthSettled` (arrears.ts) — não
reimplementar. **`futuro` = além da fronteira de dados**: um mês ainda não importado NUNCA é "falta"
(era o bug B2, que fazia o mesmo mês aparecer vermelho em Pagamentos e verde em Atrasos).

**A fronteira é POR FONTE desde 2026-10-03** (`horizontePorContrato` em arrears.ts). Cada
contrato pára no mês da última emissão do senhorio que lhe passa os recibos (o do recibo
mais recente), nunca para lá da fronteira global. Foi a morte do avô: os recibos dele param a
2/07, os do António continuam, e a fronteira global cobrava ago/set como dívida a 20
inquilinos do avô. Uma fonte com a última emissão 2+ meses atrás do último mês devido é
`parada`: os contratos dela saem dos "recibos por emitir", aparece UM aviso "Recibos de X
parados desde…" (grupo Por saber, `assumido`), e a Cobertura diz "X só até…". O snapshot
expõe `fontes`, `fronteiraComum` (o mês que TODAS as fontes conhecem, corte de qualquer
comparação da carteira inteira) e `faixaMeses` (os meses das faixas; a Carteira desenha o
eixo com estes). A ficha da fração aplica a mesma regra com uma query à última emissão da
fonte. Quando os herdeiros começarem a emitir, os recibos novos vêm de outro `landlord_id` e
os contratos mudam de fonte sozinhos.

## Estrutura
- `src/app/(app)/` páginas autenticadas. **Viewer vê 5 destinos** (Início, Carteira, Mercado, IRS,
  Documentos);
  o resto é admin-only, com guarda de página (`redirect("/")`), não só filtro no menu.
  O Mercado subiu a destino de família em 2026-07-29: só era admin por não ter números
  (áreas por preencher + bug B5 do território), e as duas razões acabaram.
  - Início (`page.tsx`, rota `/`) — duas leituras SEPARADAS, `Estado` para viewer e `Decisoes` para admin.
    Não voltar a entrelaçá-las com `isAdmin ?` no meio da árvore.
  - `carteira` — a faixa, com lentes por `searchParams`. Para viewer a lente é **forçada a
    `risco` no servidor**; não chega esconder o seletor. **São TRÊS lentes desde 2026-07-31**
    (Cobrança, Risco, Vazios): "Renda" e "Mercado" saíram a pedido do utilizador — a renda do
    contrato já é o número da Cobrança e o €/m² tem a superfície `/mercado` só para ele. Um
    `?lente=renda` antigo cai em Cobrança sozinho. O eixo da faixa marca o ano no PRIMEIRO
    mês e em cada janeiro: só nos janeiros, uma janela que começa em agosto tinha uma única
    etiqueta para dois anos diferentes.
  - `documentos` — o ARQUIVO (2026-07-30). Bucket privado do Supabase Storage `documentos`,
    **sem tabela a indexá-lo**: o caminho de cada objeto é `<artigo matricial>__<ficheiro>`
    (ou `geral__…`), e a convenção vive em `src/lib/documentos.ts`. Tudo na RAIZ do bucket de
    propósito — com pastas a sério, desenhar a página eram ~50 `list()`, um por fração. O upload
    vai DIRETO do browser para o Storage (`components/documentos/carregar.tsx`): uma server action
    corta o corpo do pedido a 1 MB e um contrato digitalizado passa disso. A escrita continua
    fechada pela política `documentos_insert`, que exige `public.is_admin()`. Toda a família lê.
    A leitura do bucket é partilhada com a ficha da fração: `lerArquivo` +
    `<ListaDocumentos>` em `components/documentos/lista.tsx`.
    **Reescrita a 2026-07-30**: a página é UMA FRAÇÃO de cada vez (escolhida no `?fracao=`,
    como as lentes da Carteira) com duas secções — **Minutas** (as cartas, filtradas pelo
    ENQUADRAMENTO) e **Documentos da fração** (o arquivo daquele artigo matricial). O
    **Geral** (IRS, correspondência, mais os órfãos de artigos que nenhuma fração tem) passou
    a ser **só de admin**, no fim e depois de uma fronteira: não é informação de fração e a
    página é para a família toda. O upload dentro da fração já vem com o destino fixo
    (`<Carregar destino={...}>`); o seletor de escopo e o palpite pelo nome do ficheiro (as 30
    cadernetas de uma assentada) ficam na tira do Geral.
  - **`api/minuta/[tipo]/[contractId]`** — as CARTAS, em **.docx** (cessão da posição contratual,
    oposição à renovação, interpelação por rendas em atraso, revogação por acordo, e `renda` para
    a atualização anual). Descarregam-se; não há página HTML de minuta (havia, e foi apagada:
    imprimir para PDF não deixava corrigir o mês em dívida nem o IBAN). O TEXTO vive em
    `src/lib/minutas.ts`, módulo puro com os artigos do Código Civil — é conhecimento de domínio,
    não JSX, e a página `/carta/[contractId]` renderiza os MESMOS parágrafos, senão as duas
    versões da mesma carta divergem. `tipo=renda` sem elegibilidade faz redirect para
    `/carta/[id]`, que é a página que explica porquê.
    **`enquadrarMinutas()`** (mesmo módulo, puro, `minutas.check.ts`) decide QUAIS aparecem em
    `/documentos`: sem contrato ativo não há nenhuma; a atualização de renda exige
    elegibilidade e coeficiente do ano; a interpelação exige rendas por liquidar (excluindo os
    contratos de "ritmo próprio" do arrears.ts); a oposição à renovação exige três anos de
    contrato (artigo 1097.º n.º 3). Devolve as cinco SEMPRE, cada uma com `bloqueio` (a razão
    em PT-PT) ou `null` — quem chama é que esconde. Oferecer uma carta é afirmar que se aplica.
  - `carta/[contractId]` — a atualização de renda em HTML (folha A4 de `components/papel-impresso.tsx`).
    Existe pelos estados de erro: contrato cessado, sem coeficiente do ano, ainda não elegível.
  - `ano/[ano]` — o documento fiscal. `fracoes/[id]`, `carta/[contractId]`,
    `inquilinos/[chave]` (ficha do arrendatário, admin-only; a chave é a MESMA de
    `concentracao().porInquilino` — `nif:...` ou `nome:...`).
  - Admin: **`analise`** (projeção, série anual, concentração, conselhos), `mercado`, `senhorios`,
    `saude`, `admin`.
  - `pagamentos`, `atrasos`, `fracoes`, `despesas` e `irs` são só **redirects** — não voltar a pôr
    conteúdo lá.
- `src/components/` ui.tsx, modal.tsx, kit/, faixa/, nav.tsx, charts.tsx, forms.tsx, setup-notice.tsx
- `src/lib/` cn.ts, format.ts (fmtEur/fmtDate/monthKey/splitEur), documentos.ts, minutas.ts, docx.ts
  (escritor de .docx à mão: um ZIP "stored" mais três XML, para não haver dependência nova), calc.ts, arrears.ts (metodologia de
  atrasos — PLANO.md Apêndice A.2), monthcell.ts, health.ts, irs.ts, ine.ts, data.ts, paginate.ts,
  parse.ts, types.ts, supabase/, actions/ — cada um com o seu `*.check.ts`
- `src/lib/portfolio/` load.ts (o ÚNICO I/O), snapshot.ts, insights.ts (a fila do Agora), risk.ts,
  ano.ts, e os módulos da V3: **renda.ts** (acumulado do ano, série anual, CAGR, rendas paradas,
  concentração por inquilino com HHI), **futuro.ts** (projeção a 24 meses aplicando o `pPagar` do
  risk.ts) e **conselhos.ts**. Os conselhos são uma lista SEPARADA da fila do Agora: reusam o tipo
  `Insight` mas não entram no `GERADORES` do insights.ts, senão o ritual mensal enchia-se de
  estratégia de longo prazo.
- `dados/` scripts Python de análise/import + exports reais por senhorio (Pai, Avo_Miguel, …).
  **Ler `dados/README.md` antes de mexer**: na raiz só os 6 `.py` são fonte, tudo o resto é output
  regenerável e os scripts escrevem sempre para a raiz (`BASE = Path(__file__).parent`). Também lá:
  `sucessao/` (dossiê do falecimento do avô, 27/07/2026) e `_arquivo/`.
- `supabase/schema.sql` — fonte de verdade do modelo de dados

## Pendente do utilizador (bloqueia valor, não código)
Lista completa e priorizada em **PLANO.md, Apêndice B**. O mais urgente: colar no SQL Editor o bloco
"V2 · FASE 0" do fim de `supabase/schema.sql` (índices únicos que só existiam no gerador Python,
`receipts.cancelled`, índices de contrato-mês).
