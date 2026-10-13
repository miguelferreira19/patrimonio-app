# Plano de clareza · outubro de 2026

> Escrito a 13/10/2026, a partir de uma leitura do código e de uma visita autenticada a
> produção (sessão de administrador, só leitura). Substitui, como roteiro ativo, os planos
> anteriores (PLANO.md §0, REDESENHO.md, AUDITORIA_UX.md, IMPLEMENTACAO_GESTAO.md). O
> conhecimento de domínio do PLANO.md (Apêndices A e B) continua válido.

## 0. Em cinco linhas

1. **A app tem a informação, mas esconde-a.** Os números certos existem (`arrears.ts`, `irs.ts`,
   `calc.ts`). O que falha é o vocabulário, a ordem das páginas e a quantidade de filtros.
2. **A V5 partiu a leitura dos atrasos.** Trouxe a regra "um recibo não confirma o pagamento" e uma
   segunda máquina de estados. Como ninguém regista pagamentos à mão (0 entre jan 2025 e out 2026),
   as 42 rendas do mês aparecem "Pagamento por confirmar" e a dívida "verificada" é sempre 0 €.
3. **Os devedores estão calculados, mas não há uma lista deles.** 10 277 € em 11 contratos, com
   9 nomes diferentes em 5 sítios. A página Cobranças, por defeito, nem os mostra. *(Corrigido na
   Fase 1: o valor certo é 7 162 € em 6 contratos. Os 10 277 € incluíam outubro, contado como
   atraso a partir do dia 9, antes da recolha dos recibos.)*
4. **A rentabilidade por imóvel não existe como vista.** As despesas que lhe serviriam de base estão
   distorcidas: obras pontuais projetadas como recorrentes, e uma dupla contagem no IMI.
5. **O maior problema da carteira não é de software.** Os 21 contratos do avô estão sem recibos
   desde julho, cerca de 6 845 €/mês. A app trata isto como uma nota de rodapé, e ninguém está a
   registar o que entra.

---

## 1. Diagnóstico, com evidência

### 1.1 "Não consigo perceber o que está em atraso"

A mesma dívida aparece assim, consoante a página:

| Página | O que mostra | Problema |
|---|---|---|
| Hoje | "Saldo inferido de meses anteriores · 11 contratos · 10 277 €"; cartão "Verificar saldo de 11 contratos… perde-se perto de 1 924 €" | Três números para a mesma pergunta (dívida, perda esperada, valor por confirmar) |
| Imóveis | Indicador "Saldo inferido a verificar"; cartões "Saldos a verificar" | Nunca diz "em atraso" |
| Cobranças | "Saldo vencido verificado 0,00 €"; as 42 linhas "Pagamento por confirmar", incluindo as que têm recibo emitido | Período por defeito = mês corrente: **a dívida dos meses anteriores não aparece**. Alberto Sampaio surge com 438 € "por verificar" quando deve 2 628 € |
| Ficha da fração (Alberto Sampaio) | "Registos do ano 1 752 € líquido registado" | Não diz que há 6 meses em dívida |
| Ficha do inquilino (AMIN) | "Saldo inferido a verificar 2 628 €" + "Crítico" + "Estimativa de registo mensal 96%" | Crítico e 96% lado a lado contradizem-se para quem lê |
| Carteira | "1 mês · 550 € em falta" | Mais um nome |

Para a mesma coisa há 9 termos: *em atraso, em dívida, em falta, saldo inferido, saldo a
verificar, saldo vencido verificado, por liquidar, por verificar, perda esperada*.

**Causas de fundo**

- **Duas verdades para o estado de um mês.** `monthStatement` (`lib/gestao.ts`, V5) tem 7 estados
  e corre ao lado de `monthCellStatus` (`lib/monthcell.ts`), que tem 5. Junta-se a gravidade de
  `arrears.ts`, com mais 5. Isto quebra a regra "Estado de um mês: uma só verdade" do CLAUDE.md, a
  mesma que tinha resolvido o bug B2.
