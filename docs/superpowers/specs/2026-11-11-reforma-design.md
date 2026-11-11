# Reforma da app · desenho (11/11/2026)

> Roteiro ativo a partir de hoje. Substitui o PLANO_CLAREZA.md como plano de trabalho; o
> conhecimento de domínio (PLANO.md, Apêndices A e B) e as regras do CLAUDE.md continuam válidos.

## 1. Para quem e para quê

- **Miguel (admin, único).** Vive em Lisboa, não emite recibos. Quer saber quem paga e quem não
  paga, e controlar como os recibos são emitidos.
- **Prima e tio (gestores, papel novo).** Emitem os recibos no Portal e estão no terreno. Veem tudo
  menos o Controlo e registam contactos, pagamentos sem recibo e avarias.
- **Resto da família (leitores).** Só veem.

Sucesso: no telemóvel, em menos de 10 segundos, qualquer um responde "quem deve, quanto e desde
quando"; o Miguel responde também "os recibos estão a ser bem emitidos?".

## 2. Decisões tomadas (11/11)

| Tema | Decisão |
|---|---|
| Papéis | `admin`, `gestor` (novo), `viewer` |
| Controlo de emissão | atraso na emissão, anulados e reemitidos, valor diferente da renda, tratamento desigual; só admin |
| Dados do Portal | o Miguel abre sessão no painel de browser; o Claude só lê as páginas e depois escreve a recolha |
| Publicação | ramo `reforma`, commits por fase, pré-visualização; `main` e produção só no fim, com OK |
| Visual | direção C "Sinal" (mockups em claude.ai/artifact/YKWTnwK8Lx9A5CNodrVxk1) |
| Herança | os contratos do avô passam para o NIF da herança com os MESMOS números |
| Cartas | escada de cobrança (3 passos) e renda/contrato (atualização, oposição, acordo de pagamento) |
| Fiscal | calendário de prazos com valores; poupança fiscal por contrato |

Restrição que condiciona tudo: a pré-visualização e o dev usam a base de dados de PRODUÇÃO, onde a
app antiga continua a correr. **Toda a alteração de schema é aditiva e compatível com o código
antigo** (tabelas novas, colunas novas com default, `check` do papel alargado). Um só bloco
idempotente, `supabase/reforma.sql`, também acrescentado ao fim de `supabase/schema.sql`.

## 3. Arquitetura de informação

Cinco destinos, iguais no telemóvel e no computador, e um botão **Registar** flutuante (admin e
gestor) em Início, Rendas e nas fichas.

| Destino | Rota | Responde a | Vem de |
|---|---|---|---|
| **Início** | `/` | Como está o mês e o que há para fazer? | Hoje (encurtado a 2 ecrãs) |
| **Rendas** | `/rendas` | Quem pagou, quem deve, quem vigiar? | Cobranças + inquilinos |
| **Imóveis** | `/imoveis` | O que temos e que problemas tem? | Imóveis + carteira |
| **Finanças** | `/financas` | O que rende, o que se paga ao Estado, quando? | Rentabilidade + Impostos |
| **Mais** | `/mais` | Tudo o resto | menu da conta |

- **Início:** bloco do estado (laranja se há atraso, tinta se está tudo em dia) com o total em
  atraso; duas caixas (pagas, por receber); "Quem deve" (3 maiores); "Sem informação" só enquanto
  existir; "A fazer" (máx. 5, mistura tarefas, prazos fiscais e cartas por enviar); selo "Recibos
  lidos há N dias" (vermelho se a recolha falhou ou passou de 6 dias).
- **Rendas:** todos os inquilinos, um por linha, com filtros em pílulas: Em atraso · Por receber ·
  Pagas · Sem informação · A vigiar. Pesquisa por nome. Cada linha abre a ficha do inquilino.
  O extrato mês a mês continua em `/rendas/extrato` (admin).
