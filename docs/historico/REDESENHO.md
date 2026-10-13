# REDESENHO.md: plano da remodelação de experiência e visual (V4)

Versão 1.1 · 9/10/2026. **Estado: F0 a F8 feitas** (direção A escolhida pelo utilizador), ver §11.

Versão 1.0 · 9/10/2026. Base: auditoria de todas as superfícies em produção (computador e
telemóvel, sessão de admin, dados reais), estudo de 9 sistemas de referência no
styles.refero.design, e o protótipo navegável em
[`docs/redesenho/prototipo.html`](docs/redesenho/prototipo.html), que se abre com duplo clique.

O protótipo mostra os três ecrãs principais (Hoje, Imóveis, Ficha) em computador e telemóvel. Um
seletor no topo alterna entre as três direções visuais: é com ele que se escolhe a direção antes
de tocar em código. Os dados do protótipo são **fictícios** de propósito, porque o ficheiro vai
para o GitHub.

---

## 0. Diagnóstico, numa frase

A app sabe muito, mas apresenta tudo com o mesmo peso, pela ordem em que foi construída e com o
vocabulário de quem a construiu. A V2 e a V3 resolveram o **cálculo**; a V4 tem de resolver a
**leitura**. As perguntas são: o que vê primeiro um familiar que abre a app no telemóvel, como
encontra uma casa, e como sabe o que fazer.

## 1. O que está mal (auditoria de 9/10/2026)

Cada ponto foi visto em produção. Ordem: impacto em quem usa.

### 1.1 Organização da informação
| # | Problema | Onde | Porque importa |
|---|---|---|---|
| O1 | **Não existe o nível "prédio".** As frações chamam-se "5ESQ K", "1ESQ", "Rc Direito", "1 Posterior", sem morada. | Carteira, Início, Análise, Documentos | Ninguém da família reconhece "5ESQ K". A carteira tem prédios com várias frações e cada fração aparece solta. |
| O2 | **Três manchetes que não batem certo**: "12 259 € a ganhar com as decisões" (Início), "9 634 € por cobrar" (Carteira) e "12 contratos, 1 925 € de perda esperada" (retrato). | Início, Carteira | São três conceitos diferentes, todos com cara de "o número". Quem lê perde a confiança. |
| O3 | **O Início é um scroll único** com 8 blocos: manchete, gráfico, 6 indicadores, 4 grupos de decisões, 20 recibos em lista corrida, agenda e cobertura. | Início | Não se percebe o que é para hoje e o que é para o ano. A estratégia (mercado, art. 72.º) compete com a tarefa do mês (emitir recibos). |
| O4 | **Nove destinos em duas camadas**: cinco separadores, mais Análise, Senhorios, Saúde e Admin num menu. Mercado e Análise sobrepõem-se ("rendas abaixo do mercado" aparece nos dois). | Navegação | A mesma pergunta tem duas respostas em sítios diferentes. |
| O5 | **Documentos exige escolher a fração num dropdown de 53** para ver um ficheiro. Não há pesquisa. | Documentos | A pergunta real é "onde está o contrato do r/c de São Pedro?". |
| O6 | **Não há pesquisa global.** Para chegar a um inquilino é preciso saber em que fração está. | Toda a app | Com 53 frações e 92 contratos, procurar é o gesto mais comum. |