- **Uma premissa que ninguém alimenta.** "Recibo ≠ pagamento" só funciona se alguém confirmar cada
  renda com o extrato bancário. Em produção: 0 períodos confirmados, 0 tarefas, 0 manutenções,
  0 vagas registadas. Nesta família, quem emite o recibo eletrónico é o senhorio, quando recebe.
  Recibo emitido = renda recebida. A exceção (dinheiro sem recibo) é que se regista à mão.
- **Uma pergunta errada.** Cobranças responde a "o que se passou com o contrato X no mês Y".
  A família pergunta "quem nos deve, quanto e desde quando".
- **Os pagamentos manuais não reduzem a dívida.** `arrears.ts` só lê a tabela `payments`, que vem
  do import. Os movimentos da V5 (`payment_movements`/`allocations`) ficam numa tabela à parte, por
  isso um pagamento registado à mão não tira o inquilino da lista de atrasos.

### 1.2 "Quais são os principais devedores"

O cálculo existe (`emAtrasoDaCarteira`). A 13/10 a lista era esta, mas só aparece por extenso num
parágrafo do Hoje ("Maiores: …, e outros 8") e espalhada pelos cartões de Imóveis:

| Inquilino / imóvel | Em atraso | Nota |
|---|---|---|
| AMIN, Unipessoal Lda · Alberto Sampaio | 2 628 € | 6 meses seguidos; último mês pago abr 2026. É também **o maior inquilino** (3 contratos, 1 100 €/mês, 6% da renda); os outros dois contratos estão na herança, sem informação desde julho |
| Casa Toneca | 1 770 € | |
| Rua Azeredo Perdigão, 68 (prédio) | 1 651 € | dos quais R/c Dto. 1 340 € |
| Rua Nova da Esculca, 54 | 1 554 € | |
| Rua de S. Pedro, 39 | 1 125 € | |
| Repeses 4 novo | 550 € | |
| Capitão Homem Ribeiro | 500 € | |
| Av. António José de Almeida, 254 | 311 € | |
| Loja Av. Nova | 188 € | |
| **Total** | **10 277 €** | Os 3 maiores somam 5 738 € (56%) |

Não há nenhuma página que ordene isto por inquilino, com os meses em falta, a última diligência e
a ação seguinte.

### 1.3 "Não consigo perceber quais os mais rentáveis"