- **Ficha do inquilino** (`/inquilinos/[chave]`, o centro da app): estado e valor, tira de 12 meses,
  botões "Pagou" e "Falei com ele", escada de cartas, diário, contratos e factos (renda, início,
  prazo, última atualização, dia em que costuma pagar).
- **Imóveis:** prédios em cartões; filtro "Com problemas". Problemas por fração, de uma só função
  (`portfolio/problemas.ts`): vaga há N meses, renda parada, contrato a terminar, avaria aberta,
  despesa anual em falta (IMI, condomínio ou seguro sem lançamento), prazo desconhecido.
- **Finanças:** separadores Resultado · Impostos · Calendário · Poupança. Mercado, Despesas e
  Projeção ficam dentro de Resultado (os dois últimos, admin).
- **Mais:** Tarefas, Contratos, Documentos, Cartas; para admin: Controlo, Senhorios, Saúde dos
  dados, Administração; Conta e Sair.
- Rotas antigas (`/cobrancas`, `/rentabilidade`, `/impostos`, `/carteira`…) redirecionam em
  `next.config.ts`, como já se faz.

"A vigiar" (`portfolio/inquilinos.ts`, estendido): não deve hoje, mas pagou tarde em 3 dos últimos
6 meses, ou paga em parte, ou pesa mais de 5% da renda da carteira, ou tem promessa de pagamento
por cumprir.

## 4. Papéis e permissões

- `profiles.role in ('admin','gestor','viewer')`; função SQL `is_gestor()` (admin ou gestor).
- **Gestor escreve só por RPC:** `gestao_register_payment`, `gestao_save_event` (diário, com tipo
  `contacto | promessa | carta | nota` e, na promessa, data e valor), casos de manutenção/tarefas.
  Não anula pagamentos, não mexe em contratos, frações, despesas, senhorios, import nem utilizadores.
- Servidor: `requireGestor` ao lado de `requireAdmin` (`lib/actions/util.ts`); cada ação declara
  qual exige. Tudo o que o gestor escreve fica com autor e data (`operation_history` já regista).
- **Controlo é só admin em três camadas:** RLS `select` com `is_admin()` nas tabelas novas de
  observação, `requireAdmin` na página e nas ações, e o item nem aparece no menu dos outros.
  Limite honesto: um gestor continua a poder ler os recibos normais (precisa deles); o que não vê
  são as observações (quando apareceu, anulados, sinais).
- O admin muda papéis em Administração (`setProfileRole` passa a aceitar `gestor`).

## 5. Recolha

### 5.1 Várias contas, herança pronta
- `dados/recolher_recibos.py` passa a percorrer `PF_CONTAS` (ex.: `Pai,Heranca`), com
  `PF_NIF_<CONTA>` e `PF_SENHA_<CONTA>` no `dados/.env`. Sem `PF_CONTAS`, funciona como hoje
  (`PF_NIF`, `PF_SENHA`, `PF_PASTA`). Uma conta que falha não impede as outras; o código de saída
  é diferente de zero se alguma falhou.
- Senhorio novo "Herança de Miguel Ferreira" (rótulo: "Herança do avô"); `FOLDER_TO_LANDLORD`
  ganha `Heranca`. Como os números de contrato se mantêm, os recibos ligam-se sozinhos aos
  contratos e a fonte deixa de estar parada; os meses "sem informação" passam a pagos ou a atraso.
- Plano B (se o Portal der números novos): `/saude/recibos` já associa recibos a contratos.
- **Quando chegar a senha (3 passos, documentados em `dados/README.md`):** criar `dados/Heranca/`
  no HP com o `ListaContratos.xls`; acrescentar as duas linhas ao `.env` e `Heranca` a `PF_CONTAS`;
  correr `recolher_recibos.py --seco` e ler o log. Mais nada.
- Prova sem credenciais: `--autoteste` cobre o ciclo de contas com um descarregador falso, e
  `importar_recibos_automatico.py Heranca --validar` corre com um export de ensaio.

