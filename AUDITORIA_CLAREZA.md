# Auditoria de clareza · 16 de outubro de 2026

> Escrita a pedido do utilizador, depois de o PLANO_CLAREZA.md ter sido executado por
> inteiro a 13/10 e a queixa se manter: *"continuo a achar que precisa de mais clareza dos
> dados, mais organização, melhor usabilidade para tomar decisões sem ter títulos de
> história por detrás de KPI"*.
>
> Método: visita autenticada ao site a correr (sessão de administrador, só leitura),
> leitura do código das cinco superfícies e consultas diretas à base de produção para
> confirmar números. Não substitui o PLANO_CLAREZA.md como roteiro; é a lista do que ficou
> por resolver e a ordem acordada para o resolver.

---

## 0. O diagnóstico de fundo

**A app não tem um problema de prosa. Tem um problema de unidades, e a prosa é o penso.**

Cada número grande precisa de uma frase por baixo porque os números não são da mesma
espécie. Enquanto isso for verdade, tirar as frases só torna a app mais críptica. O plano
de 13/10 atacou o sintoma (trocou prosa por caixas) e por isso a queixa sobreviveu à
execução dele.

A prova está na fila "Para fazer" do Hoje: cinco cartões, cinco números no mesmo tamanho
(`escala="xl"`), ordenados pelo valor bruto.

| Nº no cartão | O que é realmente | Unidade |
|---:|---|---|
| 13 872 € | Renda de 21 contratos sem recibos desde julho | acumulado, 4 meses |
| 7 162 € | Dívida acumulada, até 24 meses por contrato | acumulado, até 24 meses |
| 5 641 € | Poupança **fiscal** se confirmares prazos (art. 72.º) | por ano |
| 3 960 € | Renda × 12 de contratos que provavelmente já cessaram | margem de erro, não dinheiro |
| 3 260 € | As 9 rendas de outubro por documentar | **um mês** |

O código admite-o. `Insight.euros` está documentado como *"valor em euros no horizonte de um
ano"* e três dos cinco não são. O gerador de `contrato_zombie` tem o comentário honesto:
*"Não vale dinheiro a receber: vale limpar dívida que provavelmente não existe."*

**Consequência prática:** a fila ordena por esse número, logo põe uma otimização fiscal
especulativa (5 641 €) e uma margem de erro (3 960 €) acima da única coisa que tem de
acontecer todos os meses — emitir os recibos (3 260 €, quinto lugar).

---

## 1. Os pontos

### Estrutura

**1. Separar `euros` em valor + unidade, e nunca ordenar entre unidades.**
Cada insight declara `unidade: "acumulado" | "por_ano" | "este_mes" | "margem"`. A face do
cartão mostra a unidade ao lado do número, no mesmo peso. Sem isto, nenhuma das outras
mudanças pega.

**2. Partir a fila em duas listas que nunca se misturam.**
"Este mês" (repetitivo, datado, fecha com uma ação) e "A investigar" (qualidade de dados e
otimização). A primeira ordena-se por **data**, não por euros.

**3. Falta uma identidade que feche.**
A base diz 42 contratos ativos, 15 241 €/mês contratados. A app mostra `7 648 €` esperados
no Hoje, `6 845 €/mês` sem informação nas Cobranças e `15 241 €` nos Imóveis. Os três nunca
aparecem juntos e nunca se explica que `7 648 + 6 845 ≈ 14 493 ≈ 15 241` menos retenção e
vagas. Propõe-se uma **cascata única** onde cada euro está num e num só balde e os baldes
somam o total:

```
Renda contratada 15 241 €/mês
  ├─ Recebido            4 565 €
  ├─ Por receber         3 115 €   (mês em curso)
  ├─ Sem informação      6 845 €   (21 contratos, recibos parados)
  └─ Vago                  ... €
```

Um denominador, zero unidades misturadas, zero prosa, e cada barra abre a lista que a
compõe.