- **Não há uma vista de rentabilidade.** O yield aparece só dentro de cada ficha ("Yield bruto
  2,9%") e no Mercado, onde só 21 das 53 frações têm valor estimado.
- **Os conselhos misturam património com rendimento.** "Rever a venda de AJA 254 · 5.º Dto.
  207 350 €" (valor de venda) aparece à frente de "Atualizar 36 rendas · 3 103 €" (renda por ano).
  "Capacidade de investimento 199 150 €" é o resultado projetado a 24 meses com outro nome.
- **As despesas estão distorcidas:**
  - Despesas de 2025 mostradas: **80 843 €** "imóvel por inteiro". O Anexo F declarado soma
    **45 524 €** (108 linhas). A diferença vem da reconstrução pela quota, que é legítima quando um
    co-titular (o tio Ilídio) não declara aqui. Mas **há dupla contagem confirmada**: 23 pares
    (artigo, categoria), quase todos IMI, foram declarados pelo avô e pela avó com o mesmo valor, e
    cada um é reconstruído para 100% do imóvel.
  - Há também **duas regras para a mesma despesa**: `scopedExpense` (V5, `gestao.ts`) reconstrói
    pela quota, enquanto `expenseTotalsByProperty` (`irs.ts`) é, segundo o CLAUDE.md, a única regra.
  - 26 587 € de conservação do avô em 2025, ou seja obras pontuais. A projeção usa "a média dos
    últimos 12 meses" durante 24 meses (161 686 € de despesas), por isso o resultado projetado e a
    "capacidade de investimento" estão subestimados.
- **A taxa autónoma está por confirmar.** `irs.ts:68` usa `AUTONOMOUS_RATE = 0.28`, mas as taxas
  reduzidas da mesma página (15/10/5%) já são as do Mais Habitação (Lei 56/2023). Se não me engano,
  esse diploma também baixou a taxa autónoma das rendas para 25%. A confirmar com o contabilista ou
  a AT. Se for o caso, a comparação "englobamento vs autónoma" (António: poupa 2 232 €) e o ganho
  do art. 72.º estão sobrestimados.

### 1.4 Navegação e apresentação

- **9 entradas na barra lateral**, mais o separador "Gestão" no telemóvel, o menu de admin e 4
  botões no cabeçalho de Imóveis (Consulta operacional, Disponibilidade, Histórico mensal, Mercado).
  Três entradas (Tarefas, Manutenção, Disponibilidade) estão vazias. Despesas e Relatórios usam o
  mesmo ícone.
- **Os filtros vêm antes do conteúdo.** Imóveis, Cobranças, Despesas e Análise abrem com o
  formulário "Âmbito dos valores / Proprietário". No telemóvel, o primeiro ecrã de Imóveis tem só
  botões e esse formulário.
- **O "âmbito" contradiz a regra fundadora** do CLAUDE.md: valores por inteiro, quotas só no IRS.
- **Há ruído repetido.** "Imóvel por inteiro" em cada um dos 30 cartões; "€/mês · ilíquida" e
  "Inferido de recibos · líquido" em cada linha.
- **Há dados por formatar.** Nomes em maiúsculas (Cobranças, Contratos, Análise); meses escritos
  "2026-10"; o seletor de frações do IRS mostra "RCFESQ" e "181710-U-2783-K".
- **Há números que não batem.** "Atualizar 39 rendas · 3 561 €/ano" no Hoje e "Atualizar 36
  rendas · 3 103 €" na Análise, para a mesma oportunidade. Na Carteira, a ocupação muda de
  denominador com a lente (42/53 em Cobrança, 19/30 em Vazios).
- **A manchete de Hoje nem sempre ajuda.** A 13/10 diz "Faltam 10 rendas de outubro" e pede para
  "Emitir 10 recibos", antes da recolha do dia 15. O que importa de facto (atrasos e herança) está
  mais abaixo.
- **"Miguel" é o avô.** O utilizador também se chama Miguel. "Recibos de Miguel parados" lê-se mal.

### 1.5 Processo e código

- **5 redesenhos em 12 semanas** (V1 em julho, V5 a 9 de outubro). Cada um acrescentou superfícies
  sem retirar as antigas: `masthead.tsx`, `nav.tsx`, `/carteira`, `/dinheiro`, `/analise`,
  `/mercado`, `/ano`, mais 10 páginas que só fazem redirect.
- **A V5 está em produção mas não está no git.** São 47 ficheiros modificados e cerca de 25 caminhos
  novos por commitar. Produção está à frente do GitHub, o que viola a regra de deploy do CLAUDE.md.
  Um disco perdido é uma V5 perdida.
- **O código da V5 está escrito em linhas únicas** de 1 a 2 mil caracteres
  (`cobrancas/[id]/page.tsx`, `contratos/page.tsx`, `despesas/page.tsx`, `gestao/[id]/page.tsx`,
  `components/gestao/*`). Não se consegue rever e não segue o estilo do resto do repo.
- **Há 13 documentos na raiz** (3 076 linhas) e um CLAUDE.md de 340 linhas com camadas de história
  ("esta secção prevalece sobre…").

---

## 2. A carteira: problemas e oportunidades

### 2.1 Problemas, por urgência

1. **Herança do avô.** 21 contratos (o guia da sucessão fala em 22), cerca de 6 845 €/mês, sem
   recibo depois de 02/07/2026. São perto de 20 800 € de rendas de agosto a outubro sem
   documento. O guia (`dados/sucessao`, §5.4) diz para registar o que entra, por inquilino e por
   mês, e emitir os recibos mais tarde com efeito retroativo. Na app ninguém o está a fazer.
   **Prazo próximo: Modelo 1 do Imposto do Selo até 31/10/2026** (prorrogável até 30/12 se for
   pedido). Este prazo não está na agenda da app.
2. **Dívida.** 10 277 € em 11 contratos, concentrada em 3 inquilinos (56%). O maior devedor é
   também o maior inquilino.
3. **Frações vazias.** 11 de 53 sem contrato. Muitas são garagens ou arrecadações; as habitações
   que pesam são Paulo Emilio (vaga desde nov 2025, antes rendia 438 €/mês), Satão (desde set 2020,
   já 23 658 € de renda perdida pela conta da app), Capitão Silva Pereira (desde jul 2026),
   R. Azeredo Perdigão 7 B e Rua do Regato. **A app não tem nenhum alerta de vazios** no Hoje nem
   nas oportunidades: o gerador não existe em `insights.ts`.
4. **Contrato fantasma.** Lote 2e (330 €/mês) está sem recibos há 14 meses. Enquanto estiver
   "ativo", infla o esperado e a cobrança.
5. **Rendas paradas.** 36 a 39 rendas não são atualizadas há mais de 2 anos. Alberto Sampaio está
   nos 438 € desde 2019.
6. **Dados.** 62 recibos sem contrato; 42 inquilinos sem NIF (a concentração agrupa pelo nome);
   42 contratos com prazo desconhecido, por isso a agenda não avisa renovações nem oposições;
   3 quotas por fechar; o "Terreno 401" aparece na lista de frações por arrendar.

### 2.2 Oportunidades, com números honestos

| Oportunidade | Valor | Esforço | Nota |
|---|---|---|---|
| Taxa reduzida do art. 72.º (contratos longos) | ~6 773 €/ano | Baixo: comunicar à AT | Confirmar elegibilidade contrato a contrato; o valor depende da taxa base (§1.3) |
| Englobamento vs taxa autónoma | António: ~2 232 € em 2026 | Baixo: uma escolha no Anexo F | Por senhorio e por ano; depende da taxa base (§1.3) |
| Atualização pelo coeficiente | ~3 561 €/ano (39 rendas) | Médio: 39 cartas, 30 dias antes | As cartas já existem (`minutas.ts`) |
| Arrendar os vazios | vários milhares €/ano | Alto: obras, anúncio, visitas | Começar pelas habitações; renda alvo a partir do Mercado |
| Renda abaixo do mercado | 46 833 €/ano "se tudo fosse à mediana" | n/a | **Não se realiza em contratos em curso** (a própria app avisa em letra pequena). Só conta na mudança de inquilino. Sai dos totais |
| Vender ou manter | n/a | Decisão de família | T3/T4 grandes a 2,4–2,9 €/m², com yield de 1,8 a 2,9% sobre o valor estimado. A app deve mostrar a comparação, não "rever a venda 207 350 €" |

---

## 3. Princípios (todas as fases cumprem)

1. **Uma pergunta, um número, um nome.** O mesmo valor tem o mesmo nome em todas as páginas.
2. **Recibo emitido = renda recebida.** O registo manual serve só exceções: a herança, dinheiro
   sem recibo, pagamentos parciais acordados. Quando existe, substitui o recibo do mesmo mês; nunca
   se somam.
3. **Valores por inteiro** (o "bolo"). Quotas só em Impostos e Senhorios.
4. **Primeiro a resposta, depois os filtros.** Os filtros ficam recolhidos e guardados no URL.
5. **Cada número abre a lista que o compõe.**
6. **Nenhuma entrada de menu vazia.**
7. **Não há V6 visual.** O sistema "banca calma" fica. Este plano muda informação e fluxo, não estética.
8. **Estimativas nunca se somam a medições.**
9. **Visual antes de prosa** (pedido do utilizador, 13/10): caixas, barras, tiras de meses e
   etiquetas. Frases explicativas só dentro de "Detalhes", nunca na face da página.

### Glossário único (o que a família vê)

| Estado | Quando | Tom |
|---|---|---|
| **Pago** | Recibo emitido (≥ 90% da renda de referência, `isMonthSettled`) ou pagamento registado | tinta |
| **Em atraso** | Mês vencido (a partir do dia 8, `GRACE_DAYS`), de uma fonte ativa, sem recibo nem pagamento. Parcial = em atraso pelo que falta | âmbar; vermelho a partir de 3 meses |
| **Por receber** | Mês corrente, ainda dentro do prazo | ardósia |
| **Sem informação** | A fonte está parada (herança) ou os recibos estão por importar | ardósia tracejado |

"Ritmo próprio", "perda esperada" e "confiança" passam a detalhe de administrador.

---

## 4. Arquitetura proposta: 5 destinos

Os mesmos 5 no computador e no telemóvel (cabem exatamente na barra de baixo).

| Destino | Responde a | Absorve |
|---|---|---|
| **Hoje** | O que se passa e o que tenho de fazer? | Hoje, Tarefas, agenda de prazos |
| **Cobranças** | Quem deve, quanto, desde quando? | Cobranças, Atrasos, `inquilinos/[chave]`, extrato mensal |
| **Imóveis** | O que temos e em que estado está? | Imóveis, Carteira (histórico), Contratos, documentos da fração, Vagas e Manutenção (na ficha) |
| **Rentabilidade** | O que rende, o que custa, quanto vale? | Análise, Mercado, Despesas, Oportunidades |
| **Impostos** | Quanto pagamos e o que se declara? | IRS/Ano, Anexo F, AIMI, prazos fiscais, Senhorios |

O menu da conta (admin) fica com Verificar dados, Senhorios, Documentos gerais, Importar e
Utilizadores. A ficha da fração passa a ter os separadores Resumo, Pagamentos, Contrato, Custos,
Documentos e Tarefas.

---

## 5. Fases

Tamanhos: **P** ≈ 1 sessão, **M** ≈ 2, **G** ≈ 3–4. Cada fase termina com build + check verdes,
deploy, commit e push (regra do CLAUDE.md), e com o critério de aceitação verificado em
produção, autenticado.

### Fase 0 · Pôr a casa em ordem (P) · FEITA a 13/10

> Commits `a9525ef` (V5 tal como estava em produção) e `2bc6b80` (este plano).

- **0.1** Commitar a V5 tal como está em produção (`git add -A`, commit, push). É a base de
  reversão de tudo o que vem a seguir. *Precisa do teu OK.*
- **0.2** Registar a baseline de 13/10 (números deste documento) como valores de referência para
  os critérios de aceitação.
- **0.3** Congelar: nenhuma página nova fora deste plano.

**Aceitação:** `git status` limpo, e o GitHub igual a produção.

### Fase 1 · Atrasos e devedores (G). Resolve a queixa n.º 1 · FEITA a 13/10

> **Resultado.** Em atraso: 7 162 € em 6 contratos (eram 10 277 € em 11). O mesmo valor no Hoje,
> na Cobranças, em Imóveis, na ficha da fração e na do inquilino. Para além do previsto:
> - **O mês corrente nunca é atraso** (`lastDueMonthKey` passou a ser sempre o mês anterior; caso B5
>   no `arrears.check.ts`). A carência de 8 dias fazia de outubro uma dívida a 13/10: 5 dos 11
>   contratos eram só o recibo de outubro por emitir, contado também como "por receber".
> - O contrato fantasma (lote 2e) saiu do "por receber" e dos "recibos por emitir".
> - Cobranças em formato visual: 3 caixas, uma barra por devedor e uma tira dos últimos 12 meses.
>   Prosa do Hoje (cartões e prazos) recolhida em "Detalhes".
> - Ficha da fração: faixa "Em atraso" no topo; corrigido o transbordo horizontal da grelha.
>
> **Ficou por fazer:** a ficha da fração ainda lê os pagamentos sem os registos manuais (há 0
> registos hoje); passa a ler pelo snapshot na Fase 7.

- **1.1 Um só estado de mês.** Uma função em `monthcell.ts` devolve o estado do glossário
  (Pago / Em atraso / Por receber / Sem informação). `monthStatement` (`gestao.ts`) passa a
  chamá-la e só acrescenta a substituição pelo movimento manual. Os 7 `PaymentState` reduzem-se.
- **1.2 Recibo = pago.** "Pagamento por confirmar" desaparece dos meses com recibo.
- **1.3 Pagamentos manuais entram na dívida.** No `load.ts`/`snapshot.ts`, antes de
  `computeArrears`, as alocações dos movimentos substituem os `payments` do mesmo contrato-mês
  (mesma regra da V5: o confirmado substitui, nunca soma).
- **1.4 Lista de devedores.** `devedores(snap)`, puro, em `portfolio/`, agrupa
  `emAtrasoDaCarteira` por inquilino (a chave já existe, `chaveDoInquilino`). Devolve inquilino,
  contratos, frações, meses em falta, valor, desde quando, último mês pago e última diligência.
- **1.5 Nova página Cobranças**, sem filtros à cabeça:
  1. **Em atraso:** total + tabela por inquilino, ordenada por valor; cada linha abre os meses.
     Ações: registar contacto (`management_cases` da V5), carta de interpelação (`minutas.ts`),
     "pagou sem recibo" (formulário de pagamento da V5).
  2. **Sem informação:** a herança (n contratos, renda/mês, desde quando), com ligação à Fase 2.
  3. **Este mês:** por receber, em lista curta.
  4. A tabela mês a mês da V5 passa a "Extrato" (admin), em `/cobrancas/extrato`.
- **1.6 O mesmo número em todo o lado.** Hoje, Imóveis, ficha e inquilino passam a dizer
  "Em atraso" com o valor de `emAtrasoDaCarteira`, e cada um liga à Cobranças. Saem "saldo
  inferido", "saldo a verificar", "em falta" e "por liquidar". Na ficha da fração entra uma faixa
  no topo: "Em atraso: 2 628 € · 6 meses (mai–out)".
- **1.7 Checks** nos `*.check.ts` respetivos: recibo → pago; mês vencido sem recibo de fonte ativa
  → em atraso; fonte parada → sem informação; mês corrente → por receber; movimento manual num mês
  sem recibo → pago e fora da dívida; recibo posterior ao movimento → não soma.

**Aceitação:** a partir do Hoje, 1 clique responde "quem deve e quanto". O total é igual em Hoje,
Cobranças, Imóveis e nas fichas (baseline: 10 277 € / 11 contratos, se ninguém pagar entretanto).
Nenhum mês com recibo diz "por confirmar".

### Fase 2 · Herança do avô (P). Revista a 13/10

**Mudou com a tua resposta:** a herança já tem NIF; falta o código de acesso ao Portal. Os recibos
em falta vão ser emitidos com efeito retroativo pela pessoa que já emite os do António e do Ilídio,
e não há extratos. O mapa manual de recebimentos (2.2 e 2.3 da versão anterior) deixa de ser
preciso: os recibos retroativos entram pela recolha automática e os meses "sem informação" passam
a pagos sozinhos.

Quando chegar o código do Portal:
- **2.1 Recolha:** criar a pasta da herança em `dados/` e as credenciais em `dados/.env` (ação tua);
  validar com `python scripts/importar_recibos_automatico.py <Pasta> --validar` antes de gravar.
- **2.2 Associar contratos:** se o Portal der números de contrato novos à herança, os recibos
  entram sem contrato. Associá-los em `/saude/recibos` (já existe, com pré-visualização).
- **2.3 Nome a mostrar:** a fonte aparece como "Miguel"; passar a "Herança de Miguel" (rótulo de
  apresentação, sem mexer no nome que o import usa).
- **2.4 Check:** recibo retroativo de um mês "sem informação" → pago; nada duplica.

**Aceitação:** depois da primeira recolha da herança, "Sem informação" baixa de 21 contratos para
zero e qualquer atraso real desses inquilinos aparece na Cobranças.

### Fase 3 · Rentabilidade (G). Resolve a queixa n.º 3

- **3.1 Uma só regra para despesas por inteiro.** Por (artigo, categoria, ano): total = soma do
  declarado ÷ soma das quotas de quem declarou. Fica num só sítio (`irs.ts`), e `scopedExpense`
  passa a chamá-la ou desaparece. Check com o caso avô + avó a declarar o mesmo IMI.
- **3.2 Separar custos recorrentes de obras.** Recorrentes: IMI, condomínio, seguro. Obras e
  conservação contam como investimento, com média de 3 anos. A projeção (`futuro.ts`) deixa de
  repetir obras pontuais.
- **3.3 `portfolio/rentabilidade.ts`**, puro e com check, por fração e por prédio, nos 12 meses
  fechados ou por ano civil:
  renda recebida (ilíquida, dos recibos) · taxa de cobrança (recebido ÷ esperado) · meses vagos ·
  custos recorrentes · obras (média de 3 anos) · **resultado antes de IRS** · yield sobre o VPT
  (todas as frações têm VPT) · yield sobre o valor estimado (só onde existe, marcado como
  estimativa) · €/m² contra a mediana.
- **3.4 Página Rentabilidade:** tabela ordenável, os 5 melhores e os 5 piores, e um gráfico de
  barras do resultado por prédio (`recharts`, já instalado). Mercado e projeção ficam como secções
  recolhidas. Sem "âmbito".
- **3.5 Conselhos limpos.** Saem da lista ordenada por euros "candidato a venda" e "capacidade de
  investimento". "Vender ou manter" passa a ser uma coluna com critério explícito (yield abaixo de
  X% sobre o valor estimado e vaga ou com fim previsto).
