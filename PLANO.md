# PLANO.md — roteiro do património-app

> **Para quem lê isto (humano ou modelo):** este documento é a fonte de verdade do estado do
> projeto e do que falta fazer. Foi escrito para que um modelo mais económico consiga pegar em
> qualquer item do backlog e implementá-lo sem redescobrir contexto. Antes de tocar em código,
> ler também `CLAUDE.md` (regras operacionais) e, para dados, `dados/analise_senhorio.py`
> (docstring tem as convenções todas). Atualizar este ficheiro no fim de cada sessão relevante.

---

## 1. Visão e estado atual (2026-07-19)

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
- **Mês vencido:** renda vence ao dia 1 (`due_day`); um mês conta como devido a partir do dia
  8 (carência `GRACE_DAYS = 8`). O último mês devido é o corrente se hoje>dia 8, senão o anterior.
- **Streak de atraso:** nº de meses consecutivos sem pagamento desde o último mês pago até ao
  último mês devido. Sem pagamentos de todo → conta desde o início do contrato (ou marca
  "sem histórico" se não houver start_date).
- **Parcial:** soma dos payments do mês < renda − 1€.
- **Dívida estimada:** `min(streak, 24) × renda atual` (nota de método visível na página; o cap
  evita números absurdos em contratos com anos sem recibo — ex.: Capitão Silva Pereira desde
  2021-10).
- **Cadência própria:** mediana do intervalo entre meses pagos (janela 36m); se ≥2 (ex.: Loja
  S. Pedro do pai paga ao trimestre), a severidade é ajustada e mostra-se badge "paga a cada
  ~N meses" — evita falsos positivos.
- **Severidade:** ok / atenção (1 mês) / atraso (2-3) / crítico (>3), ajustada pela cadência.
- KPIs, gráfico esperado-vs-recebido 12m (esperado = rendas ativas atuais, aproximação
  declarada), tabela ordenada por gravidade, detalhe por contrato com grelha de 24 meses.
- **Armadilha:** ler payments com `.limit(...)` alto — o PostgREST corta a 1000 linhas.

Limitações honestas (não esconder ao utilizador): payments derivam de RECIBOS — renda paga em
dinheiro sem recibo aparece como atraso; a app mede "recibos em falta", que é o proxy possível.

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

**P0-3 · Versionar e fazer deploy (Vercel)**
- Objetivo: repo git privado + deploy. Passos: verificar .gitignore (`.env.local`, `dados/`,
  `.next/`, `node_modules/` — CONFIRMAR antes do 1.º commit que nenhum ficheiro de dados reais
  fica tracked), commit inicial, repo GitHub privado, projeto Vercel (env vars
  NEXT_PUBLIC_SUPABASE_URL/ANON_KEY), Supabase Auth → adicionar URL do Vercel aos redirects.
- Aceitação: build Vercel verde; login funciona no domínio; RLS impede escrita de viewer.
- Armadilhas: nunca commitar `dados/`; o middleware usa cookies — testar auth em produção.

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

**P1-2 · Registo rápido de pagamentos em dinheiro**
- Objetivo: na grelha de Pagamentos, marcar um mês como pago em dinheiro em 1 clique (hoje é
  o fluxo manual geral). Método 'dinheiro', source 'manual', received_date = hoje (editável).
- Aceitação: célula muda de estado sem reload completo; Atrasos deixa de listar esse mês.

**P1-3 · Checklist mensal de recibos a emitir**
- Objetivo: página/secção "Este mês" no dashboard: contratos ativos sem recibo do mês corrente
  (fonte: receipts, não payments), com link direto para o Portal das Finanças. É o lembrete
  operacional do avô/pai. Aceitação: lista bate certo com o Portal; esconde contratos de
  cadência própria fora do mês devido.

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

## 7. Armadilhas e decisões permanentes (não re-litigar)

- Ótica de família: valores por INTEIRO em toda a apresentação; quotas só para IRS (P2-2).
- Dedupe global de recibos por `receipt_number` composto — protege compropriedade Pai+Tio.
- VPT do CSV do Portal em cêntimos ÷100; "Importância recebida" = cash líquido de retenção.
- Recibos "Anulado" nunca contam; multi-mês divide-se em cêntimos exatos (resto na última).
- PostgREST: máx 1000 linhas por defeito → `.limit()` explícito em payments/receipts.
- Import por SQL Editor > wizard (superuser, idempotente, verificável). Wizard = casos pequenos.
- Payments com `on conflict do nothing` — reimports nunca pisam marcações manuais.
- Node só via pasta Logitech (CLAUDE.md); caminhos com espaços ("OneDrive - ISEG") → aspas.
- `dados/` é gitignored e contém dados pessoais — nunca sair daí.
- Sem commits/push sem pedido explícito do utilizador.

## 8. Como orquestrar modelos económicos neste projeto

- Um item do backlog por agente/sessão; dar-lhe: o item copiado deste ficheiro + CLAUDE.md.
- Exigir sempre: ler os ficheiros na íntegra antes de editar; `npm run build` limpo no fim;
  lista de ficheiros alterados no relatório; PT-PT na UI; primitivas de `ui.tsx` (não inventar
  markup); zero "—"/emoji na UI.
- Mudanças de schema: sempre idempotentes (`create table if not exists`, `alter ... add column
  if not exists`) acrescentadas a `supabase/schema.sql` + coladas no SQL Editor manualmente.
- Rever com `git diff` depois de cada agente (quando houver repo) e só depois avançar.
- Em caso de dúvida de produto: perguntar ao utilizador, não assumir (ele decide rápido).