**4. Os 5 destinos são uma fachada sobre a estrutura antiga.**
`/impostos` é um ficheiro de 13 linhas que renderiza `/ano/[ano]`. `/rentabilidade` importa
`/mercado`, `/despesas` e `/analise` como componentes e mostra-as em separadores, enquanto
essas rotas continuam vivas. São 28 rotas de página para 5 destinos, com duas moradas para o
mesmo conteúdo em quatro casos.
→ Mover o corpo para `components/rentabilidade/*` e passar as rotas antigas a redirects,
como já foi feito com `/pagamentos` e `/atrasos`.

**5. O facto maior da carteira é um crachá.**
21 contratos sem recibos desde julho, 6 845 €/mês: cerca de **27 000 € por explicar**,
quatro vezes a dívida conhecida. No Hoje é um crachá pequeno e um cartão na fila. Devia ser
a primeira coisa da página, com o **acumulado**, não a taxa mensal.

**6. O viewer e o admin veem páginas com estrutura diferente** (`Tarefas` vs `Atrasados`).
Quando um familiar pede ajuda ao telefone, olham para ecrãs que não coincidem. Manter a
mesma composição e esconder só as ações de escrita.

### Números que se contradizem no mesmo ecrã

**7.** Imóveis, cabeçalho: "30 prédios · 61 frações". Oito linhas abaixo, KPI: "Ocupação
42 de 53". Dois denominadores para "frações" à distância de um olhar.

**8.** Cobranças, linha de KPIs: `Em atraso 7 162 €` (stock), `Por receber 3 115 €` (stock
do mês), `Sem informação 6 845 €` (**por mês**). Duas quantias e uma taxa no mesmo formato.

**9.** Rentabilidade: o KPI "Rende por ano" é uma percentagem do valor de mercado; a secção
"As 5 que mais rendem" ordena por euros de resultado. "Render" significa duas coisas na
mesma página.

**10.** Ainda aí: "Rende por ano" divide uma **medição** por uma **estimativa** e mostra o
resultado como KPI de topo sem marca de confiança, contra o princípio 8 do PLANO_CLAREZA.

### Vocabulário

**11.** Apesar do glossário único, as strings visíveis usam cinco termos para o mesmo
conceito: "em atraso" (29), "em falta" (10), "por pagar" (5), "dívida" (4), "atrasado" (3).
Escolher um e proibir os outros num check.

**12.** O Hoje (viewer) lista devedores **por fração**; as Cobranças listam os mesmos **por
inquilino**. A mesma lista, duas chaves. Escolher o inquilino, que é quem paga.

**13.** A manchete do Hoje é uma frase ("Faltam 9 rendas de outubro."). É o título de
história de que o utilizador se queixa. Devia ser o número do mês e a sua barra.

### Defeitos visíveis

**14.** `components/ajuda.tsx` descreve uma navegação que já não existe: aponta para
"Dinheiro" e "Arquivo" quando o menu diz Rentabilidade e Impostos.

**15. ~~Esse painel está renderizado duas vezes no DOM (desktop e móvel), e um leitor de ecrã
lê-o a dobrar.~~ FALSO ACHADO, retirado a 16/10.**
O painel está mesmo duas vezes no markup, mas não é lido a dobrar: é um `<dialog>` fechado
(logo fora da árvore de acessibilidade), o do computador vive num `<aside hidden md:flex>` e
o do telemóvel num `<header md:hidden>`, que são mutuamente exclusivos, e os ids vêm de
`useId()`, por isso também não há ids repetidos. O achado veio de ler o despejo da árvore de
acessibilidade sem aplicar o contexto responsivo. Não se mudou nada.

**16.** No Hoje, por baixo da fila: "1 abaixo de 250 €/ano, no total de 0 €." Um item que
totaliza zero euros, sem guarda.

**17. ~~`/fracoes/[id]` tem 704 linhas e cerca de doze blocos empilhados... obriga a mais
scroll.~~ EM GRANDE PARTE FALSO, revisto a 16/10.**
A página já está em CINCO separadores (Resumo, Pagamentos, Contrato, Documentos, Despesas) e
cada um tem entre 18 e 104 linhas de JSX; o Resumo são quatro blocos em duas colunas. Os 704
linhas são do FICHEIRO, não do ecrã, e estão dentro do limite de 800 do projeto. Contei os
blocos no ficheiro sem reparar que estavam repartidos por separadores. Fica como dívida de
manutenção, não de usabilidade: partir o ficheiro em componentes quando houver outra razão
para lhe mexer.