- **3.6 Taxa autónoma.** Confirmar 28% vs 25% (§1.3); se mudar, corrigir `AUTONOMOUS_RATE` por ano
  fiscal, com caso no `irs.check.ts`.

**Aceitação:** um ecrã responde "quais os 5 imóveis que mais e menos rendem". A soma das linhas
é igual ao total. As despesas de 2025 reconciliam com os 45 524 € do Anexo F mais as
reconstruções, cada uma identificada.

### Fase 4 · Oportunidades honestas (P/M)

- **4.1 Gerador de vazios** em `insights.ts`, a partir de `vacancyGaps` (`calc.ts`). Mostra o
  valor pela última renda ou, sem ela, pela mediana × área, marcado como estimativa.
- **4.2 Uma só lista de Oportunidades** (em Rentabilidade, com as 3 primeiras no Hoje): art. 72.º,
  englobamento, coeficiente e vazios. Cada uma com €/ano, medido ou estimado, esforço, próximo passo
  e ligação.
- **4.3 Renda abaixo do mercado** passa a "potencial na próxima mudança de inquilino", fora dos
  totais.
- **4.4 Um número por oportunidade.** O 39 rendas / 3 561 € do Hoje e o 36 rendas / 3 103 € da
  Análise passam a vir de uma única função.