### 5.2 Guardar o que hoje se deita fora
- **Anulados.** Hoje o import ignora `Estado = Anulado`; pior, um recibo importado como emitido e
  anulado depois continua a contar como pago (o import só insere). A recolha passa a marcar
  `receipts.cancelled = true` (a coluna já existe e as leituras já a filtram) e a refrescar os
  agregados do mês (`gestao_refresh_month`).
- **Quando apareceu.** Tabela `receipt_observations`: chave do recibo, contrato, período, Data de
  Rec., valor, retenção, estado, conta, `first_seen` (data da recolha em que apareceu nesse
  estado). Única por (chave, estado). Preenchida para trás com as cópias datadas de
  `dados/_recolhas/` (desde 17/08/2026); antes disso, `first_seen` fica nulo.
- **Estado da recolha.** Tabela `collection_runs` (conta, início, fim, ok, linhas do export,
  recibos novos, anulados novos, erro). Alimenta o selo do Início e um aviso quando falha.

### 5.3 Mais dados do Portal (depende da sessão de exploração)
Com o Miguel autenticado no painel, mapear: detalhe do contrato (datas, prazo, NIF do inquilino,
renovação), detalhe do recibo (data de emissão, quem emitiu), notas de cobrança do IMI. Só entra
no plano o que existir de facto; cada dado novo é um passo opcional do mesmo script, com o mesmo
guarda (formato inesperado = falha com erro, nunca em silêncio).

## 6. Controlo de emissão (admin)

Módulo puro `src/lib/controlo.ts` com `controlo.check.ts`; página `/controlo`.

| Sinal | Como se mede | Limite |
|---|---|---|
| Atraso na emissão | `first_seen` − Data de Rec. (dias), por inquilino e por conta | precisão de 3 a 4 dias (recolhas à segunda e à quinta) |
| Emissão em lote ou retroativa | vários meses do mesmo contrato vistos pela 1.ª vez na mesma recolha; período com mais de 45 dias na data em que apareceu | só desde 17/08/2026 |
| Anulado sem substituto | anulado e nenhum emitido para o mesmo contrato e mês | o mês volta a estar por pagar |
| Anulado e reemitido | par anulado/emitido do mesmo mês, com a diferença de valor | |
| Valor diferente da renda | recibo ≠ renda em vigor nesse mês (mais de 1 €), retenção que aparece e desaparece, meses saltados, soma do mês acima da renda | |
| Datas estranhas | Data de Rec. no futuro ou anterior ao período | |
| Tolerância | meses em atraso sem nenhum contacto no diário; inquilinos que pagam sempre tarde sem carta; comparação pai/tio contra herança | depende de o diário ser usado |

Página: "Novos sinais" (desde a última visita), depois quatro separadores (Emissão, Anulados,
Valores, Tolerância). Cada sinal abre o inquilino. "Visto" e "Justificado" reutilizam
`insight_state`. Não se sabe QUEM emitiu, só de que conta, salvo se o detalhe do recibo o mostrar
(5.3).

## 7. Cartas

Texto em `lib/minutas.ts` (puro, com check), saída em `.docx` pela rota que já existe e uma página
de leitura no telemóvel. Todas são minutas: cada uma diz no rodapé da página (não na carta) a base
legal e "rever com advogado antes de enviar" nas de resolução e oposição.

- **Escada de cobrança**, com o passo certo calculado por `enquadrarMinutas`:
  1. *Lembrete* (1 mês em atraso): tom cordial; versão curta para copiar para mensagem.
  2. *Interpelação* (2 meses, ou 15 dias depois do lembrete): valor, meses, prazo de 8 dias,
     indemnização de 20% (art. 1041.º do Código Civil); registada com aviso de receção.
  3. *Aviso de resolução* (3 meses, art. 1083.º, n.º 3): intenção de resolver e forma legal da
     comunicação (art. 9.º, n.º 7 do NRAU).