---

## 2. O que NÃO se muda

- **As Cobranças são a melhor página do site** e são o modelo a copiar.
- **A Rentabilidade está quase lá**; só precisa do vocabulário arrumado (9 e 10).
- **A estética "banca calma" não é o problema** (princípio 7 do PLANO_CLAREZA mantém-se).
- **O motor de cálculo é sólido.** Nenhum ponto desta lista é um erro de cálculo: é a
  apresentação a trair números corretos.

---

## 3. Ordem acordada

Acordada com o utilizador a 16/10/2026. **Quando o utilizador disser "continua", retoma-se
pela primeira linha que não estiver feita.** Marcar aqui ao fechar cada lote.

| Ordem | Pontos | O que é | Estado |
|---|---|---|---|
| 1.º | **1, 2, 3** | Unidades, duas listas, cascata. O trabalho de fundo. | **FEITO a 16/10** |
| 2.º | **14, 15, 16** | Defeitos de dez minutos que estragam a confiança. | **FEITO a 16/10** (15 era falso achado) |
| 3.º | **4** | Arrumar as rotas duplicadas. | **FEITO a 16/10** |
| 4.º | **7 a 13** | Consistência de números e vocabulário, com check. | **FEITO a 16/10** |
| 5.º | **5, 6, 17** | Recomposição do Hoje e da ficha da fração. | **FEITO a 16/10** (17 revisto) |

---

### O que o 1.º lote mudou (16/10)

- `Insight.unidade` (`por_ano | acumulado | este_mes | margem`) em todos os 13 geradores do
  `insights.ts` e nos 4 do `conselhos.ts`. A unidade aparece na face do cartão, no lugar da
  legenda que era deduzida do `grupo` (e que rotulava uma poupança fiscal de 5 641 €/ano
  como "Renda sem informação").
- A fila **deixou de ordenar por euros**: ordena por `PRIORIDADE`, uma lista explícita por
  `kind`. Emitir os recibos do mês é sempre a primeira tarefa.
- `Fila.esteMes` e `Fila.investigar`, duas listas disjuntas, com secções próprias no Hoje.
- `fila.total` e `fila.totalAssumido` só somam `por_ano`.
- `ResumoDoMes.cascata`: três baldes disjuntos calculados no mesmo ciclo, com o total
  definido como a soma deles. O denominador do cartão do mês passou de **7 648 €** (que
  excluía em silêncio a fonte parada) para **14 525 €**, com o que não se sabe hachurado.
  Conferência medida contra a base: 15 241 € ilíquidos − 14 525 € = 716 € de retenção.
- Checks novos: `mes.check.ts` D e E (a identidade fecha, e uma fonte parada que pagou não
  conta o dinheiro duas vezes); `insights.check.ts` B reescrito (a fila NÃO se ordena por
  euros; as duas listas são disjuntas) e C passa a somar só anuais.

### O que o 2.º lote mudou (16/10)

- **Ponto 14:** `DESTINOS` saiu do `shell.tsx` para `components/destinos.ts`, e a `Ajuda`
  passa a mapear sobre essa lista. As descrições são um `Record<DestinoHref, string>`, por
  isso acrescentar ou tirar um destino sem escrever a descrição **não compila**. A ajuda
  deixou de poder descrever uma navegação que não existe.
- **Ponto 15:** falso achado, retirado (ver acima). Nada mudou.
- **Ponto 16:** a causa não era a frase, era tratar "não se consegue quantificar" como
  "vale 0 €". Nova unidade `sem_valor`, que **passa sempre** o limiar de materialidade e
  mostra "Por apurar" em vez de um zero grande. O limiar passou a aplicar-se só a itens
  `por_ano` (somar na linha dos residuais só faz sentido dentro da mesma unidade), e um item
  quantificado que dê zero nunca entra na fila.

Efeito observado em produção, na fila do Hoje:

| | Antes (por euros) | Depois |
|---|---|---|
| 1.º | Recibos de Miguel parados · 13 872 € | **Emitir 9 recibos de outubro** · este mês |
| 2.º | Cobrar 6 contratos · 7 162 € | Cobrar 6 contratos em atraso · acumulado |
| 3.º | Confirmar prazo de 11 contratos · 5 641 € | *(A investigar)* Recibos de Miguel parados · acumulado |
| 4.º | Confirmar se 1 contrato cessou · 3 960 € | *(A investigar)* Confirmar se 1 contrato cessou · margem de erro |
| 5.º | **Emitir 9 recibos de outubro** · 3 260 € | *(A investigar)* Confirmar prazo de 11 contratos · por ano |
| — | *escondido em "1 abaixo de 250 €/ano, no total de 0 €"* | *(A investigar)* **Preencher 1 ficha de fração** · por apurar |

A tarefa que estava escondida na linha dos residuais passou a ser um cartão visível.

### O que o 3.º lote mudou (16/10)

Os corpos saíram das rotas e passaram a componentes, e as rotas antigas desapareceram:

| Era | Passou a ser | A rota antiga |
|---|---|---|
| `app/(app)/mercado/page.tsx` | `components/rentabilidade/mercado.tsx` | redirect 307 → `/rentabilidade?tab=mercado` |
| `app/(app)/despesas/page.tsx` | `components/rentabilidade/despesas.tsx` | redirect 307 → `/rentabilidade?tab=despesas` |
| `app/(app)/analise/page.tsx` | `components/rentabilidade/projecao.tsx` | redirect 307 → `/rentabilidade?tab=projecao` |
| `app/(app)/ano/[ano]/page.tsx` | `components/impostos/ano.tsx` | redirect 307 → `/impostos?ano=:ano` |

28 rotas de página passaram a **24**. Os redirects vivem no `next.config.ts`, junto dos que
já lá estavam: um `redirect()` dentro da página devolvia **200** e só se resolvia no cliente,
porque o `loading.tsx` faz a rota transmitir-se em streaming antes de a redireção acontecer.

Deriva encontrada pelo caminho e corrigida:

- o formulário do Mercado submetia para `/relatorios` e o da Projeção também, **com o
  separador errado** (`tab=analise`, quando o separador se chama `projecao`): duas redireções
  encadeadas até ao destino;
- o Despesas tinha um botão "Consultar relatórios fiscais" para `/relatorios`;
- `ano.tsx` tinha um parâmetro `emDinheiro` que escolhia entre `/impostos` e `/ano/<ano>` e
  estava fixo a `"1"` pelo único chamador. Configuração morta do tempo das duas rotas.

Verificado em execução: os seis redirects dão 307 com os query params preservados
(`/ano/2025?senhorio=abc` → `/impostos?senhorio=abc&ano=2025`), os quatro separadores e os
Impostos renderizam, e já não há uma única ligação para `/ano/...` ou `/relatorios` no código.

### O que o 4.º lote mudou (16/10)

| Ponto | Era | Passou a ser |
|---|---|---|
| **7** | "30 prédios · 61 frações" + KPI "42 de 53" | "30 prédios · **53 frações arrendáveis** · 8 terrenos e vendidos"; um denominador só |
| **8** | `Em atraso 7 162 €` · `Por receber 3 115 €` · `Sem informação 6 845 €` (por mês, unidade escondida no detalhe) | as três na mesma espécie, com a unidade à vista: **acumulado · outubro · acumulado**, e o sem-informação passou a **13 872 €** acumulados |
| **9** | KPI "Rende por ano" (%) e secção "As 5 que mais rendem" (euros) | KPI **"% do valor"**; secções **"As 5 de maior/menor resultado"** |
| **10** | a percentagem sem marca de confiança | marcada **estimado**, com a conta: "o valor de mercado é estimado; a renda e os custos são medidos" |
| **11** | cinco termos para a mesma coisa | **"em atraso"** em toda a parte, com `vocabulario.check.ts` a travar a deriva |
| **12** | Hoje listava devedores por FRAÇÃO, Cobranças por INQUILINO | ambos por inquilino, pelo mesmo `devedores()` e com a mesma chave |
| **13** | h1 "Faltam 9 rendas de outubro." | h1 **"Outubro"** + "**11 de 20** rendas recebidas"; a explicação foi para os Detalhes |