**Aceitação:** a soma das oportunidades só inclui valores medidos ou realizáveis; os vazios
aparecem com nome e há quanto tempo estão vagos.

### Fase 5 · Navegação e acabamento (M)

- **5.1** `shell.tsx`: os 5 destinos (§4), iguais no telemóvel. Os redirects das rotas antigas
  passam todos para um único sítio, `next.config.ts`, em vez de 10 ficheiros de página.
- **5.2** Tarefas, Manutenção e Vagas viram **uma** lista de Tarefas, com o tipo como etiqueta. O
  "Para fazer" do Hoje junta as tarefas automáticas (`insights.ts`) e as manuais.
- **5.3** O "âmbito dos valores" sai de Imóveis, Cobranças, Despesas, Análise e Mercado. O filtro
  de proprietário fica só em Impostos e Senhorios.
- **5.4** Os filtros vão para depois da resposta, recolhidos. No telemóvel, o primeiro ecrã de cada
  destino mostra a resposta.
- **5.5** Formatação: `nomeProprio` em todos os nomes de inquilinos; `monthLabel` em vez de
  "2026-10"; `nomeDaFracao` no seletor do IRS; sai o "Imóvel por inteiro" repetido; rótulo dos
  senhorios (2.1).
- **5.6** Manchete de Hoje: até ao dia 15, o destaque é "Em atraso" e "Sem informação". O mês
  corrente passa a "a decorrer".