- **Acordo de pagamento:** dívida em N prestações somadas à renda corrente, com datas.
- **Atualização de renda** (revista) e **oposição à renovação** (revista, só com prazo conhecido).
- Gerar uma carta escreve no diário "carta gerada"; "enviada a <data>" é um toque do gestor ou admin.

## 8. Fiscal

- **Calendário** (`portfolio/agenda.ts`, estendido): cada prazo tem data, valor, senhorio e
  estado (por fazer, feito). IMI em 1, 2 ou 3 prestações conforme o valor da nota (até 100 €,
  até 500 €, acima), com o valor do ano anterior como estimativa marcada; AIMI; IRS (entrega e
  pagamento); comunicação de contratos novos; cartas de atualização (30 dias antes); renovações e
  oposições (só com prazo conhecido); herança (IRS do ano do óbito, IMI em nome da herança).
  Vista de 12 meses em Finanças; os 3 próximos no Início; o feed `.ics` continua.
- **Poupança** (`irs.ts`, já calcula quase tudo): por contrato, taxa atual, taxa possível pelo
  prazo (art. 72.º), o que falta para a obter e euros por ano; englobamento contra taxa autónoma
  por senhorio; **despesas dedutíveis em falta** (fração com IMI, condomínio ou seguro lançado
  num ano e não no seguinte).
- Fora desta reforma: IRS por herdeiro da herança indivisa (precisa das quotas dos herdeiros).

## 9. Visual: direção C "Sinal"

- **Princípio:** a cor é o estado e ocupa blocos inteiros; os números são a maior coisa do ecrã.
- **Cores (claro):** fundo `#FFFFFF`, blocos neutros `#F3F4F6`, tinta `#14161A` (pago, confirmado),
  laranja `#C2410C` sobre `#FFEDD5` (em atraso), azul `#1E3A8A` sobre `#E0E7FF` (por receber),
  cinza `#4B5563` tracejado (sem informação). Escuro: fundo `#0F1114`, os blocos mantêm a cor.
  Continua a não haver verde de "ok". O ícone da casa com fechadura mantém-se.
- **Tipografia:** Bricolage Grotesque (títulos e números) e DM Sans (texto), via `next/font`.
  Corpo 15 a 16 px; nada abaixo de 12 px; `tabular-nums`.
- **Forma:** blocos `rounded-[20px]`, botões em pílula com 48 px de altura mínima, sem sombras
  fora de overlays, sem gradientes.
- **Telemóvel primeiro:** tudo desenhado a 375 px; uma coluna; alvos de 44 px; `safe-area` em
  cima e em baixo (`viewport-fit=cover`); formulários de registo em folha inferior (`folha.tsx`).
  No computador, a mesma coluna centrada com barra lateral.
- **Implementação:** os tokens semânticos de `globals.css` mantêm os nomes e mudam de valor
  (`perda` passa a laranja, `futuro` a azul); as primitivas de `ui.tsx` e `kit/` são redesenhadas
  uma vez; as páginas novas usam só tokens. O movimento existente fica.
- Diferença para o mockup: a navegação fica com 5 destinos e o Registar é um botão flutuante
  (no mockup estava ao centro da barra e tirava as Finanças do primeiro nível).

## 10. Schema (`supabase/reforma.sql`, aditivo)

1. `profiles.role`: `check` alargado a `gestor`; `is_gestor()`.
2. `collection_runs`; leitura para autenticados, escrita só pela ligação da recolha.
3. `receipt_observations`; leitura só `is_admin()`.
4. `management_events`: `kind` e, para promessas, `promised_date` e `promised_amount`.
5. RPCs de registo abertas a `is_gestor()`; anulação e resto continuam `is_admin()`.
6. Senhorio da herança (insert idempotente por nome).
7. GRANTs das tabelas novas (sem eles, 42501).