### 1.2 Apresentação
| # | Problema | Onde |
|---|---|---|
| P1 | A faixa repete o nome do mês **dentro** de cada célula (24 × 53 rótulos). Pago e em falta distinguem-se mal (bloco escuro contra sublinhado vermelho). | Carteira |
| P2 | O mês corrente aparece no gráfico como um mês fechado: outubro com 301 € no dia 9 parece um colapso. | Início |
| P3 | Nomes em MAIÚSCULAS, tal como vêm do Portal ("MARTA RABAÇAL ORTIZ", "A SUPER 2000 - MAQUINAS…"). | Toda a app |
| P4 | Números grandes de baixa confiança em manchete: "3 286 148 €", o valor da carteira calculado sobre só 21 das 53 frações. | Mercado |
| P5 | "Considerar vender X" com valores a **vermelho**, que nesta paleta é perda. Vender não é perder. | Análise |
| P6 | Jargão: "taxa reduzida do art. 72.º", "perda esperada", "fronteira", "assumido", "estágio", "ritmo próprio". | Início, Análise, Carteira |
| P7 | Duas linguagens visuais: hairlines da V3 (Início, Carteira) e cartões da V1 (ficha, Saúde, Admin, Senhorios). A ação destrutiva ("Apagar fração", a vermelho) fica ao lado de "Editar". | Ficha, admin |
| P8 | Prosa a explicar gráficos e números (parágrafos debaixo do Mercado, do gráfico do Início e da agenda). | Mercado, Início |
| P9 | Tipografia com três famílias (Geist, Geist Mono, Newsreader). A serifa do número de manchete dá um ar de jornal, não de app. | Global |

### 1.3 Telemóvel
| # | Problema |
|---|---|
| T1 | Os separadores do topo transbordam ("Documentos" fica cortado) e não há navegação ao alcance do polegar. |
| T2 | O primeiro ecrã é só cabeçalho, manchete e indicadores: nenhum dado acionável aparece sem scroll. |
| T3 | A faixa fica cortada à direita: o mês em curso, o que mais interessa, está fora do ecrã. |
| T4 | Tabelas com scroll horizontal (Saúde, Admin, ficha). |

---

## 2. Princípios da V4

1. **Uma pergunta por destino, uma manchete por pergunta.** Cada número de topo tem definição
   explícita e é o mesmo em todo o lado.
2. **O objeto é o imóvel, não a linha.** Prédio, depois fração, depois contrato. É assim que a
   família pensa nas casas.
3. **Hoje separa-se da estratégia.** O que tem prazo neste mês vive em Hoje; o que muda o
   rendimento do ano vive em Dinheiro.
4. **O mês em curso é "em curso", nunca "abaixo".** Vale em todos os gráficos e faixas.
5. **Linguagem de família.** "Pagar menos IRS" e não "art. 72.º". O artigo vai para o detalhe,
   para quem o quer.
6. **Telemóvel primeiro.** Cada ecrã desenha-se primeiro a 390 px.
7. **Manter o que está certo.** A semântica de cor (âmbar é atenção, vermelho é perda, ardósia é
   desconhecido, sem verde de "ok"), a honestidade sobre o que a app não sabe, e toda a camada de
   cálculo (snapshot, arrears, irs, risk, agenda) com os seus checks.

---

## 3. Nova arquitetura

### 3.1 Destinos
| Destino | Pergunta | Recebe | Viewer |
|---|---|---|---|
| **Hoje** | "Está tudo pago? O que tenho de fazer?" | Início (parte operacional), agenda, recibos por emitir | Sim, sem tarefas de admin |
| **Imóveis** | "Como está cada casa?" | Carteira, Mercado (por fração), Senhorios (filtro) | Sim |
| **Dinheiro** | "Quanto entra, quanto sai, quanto pago de imposto, o que posso melhorar?" | Ano/IRS, Análise, Mercado (visão de carteira), oportunidades | Sim, sem conselhos de venda |
| **Arquivo** | "Onde está o documento X?" | Documentos, minutas | Sim |
| Admin (menu da conta) | Import, fichas em lote, saúde dos dados, utilizadores, INE | Admin, Saúde | Não |

As rotas antigas (`/carteira`, `/mercado`, `/ano/*`, `/analise`, `/documentos`, `/senhorios`)
passam a **redirects** para as novas, com o mesmo padrão já usado em `/pagamentos` e `/atrasos`.
Ninguém perde um marcador.

### 3.2 Navegação
- **Computador:** barra lateral fina (232 px) com a marca, a pesquisa, os 4 destinos com
  contagens, e no rodapé a cobertura dos dados ("Conhecido até out 2026 · avô só até jul").
- **Telemóvel:** **barra de separadores em baixo**, com 4 ícones e etiqueta, e a pesquisa como
  ícone no topo de cada ecrã. Substitui o `masthead` com separadores no topo.