- **5.7** Os indicadores da Carteira deixam de mudar de denominador com a lente.

**Aceitação:** teste com um familiar que não é administrador (§8).

### Fase 6 · Dados (contínua, quase toda ação tua; a app ajuda)

| Tarefa | Quem | Onde |
|---|---|---|
| 62 recibos sem contrato | tu | `/saude/recibos` (já existe) |
| Lote 2e: confirmar se cessou | tu | ficha → Terminar contrato |
| NIF dos 42 inquilinos | app primeiro | verificar se o `ListaContratos.xls` do Portal traz o NIF; se trouxer, o import preenche-o |
| Prazos dos 42 contratos | tu | `TermsForm`, começando pelas 10 maiores rendas |
| 3 quotas por fechar | tu | ficha → titularidade |
| "Terreno 401" na ocupação | app | rever a classificação em `currentProperties` |

### Fase 7 · Limpeza técnica e documentação (M), depois das fases 1 a 5

- Apagar o que ficou para "voltar atrás": `nav.tsx`, `masthead.tsx`, páginas absorvidas, o
  vocabulário morto de `PaymentState` e, se for substituído, `scopedExpense`.
- Reescrever o código da V5 no estilo do repo: JSX em várias linhas, funções com menos de 50
  linhas, ficheiros com menos de 400. Partir `forms.tsx` (730 linhas) por entidade.