Aplicação: o Miguel cola o bloco no SQL Editor (regra do CLAUDE.md) antes da fase que o usa.

## 11. Como se constrói: sistema de agentes

- **Orquestrador (Claude Fable):** desenho, plano, cadernos de tarefa, portas de fase, verificação
  final no browser. Não escreve código de rotina.
- **Construtores:** `codex exec` para lógica pura com checks, Python da recolha e SQL; agentes
  Sonnet para páginas e componentes; Haiku para inventários e documentação.
- **Caderno de tarefa** (`docs/reforma/tarefas/NN-nome.md`): objetivo, ficheiros que pode tocar
  (propriedade exclusiva), assinaturas e tipos a respeitar, critérios de aceitação executáveis, o
  que não fazer. É autocontido, para o agente barato não redescobrir o repositório.
- **Portas, por ordem (o orquestrador só é chamado na 3):**
  1. *Autoverificação:* o construtor corre `npm run check` e `tsc` até ficar verde (máx. 3).
  2. *Revisão cruzada entre modelos:* código do Codex é revisto por um agente Claude; código de
     Claude é revisto por `codex exec review`. Veredicto `APROVADO` ou `CORRIGIR` com lista; o
     construtor corrige; máx. 2 voltas. Só sobe ao orquestrador se continuar `CORRIGIR`.
  3. *Porta de fase:* build limpo (dev parado, `.next` apagada), check, percurso no browser a
     375 px com sessão real (só leitura), commit no ramo `reforma`.
  4. *Porta final:* revisão de segurança (RLS e ações), acessibilidade, e o teste das perguntas
     do §13.
- **Economia:** cada agente devolve no máximo 200 palavras; tarefas em paralelo só com ficheiros
  disjuntos; nenhum agente lê dados pessoais de `dados/`.

## 12. Fases

| # | Fase | Entrega | Depende do Miguel |
|---|---|---|---|
| 0 | Fundações | ramo, `reforma.sql`, papel gestor no servidor, recolha multi-conta com anulados, observações e estado; herança pronta | colar o SQL |
| 1 | Sistema visual C | tokens, tipografia, `ui.tsx`, `kit/`, navegação nova, botão Registar | |
| 2 | Rendas | Início, Rendas, ficha do inquilino, diário, registar (gestor) | |
| 3 | Imóveis | lista com problemas, fichas simplificadas | |
| 4 | Cartas | escada de cobrança, acordo, revisões, página de leitura | |
| 5 | Finanças | 4 separadores, calendário com valores, poupança | |
| 6 | Controlo | módulo, página, sinais | |
| 7 | Portal | dados extra na recolha | abrir sessão no painel |
| 8 | Acabamento | porta final, limpeza de rotas e código morto, CLAUDE.md e README atualizados | ver a pré-visualização e dar o OK para produção |

Cada fase fecha com a porta 3 e um commit. As fases 3 a 6 tocam em ficheiros disjuntos e podem
correr em paralelo depois da 2.

## 13. Como saber que ficou bem

No telemóvel, sem ajuda, em menos de 30 segundos cada:
1. Quem nos deve dinheiro, quanto e desde quando? (todos)
2. O inquilino X está em dia? O que já lhe foi dito? (todos)
3. Registar que o inquilino X pagou em dinheiro. (gestor)
4. Que carta sai a seguir para o inquilino X? (gestor)
5. Que imóveis têm problemas e quais? (todos)
6. O que vence este mês para o Estado, e quanto? (todos)
7. Que recibos foram emitidos tarde ou anulados este mês? (só admin)
8. Os recibos já foram lidos esta semana? (todos)

## 14. Fora de âmbito

- Integração bancária e leitura de extratos.
- Notificações por e-mail ou push (exigem um serviço novo); fica o calendário `.ics`.
- IRS por herdeiro; previsões estatísticas de pagamento.
- Emitir recibos a partir da app.