Duas coisas que só apareceram por se mexer no código:

- O cálculo do acumulado das fontes paradas estava **duplicado** entre a tarefa do Hoje e a
  página das Cobranças, e as duas mostravam espécies diferentes. Extraído para
  `fontesParadas()`, em `insights.ts`: uma definição, um número.
- `resumoDoMes` devolvia um `titulo` narrado que só a manchete usava. Removido; o `contexto`
  ficou, porque é a explicação, e explicação vive nos Detalhes.

O `vocabulario.check.ts` é o primeiro check que lê ficheiros do disco, e tem de ser: o que
está errado são strings soltas em JSX, não um valor que um módulo puro devolva. Apanhou logo
quatro ocorrências que a auditoria tinha falhado, e **mostrou que a regra inicial era
grosseira**: "em falta" tem um sentido legítimo (um campo que falta numa ficha) e saiu da
lista de proibidos. O glossário único é sobre dinheiro.

### O que o 5.º lote mudou (16/10)

- **Ponto 5:** os recibos suspensos passaram a ser a PRIMEIRA coisa do Hoje, numa faixa
  hachurada com o **acumulado** (13 872 €), o número de contratos e os meses sem recibo. O
  crachá do gráfico ("Recibos de Miguel só até jul 2026") foi removido: dizia a mesma coisa
  com a unidade pior. A tira de cobertura no rodapé fica, porque declara outra coisa — a
  fronteira dos dados.
- **Ponto 6:** a lista "Quem está em atraso" passou a aparecer para toda a gente, e as
  listas do administrador vêm a seguir, num bloco próprio. Sem `isAdmin ?` no meio da
  árvore, que é o que a CLAUDE.md proíbe: são dois blocos de topo, não uma bifurcação.
- **Ponto 17:** revisto, ver acima. Nada mudou.

Ajuste encontrado na verificação: a faixa nova mostrava a renda da fonte (6 936 €/mês) ao
lado do balde "Sem informação" do cartão (6 845 €). São medidas diferentes — a renda dos
contratos contra o que falta deles em outubro — e dois números parecidos para o que se lê
como a mesma coisa é a doença que esta auditoria trata. O `/mês` saiu da faixa.

### Gráficos (pedido avulso, 16/10)

O utilizador achou os gráficos "muito simples e pouco fáceis de ler". O `FluxoMensalChart`
do Hoje desenhava a barra do recebido e uma linha tracejada por cima, e deixava a quem lê a
tarefa de medir a olho a distância entre as duas — justamente a parte que interessa.

A barra passa a subir até ao **esperado**: o que entrou a tinta cheia, o que faltou em âmbar
esbatido por cima, e o valor em falta escrito sobre as colunas que ficaram aquém (são três,
por isso não se amontoam). A altura total passou a ser a meta e o bloco claro é o buraco.

**Não repus a grelha de fundo**, que o cabeçalho do `charts.tsx` diz ter saído de propósito
("chrome a competir com os dados"). As etiquetas resolvem a leitura sem a trazer de volta. Se
mesmo assim fizer falta, é uma linha — mas reverte uma decisão documentada e fica à escolha
do utilizador.

Por verificar: **não consegui ver o gráfico renderizado**. O `ResponsiveContainer` do
recharts mede 0 px de largura com o painel de pré-visualização escondido, por isso não
desenha. Compila e tem tipos certos; a aparência confirma-se em produção.

O `AcumuladoChart` não é usado em lado nenhum — código morto a limpar noutra altura.

---

## 4. Notas de método

- O `/imoveis` não chegou a pintar no painel de pré-visualização, mas o servidor devolve o
  conteúdo completo em 2,3 s: **não é um bug da app**, era o painel escondido a não desenhar.
- Os 287 KB de HTML medidos em `/imoveis` e `/cobrancas` são de **dev**, com símbolos de
  depuração que não existem em produção. Não servem de medida de peso.