- **CLAUDE.md com até 150 linhas**, só sobre o estado atual. Os documentos históricos (V3,
  REDESENHO, AUDITORIA_UX, PLANO_REMODELACAO, RELATORIO_FINAL, IMPLEMENTACAO_GESTAO, ANALISE)
  vão para `docs/historico/`. Os apêndices A e B do PLANO.md passam a `docs/dominio.md`.

---

## 6. Ordem recomendada

| # | Fase | Resolve | Tamanho | Risco | Depende de |
|---|---|---|---|---|---|
| 1 | 0 · Casa em ordem | reversão segura | P | nulo | o teu OK para o commit |
| 2 | 1 · Atrasos e devedores | queixas 1 e 2 | G | médio (toca no `arrears`) | 0 |
| 3 | 2 · Herança | o maior buraco de informação | M | baixo (aditivo) | 1.1, 1.3 |
| 4 | 3 · Rentabilidade | queixa 3 | G | médio (toca no `irs.ts`) | 0 |
| 5 | 4 · Oportunidades | "problemas e oportunidades" | P/M | baixo | 3 |
| 6 | 5 · Navegação | "está tudo confuso" | M | baixo | 1, 3 |
| 7 | 7 · Limpeza | manutenção futura | M | baixo | 1–5 |
| contínua | 6 · Dados | qualidade dos números | n/a | n/a | n/a |