- **Pesquisa global (`Ctrl K` / lupa):** frações, prédios, inquilinos (nome e NIF), artigos
  matriciais e documentos. Usa o snapshot que já está em memória; não faz nenhuma query nova
  por tecla. Era o comando ⌘K previsto no PLANO.md §10.7.

### 3.3 O nível "prédio", sem alterações de schema
Módulo **puro** novo, `src/lib/portfolio/predios.ts`, com o seu `predios.check.ts`:
- **Chave do prédio** = o artigo matricial sem o identificador da fração:
  `182341-U-5077-C` dá `182341-U-5077`. Um artigo sem letra (moradia, loja isolada) é um prédio
  de uma fração. Os rústicos (`-R-`) agrupam-se como "Terrenos" por freguesia. Uma fração sem
  artigo fica sozinha, marcada "sem artigo".
- **Nome do prédio** = a morada mais frequente entre as frações, sem o andar e normalizada para
  minúsculas com maiúscula inicial ("Rua Azeredo Perdigão, 88"). Sem morada, usa o artigo.
- **Nome da fração** dentro do prédio = o identificador de andar normalizado: "1ESQ" passa a
  "1.º Esq.", "RCESQ" a "R/c Esq.", "5ESQ K" a "5.º Esq. (K)". As regras de normalização são uma
  tabela no módulo, testada caso a caso com os 53 nomes reais. O que a regra não reconhecer fica
  como está.
- **Agregados por prédio:** frações, arrendadas, renda/mês, em atraso, estado dos últimos 6 meses
  (pior estado das frações por mês) e senhorios.
- Risco: um prédio em compropriedade parcial (a garagem com 15 titulares) agrupa bem pelo artigo.
  As regras de quota não mudam: continuam no `irs.ts`.

### 3.4 Uma só manchete e um vocabulário
Módulo puro `src/lib/portfolio/mes.ts` (com check), a **única** fonte do "mês em curso":
- `esperado`: soma das rendas de referência dos contratos ativos;
- `recebido`: recebido até hoje;
- `emAtraso`: rendas vencidas há mais de `GRACE_DAYS` e não pagas;
- `porVencer`: o resto.