Estado a 13/10: Fases 0 e 1 feitas. A Fase 2 espera o código do Portal da herança. A seguir:
Fase 3 (rentabilidade).

## 7. Decisões (respondidas a 13/10)

1. Recibo = pago por defeito: **sim**.
2. 5 destinos: **sim**.
3. Familiares sem administração veem devedores: **sim**.
4. Recebimentos da herança: quem emite os recibos do António e do Ilídio; **sem extratos**; a herança
   já tem NIF, falta o código do Portal para emitir os recibos em falta (ver Fase 2 revista).
5. Commit da V5: **sim** (feito).
6. Tirar o "âmbito" das páginas da família: **sim** (Fase 5).

## 8. Como saber que ficou melhor

Um familiar que não é administrador responde a cada pergunta em menos de 30 segundos, sem ajuda:

1. Quem nos deve dinheiro, e quanto?
2. O inquilino X está em dia?
3. Quanto entrou este ano?
4. Quais os 3 imóveis que mais rendem e os 3 que menos rendem?
5. Que imóveis estão vazios, e há quanto tempo?
6. O que temos de fazer este mês?

## 9. O que fica de fora, de propósito

- **Nova direção visual:** a estética não é o problema.
- **Integração bancária automática:** é caro e frágil para 42 contratos; o recibo já é a prova.
- **Previsões com modelos e probabilidades de pagamento para a família:** ficam como detalhe de
  admin.
- **Mais páginas de gestão** (diligências, fornecedores…) enquanto as que existem estiverem vazias.