É isto que alimenta a manchete de Hoje, o rodapé dos Imóveis e o gráfico (barra riscada "em
curso"). "Perda esperada" (risk.ts) continua a existir, mas só como detalhe no risco do contrato.

Glossário fixo (vive no módulo `src/lib/vocabulario.ts`, usado pela UI):
| Hoje | Passa a |
|---|---|
| Perda esperada | Risco de não receber |
| Comunicar à AT para taxa reduzida do art. 72.º | Pagar menos IRS (art. 72.º) |
| Fronteira de dados / horizonte | Conhecido até |
| Assumido / estimado / medido | Estimativa / Certo |
| Fonte parada | Recibos de X parados desde… |
| Cessado | Terminado |

Os nomes de pessoas e empresas passam por `nomeProprio()` (maiúscula inicial, com exceções para
"da/de/do/dos/e", "Lda", "S.A.", "Unipessoal"). Só na apresentação; a BD não muda.

---

## 4. Ecrã a ecrã

Cada ecrã tem a versão de telemóvel no protótipo. Aqui ficam a especificação e os estados.

### 4.1 Hoje (`/`)
**Ordem, de cima para baixo:**
1. **Saudação com a frase do mês**, por exemplo "Faltam 33 rendas de outubro", seguida de uma
   linha de contexto gerada pelo `mes.ts` ("É normal no dia 9: a maioria vence até dia 8.").
   Botão secundário: "Pôr prazos no calendário" (o `.ics` que já existe).
2. **Cartão do mês em curso.** A manchete é o recebido; por baixo, "de X esperados · N de 42
   contratos pagos". Uma barra empilhada recebido / em atraso / por vencer, com legenda e
   valores. Substitui o "12 259 € a ganhar".
3. **Cartão dos últimos 12 meses.** Barras com âmbar nos meses abaixo do esperado, o mês em curso
   riscado e sem cor, e o total com variação anual numa linha. A linha tracejada da renda de
   referência mantém-se (já é assim hoje). Sem parágrafo explicativo: só a legenda.
4. **"Para fazer"**: uma grelha de cartões de tarefa (2 colunas no computador, 1 no telemóvel).
   Cada cartão tem a contagem grande, a etiqueta de natureza (Este mês · Risco · prazo · Por
   saber), o nome em linguagem simples, uma frase de porquê com os 3 casos maiores, o valor e
   **uma** ação. Ao clicar no cartão, abre uma **folha lateral** (gaveta no telemóvel) com a
   lista completa e as ações por linha. Os 20 recibos por emitir saem da página e vão para
   dentro desta folha. Os geradores são os do `insights.ts`; muda só a forma.
5. **Próximos prazos** (a agenda que já existe): lista com data em bloco, título e uma linha.
6. **Oportunidades**: no máximo 2 linhas e um link para Dinheiro. A estratégia deixa de ocupar o
   Hoje.
7. **"Por saber"**: uma faixa ardósia, só se houver fonte parada.

**Viewer:** vê 1, 2, 3, 5 e uma lista "Quem está em atraso" em vez das tarefas. Mantém-se a
regra de duas leituras separadas (`Estado` e `Decisoes`).

**Estados:** carteira vazia (convite a importar); dia 1 a 8 (texto "a maioria ainda não venceu");
tudo pago ("Outubro fechado: 42 de 42"); erro (o `error.tsx` que já existe).

### 4.2 Imóveis (`/imoveis`)
1. Título "12 imóveis, 53 frações" e uma linha de explicação. Ação primária (admin): "+ Nova
   fração".
2. **Quatro indicadores em cartões pequenos**: renda contratada, ocupação ("42 de 53, 11 vagas,
   8 são terrenos"), em atraso (valor a vermelho e contagem) e VPT.
3. **Filtros em pílulas**: Todos · Com atraso · Com vagas · Renda atualizável · Senhorio ·
   Ordenar (atraso, renda, nome). Os filtros vivem no URL (`?f=atraso&s=antonio`), como as
   lentes de hoje. A vista tem dois modos: **Cartões** (por omissão) e **Tabela** (densa, para o
   admin).
4. **Cartão de prédio:**
   - capa com um desenho geométrico da fachada (pisos de acordo com as frações; terrenos como
     colinas), porque não há fotografias;
   - etiqueta de estado no canto (Em dia · Com atraso · 1 vaga · Recibos parados · Terreno);
   - nome e local, com o número de frações;
   - **6 quadrados de mês** (pago, parcial, falta, em curso riscado, por importar) e a renda/mês;
   - "N de M arrendadas".

   Ao clicar, abre o **prédio**: cabeçalho com a morada e os agregados, e uma lista de frações,
   cada uma com o estado do mês, o inquilino, a renda e uma seta. Prédio de uma só fração salta
   direto para a ficha.
5. **A faixa sai desta página.** Os 24 meses × 53 frações passam para a vista "Histórico" (um
   separador dentro de Imóveis, só para o admin), com os meses no **eixo** e não dentro das
   células. No telemóvel, o histórico mostra os últimos 6 meses alinhados à direita.

O `€/m² contra o INE` deixa de ser uma página: aparece no cartão de mercado da ficha e como
filtro "Abaixo do mercado". A visão de carteira do mercado passa para Dinheiro.

### 4.3 Ficha da fração (`/imoveis/[predio]/[fracao]`, com redirect de `/fracoes/[id]`)
- **Migalhas:** Imóveis / prédio / fração.
- **Cabeçalho:** nome da fração, uma linha com morada, tipologia, área e titulares; à direita, a
  etiqueta de estado, "Editar" e um **menu "…"** com as ações raras e destrutivas (Terminar
  contrato, Apagar fração). Apagar deixa de estar à vista.
- **Separadores:** Resumo · Pagamentos · Contrato · Documentos (com contagem) · Despesas.
- **Resumo** (o que se vê ao chegar):
  - à esquerda: pagamentos por ano (12 células com altura igual à fração recebida e os meses no
    eixo por baixo) e os factos do contrato;
  - à direita: um cartão **"Próximo passo"** com a única ação que importa agora (gerar a carta de
    atualização, cobrar, emitir recibo), o mercado em 4 números e os últimos documentos.
- **Pagamentos:** o histórico completo ano a ano (o que hoje está na ficha), mais os recibos.
- **Contrato:** contrato ativo e anteriores, atualizações de renda, vazios entre contratos e as
  minutas que se aplicam (`enquadrarMinutas`). As cartas saem de Documentos para aqui, porque é
  aqui que se decidem.
- **Documentos:** o arquivo da fração, com upload direto (o `<Carregar destino>` que já existe).
- **Despesas:** a tabela de despesas, sem descrição truncada no telemóvel (lista em cartões).

### 4.4 Dinheiro (`/dinheiro`)
Separadores: **Fluxo** · **IRS por ano** · **Projeção** · **Oportunidades**.
- **Fluxo:** o gráfico mensal de 24 meses, a série anual (renda.ts) e a concentração por
  inquilino.
- **IRS por ano:** o atual `/ano/[ano]`, sem mudanças de cálculo. A frase de manchete passa a
  sans, e o seletor de senhorio fica em pílulas.
- **Projeção:** futuro.ts, em leque (P10/P50/P90). O texto "não é um conselho de investimento"
  fica numa nota, não num parágrafo.
- **Oportunidades:** os conselhos com a confiança explícita (Certo/Estimativa) e o valor em
  **tinta**, não em vermelho. "Considerar vender" passa a "Rever a venda de…", sempre com a
  morada do prédio. O viewer não vê as de venda.

### 4.5 Arquivo (`/arquivo`)
- **Pesquisa no topo** por nome do ficheiro, fração, prédio ou inquilino. Filtros em pílulas:
  Tipo (Caderneta, Contrato, IRS, Carta, Outro, inferido do nome) · Prédio · Ano.
- Lista com ícone do tipo, nome, fração/prédio e data. Ao clicar, abre o link assinado (como
  hoje).
- Upload por arrastar para qualquer ponto da página (admin), com o palpite pelo artigo que já
  existe.
- O dropdown de 53 frações desaparece; escolher uma fração é um filtro.

### 4.6 Admin (menu da conta)
Admin, Saúde e Utilizadores ficam como páginas de ferramenta, mas no **mesmo sistema visual**:
cartões novos, tabelas que no telemóvel viram listas, e sem scroll horizontal.

---

## 5. Sistema visual

### 5.1 Escolha da direção (decisão tua, com o protótipo)
| | A · Banca calma (**recomendada**) | B · Editorial refinado | C · Centro de controlo |
|---|---|---|---|
| Referências | Mercury, Monzo | Wealthsimple, Midday | Mews, Airbnb |
| Tipografia | **Inter** só, pesos 400/500/600, números tabulares | Hedvig Letters Serif nos títulos, Hedvig Letters Sans no texto | Bricolage Grotesque 800 nos títulos, Inter no texto |
| Fundo e cartões | `#f3f5f4` e cartões brancos com hairline e sombra mínima | Papel `#f1efe9`, plano | Branco, cartões creme `#fffcf6` e mosaicos pastel por tipo de tarefa |
| Acento de ação | Verde-cofre `#0f6b5c` (continua a identidade) | Quase preto | Preto |
| Raios | 16 px cartões, pílula nos controlos | 8 px, pílula | 22 px, pílula |
| Leitura | Calma, "app de banco" | Elegante, "revista", próxima do atual | Expressiva, lê-se depressa no telemóvel |
| Risco | Baixo: tokens próximos dos atuais | Muda pouco o que criticaste | Pode cansar no uso diário |

**Recomendo a A.** Pedes que deixe de parecer o mesmo site, e a B mantém a voz de jornal que
criticas. A C é a mais distante, mas os pastéis competem com a semântica de cor (âmbar, vermelho,
ardósia), e essa semântica é o que diz a verdade sobre o dinheiro. A A muda tipografia, forma,
superfícies e navegação, e mantém intacta a semântica.

### 5.2 Tokens (direção A)
Substituem o bloco 2 do `globals.css`. Os **nomes semânticos mantêm-se** (`papel`, `carta`,
`tinta`, `acao`, `atencao`, `perda`, `futuro`): o código existente continua a compilar e a
transição faz-se trocando valores.
| Token | Claro | Escuro |
|---|---|---|
| `--papel` (fundo) | `#f3f5f4` | `#0e1213` |
| `--carta` (cartão) | `#ffffff` | `#161b1c` |
| `--vellum` (superfície 2) | `#eef1f0` | `#1d2324` |
| `--regua` / `--regua-forte` | `#e2e6e4` / `#cfd5d2` | `#262d2f` / `#343c3e` |
| `--tinta` / `-2` / `-3` | `#0f1517` / `#545e61` / `#8a9396` | `#ecefee` / `#a3abad` / `#6f797b` |
| `--acao` / `--acao-tenue` | `#0f6b5c` / `#e2f1ed` | `#3fb39b` / `#12302a` |
| `--atencao` / tenue | `#a5610a` / `#fbf0df` | `#e0a34a` / `#2e2210` |
| `--perda` / tenue | `#c2362b` / `#fbe9e7` | `#f0796e` / `#33140f` |
| `--futuro` / tenue | `#66758a` / `#edf0f5` | `#93a1b5` / `#1b2230` |

Todos os pares texto/fundo têm de passar **WCAG AA** (4,5:1). É o mesmo processo de medição no
browser que a V2 usou (PLANO.md §0, Fase 0).

### 5.3 Tipografia
- **Inter** (variável, via `next/font`) para tudo; **Geist Mono** só para artigos matriciais, NIF
  e nº de recibo. **A Newsreader sai.**
- Escala: 12 (legenda) · 13 · 14 (corpo) · 15 (nomes) · 18 (secção) · 24 (título no telemóvel) ·
  30 (título) · 44 (manchete). Pesos 400, 500 e 600; nunca 700 ou mais.
- `font-variant-numeric: tabular-nums` em todos os números, como hoje. O `<Money>` mantém a
  magnitude a peso pleno e os cêntimos e o € esbatidos.

### 5.4 Forma, espaço e profundidade
- Cartões com 16 px de raio, hairline de 1 px e sombra mínima (`0 1px 2px` a 5%). As folhas e
  modais ganham sombra real.
- Controlos em pílula (botões, chips, pesquisa); separadores com sublinhado.
- Grelha de 4 px; 24 px entre blocos no telemóvel, 32 px no computador; largura máxima de 1280 px.
- Ícones lucide a 18 px e traço 1,8, em todo o lado.

### 5.5 Movimento
Mantêm-se as regras atuais: nada acima de 420 ms, nada em loop, `prefers-reduced-motion`
desliga tudo. Movimento novo, todo com função:
- entrada do ecrã: opacidade e 4 px em 220 ms;
- folha lateral e gaveta: deslize de 240 ms com `ease-out`, e o fecho mais rápido (180 ms);
- números da manchete contam até ao valor no primeiro render (400 ms, uma vez);
- cartões sobem 1 a 2 px no hover (só em dispositivos com rato).

### 5.6 Componentes
| Novo | Para quê |
|---|---|
| `Shell` (lateral e barra inferior) | Substitui o `masthead.tsx`. O `nav.tsx` e o `masthead.tsx` ficam no repo, como hoje, para poder voltar atrás. |
| `Pesquisa` (comando) | Pesquisa global sobre o snapshot. Client component em ficheiro próprio. |
| `Folha` | Gaveta lateral ou inferior, com foco preso e Esc (reutiliza a lógica do `modal.tsx`). |
| `CartaoTarefa`, `CartaoPredio`, `CartaoKpi` | Cartões de Hoje e Imóveis. Sem hooks, logo sem `"use client"`. |
| `Meses` (6 quadrados) e `LinhaDoTempo` (12 meses com eixo) | Substituem a faixa nas vistas de resumo. A `Faixa` continua no Histórico. |
| `Pilulas` (filtros no URL) | Filtros de Imóveis, Arquivo e Dinheiro. |
| `Separadores` | Ficha e Dinheiro, com estado no URL. |
| `MenuMais` | Ações raras e destrutivas. |

O `forms.tsx` (706 linhas) desfaz-se: cada formulário passa a abrir numa `Folha` e vai para o
ficheiro da sua entidade (`components/fracao/editar.tsx`, …). As regras do `ui.tsx` (nunca
`"use client"`) mantêm-se.

---

## 6. Lógica nova (pura, com checks)
| Módulo | Faz | Check |
|---|---|---|
| `portfolio/predios.ts` | Chave e nome do prédio, nome normalizado da fração, agregados | Os 53 nomes reais como casos (anonimizados no check), compropriedade, sem artigo, rústicos |
| `portfolio/mes.ts` | Esperado, recebido, em atraso e por vencer do mês em curso; frase de contexto | Dia 1, dia 9, mês fechado, fonte parada |
| `vocabulario.ts` | Glossário e `nomeProprio()` | Partículas, siglas, empresas |
| `portfolio/pesquisa.ts` | Índice de pesquisa sobre o snapshot (normalização sem acentos) | Acentos, NIF parcial, artigo |
| `documentos.ts` (alargado) | Tipo do documento inferido do nome | Cadernetas, contratos, IRS |

Nenhum altera o schema. O snapshot ganha `predios` e `mes`; o resto continua igual.

---

## 7. Faseamento

Cada fase termina com `npm run build` e `npm run check` verdes, verificação no browser com sessão
real (computador **e** 390 px, temas claro e escuro), um commit por fase e deploy só a teu pedido.
| Fase | Entrega | Ficheiros principais | Aceitação |
|---|---|---|---|
| **F0** | Escolher a direção no protótipo | `docs/redesenho/prototipo.html` | Decisão registada aqui |
| **F1** | Tokens novos, Inter, a `Shell` (lateral e barra inferior) e as rotas novas com redirects | `globals.css`, `layout.tsx`, `components/shell/*` | Todas as páginas antigas abrem no novo invólucro; contraste AA medido; zero transbordo a 390 px |
| **F2** | `predios.ts`, `mes.ts` e `vocabulario.ts` com checks | `lib/portfolio/*` | Checks verdes; os 53 nomes reais normalizados e revistos contigo |
| **F3** | Hoje | `app/(app)/page.tsx`, `components/hoje/*` | Manchete = `mes.ts`; mês em curso riscado; tarefas em folha; primeiro ecrã do telemóvel com dados |
| **F4** | Imóveis: cartões, prédio, tabela e histórico | `app/(app)/imoveis/*` | Encontrar uma fração em ≤ 2 toques a partir de Imóveis; `/carteira` redireciona |
| **F5** | Ficha em separadores e `forms.tsx` dissolvido em folhas | `imoveis/[predio]/[fracao]`, `components/fracao/*` | Apagar só no menu "…"; ficha de 390 px sem scroll horizontal |
| **F6** | Dinheiro | `app/(app)/dinheiro/*` | IRS igual ao atual ao cêntimo (o `irs.check.ts` não muda) |
| **F7** | Arquivo com pesquisa e a pesquisa global | `app/(app)/arquivo`, `components/pesquisa.tsx` | Qualquer documento em ≤ 3 teclas |
| **F8** | Admin e Saúde no sistema novo; limpeza do legado | `admin/*`, `saude/*` | Nenhuma classe `zinc/teal/emerald` em código tocado |

Ordem pensada para ter valor visível cedo: no fim da F3 a página que todos abrem já é nova.

## 8. Riscos e como se mitigam
- **Nomes de fração mal normalizados.** A regra é uma tabela testada, e o que não reconhecer fica
  igual. Revês a lista dos 53 antes da F3.
- **Prédios mal agrupados** por artigos irregulares: a fração fica sozinha, e a Saúde dos dados
  ganha um aviso "artigo sem padrão".
- **Regressões de cálculo:** nenhuma fase mexe em `arrears`, `irs`, `risk` ou `snapshot`, exceto
  para acrescentar campos. Os 21 checks são o gate.
- **Hábito da família:** os marcadores antigos redirecionam, e o ecrã Hoje continua a ser o
  primeiro.
- **Tamanho:** o `recharts` só carrega onde há gráfico (Hoje e Dinheiro), e o protótipo não usa
  imagens.

## 9. O que preciso de ti
1. **Escolher a direção** (A, B ou C) no protótipo, ou dizer o que mudarias.
2. Confirmar os **quatro destinos** (Hoje, Imóveis, Dinheiro, Arquivo).
3. Na F2, rever a lista dos nomes normalizados das 53 frações e dos prédios.

## 10. Referências estudadas (styles.refero.design)
- **Mercury:** monocromia com um só acento de ação, pesos intermédios, cartões sem sombra e
  controlos em pílula. Daqui veio a base da direção A.
- **Monzo:** cartões brancos sobre um fundo levemente tingido, sem sombras; hierarquia por cor e
  peso. Daqui veio o fundo `#f3f5f4` e o cartão branco.
- **Wealthsimple** e **Midday:** a versão madura do editorial; base da B, e prova de que o atual já
  está nesse registo.
- **Mews:** centro de controlo com mosaicos por categoria e títulos pesados; base da C.
- **Airbnb:** o objeto como cartão com capa. Daqui vieram os cartões de prédio com fachada.
- **Era** e **Compound:** "ledger on paper", o que a app é hoje. Serviram de contraste.

---

## 11. O que foi feito, e onde o plano mudou (9/10/2026)

F0 a F8 estão no `main`, um commit por fase, com `npm run build` e os checks verdes (25,
contra 21). Verificado no browser com dados reais, a 375 px e em computador.

| Fase | Feito |
|---|---|
| F1 | Tokens da direção A, Inter, `Shell` (barra lateral e separadores em baixo), rotas novas |
| F2 | `predios.ts`, `mes.ts`, `nomeProprio`/`mesPorExtenso` (format.ts), `fonteDoContrato` no snapshot |
| F3 | Hoje: cartão do mês, meses fechados, tarefas com folha lateral, prazos, oportunidades |
| F4 | Imóveis por prédio (`imoveis.ts`), página do prédio, quadrados de mês |
| F5 | Ficha em separadores, "Próximo passo", menu "…", formulários em folha |
| F6 | Dinheiro: IRS, projeção e conselhos, mercado |
| F7 | Arquivo com pesquisa e tipos; pesquisa global (Ctrl K) |
| F8 | Admin, Saúde, Senhorios, login e formulários sem classes da V1 |

**Desvios ao plano, e porquê:**
- **O mês corrente não tem "em atraso"** (§3.4 dizia que tinha). Os recibos só entram com as
  recolhas dos dias 15 e último: a 9 de outubro, chamar atraso ao que falta era acusar quem já
  pagou. Ficou "por receber", e o atraso é o dos meses anteriores.
- **Uma só definição de "em atraso"** (`emAtrasoDaCarteira`, insights.ts). A tarefa e o cartão
  mostravam 15 364 € e 9 634 € para a mesma pergunta.
- **`vocabulario.ts` não existe.** As palavras novas estão escritas nos ecrãs; o que era código
  (`nomeProprio`, `mesPorExtenso`) vive no `format.ts`.
- **`forms.tsx` não foi dividido.** O `Modal` partilhado passou a folha lateral, e com isso todos
  os formulários mudaram de forma sem tocar nas 706 linhas. Dividir o ficheiro não muda nada
  para quem usa a app.
- **Dinheiro junta páginas existentes** (Ano, Análise, Mercado) em separadores, em vez de as
  reescrever: o cálculo está testado e não havia razão para o duplicar.
- **A faixa continua** como "Histórico mensal" (`/carteira`), a um toque de Imóveis.
