# RELATORIO_FINAL.md: remodelação de 3/10/2026

Ramo `remodelacao-2026-10`, onze commits sobre `main` (`8446677`).
**Produção não foi tocada**: não houve deploy, não houve push, e não houve nenhuma alteração de
schema na base de dados.

## Como voltar atrás

Tudo vive no ramo. `main` está exatamente como estava.

```bash
git checkout main
```

Para apagar a experiência por completo: `git branch -D remodelacao-2026-10`. Para ficar só com
uma parte, cada tema é um commit (`git log main..remodelacao-2026-10`) e escolhe-se com
`git cherry-pick <commit>`.

Nenhum dado da família foi escrito durante o trabalho. O servidor de dev liga à base real, e por
isso as escritas novas foram verificadas offline: os pedidos que o supabase-js constrói foram
inspecionados sem rede, e as regras de validação foram confrontadas com os dados existentes por
leitura.

## O veredicto

O núcleo desta app é bom. Uma leitura por pedido, um snapshot puro, 18 checks sobre a lógica que
custou dinheiro a acertar, e decisões escritas com o porquê. **Reescrevê-la seria destruir valor.**
Não o fiz, e a secção "O que recusei" explica porquê.

Os problemas estavam na periferia, onde costumam estar: o que acontece quando o Supabase falha,
quando um número é escrito à portuguesa, quando uma escrita fica a meio, quando um ficheiro tem o
mesmo nome que outro. Encontrei e corrigi **catorze bugs reais**, seis deles capazes de corromper
dados fiscais ou apagar documentos em silêncio.

## O que mudou, e porquê

### 1. Leituras que falham alto (`2578abb`)
- **56 leituras** tratavam um erro do Supabase como "não há nada". Uma falha de rede no export do
  Anexo F dava um ficheiro sem rendas com ar de completo. No import, gravava recibos com
  `property_id` nulo, e esses ficavam **órfãos para sempre**: o import só insere e deduplica por
  número de recibo, por isso nenhum reimport os volta a ligar. Agora `linhas()`/`linha()`
  (`lib/supabase/dados.ts`) lançam com o nome da tabela.
- `error.tsx` e `not-found.tsx` em PT-PT, dentro do layout: a falha mostra-se, a navegação
  continua, e há "Tentar de novo". Antes caía na página genérica do Next, em inglês.
- O esqueleto de carregamento deixou de pulsar: era a única animação em loop da app, contra a
  regra do design system.

### 2. Escritas que não ficam a meio nem gravam lixo (`2a8c0f0`)
- **"1.200" era lido como 1,2.** Os formulários usavam `Number(s.replace(",", "."))`: uma renda
  escrita à portuguesa ficava gravada mil vezes abaixo, e "1.234,56" ficava ilegível e o botão
  Guardar não fazia nada nem dizia porquê. O mesmo bug estava no preenchimento em lote das fichas,
  que é o fluxo das 47 fichas por preencher: um VPT copiado da caderneta como "45.230" ficava
  45,23 €. Corrigido na raiz (`parseAmount`, que o import também usa), com casos de regressão.
- **Uma quota ilegível virava 100%** (`?? 100`). As quotas alimentam o IRS e o AIMI.
- **Titulares: apagar tudo e depois inserir.** Se o insert falhasse, a fração ficava sem dono.
  Agora é upsert e depois poda; o pior que uma falha deixa é um titular a mais.
- **Atualização de renda em dois passos sem compensação**: o histórico podia afirmar uma renda que
  o contrato não tinha. Agora, se o segundo passo falha, o primeiro desfaz-se.
- **O upload de documentos escrevia por cima**: um segundo `contrato.pdf` na mesma fração apagava
  o primeiro sem aviso. Agora um nome repetido ganha sufixo (`contrato-2.pdf`).
- Guardas no servidor (`lib/validar.ts`, puro e com check) para NaN, negativos, quotas acima de
  100%, datas que não existem e coeficientes fora de [0,9; 1,2]. Antes de as ligar confirmei
  que nenhum dado existente as viola.

### 3. `market_benchmarks` sem o corte das 1000 linhas (`600ef82`)
A ficha da fração lia a tabela inteira, e o seletor de território e o painel INE não paginavam.
Hoje são 698 linhas (medido); o próximo trimestre do INE passa das 1000, e o PostgREST cortava em
silêncio. Era uma bomba-relógio com data marcada. A ficha passa a ler só os territórios da própria
fração (verificado: o mesmo resultado nas 12 frações testadas), e os outros dois paginam.

### 4. Perímetro (`16e32b2`)
- **O cron do INE autorizava-se sem segredo.** Com `CRON_SECRET` em falta, o header
  `Bearer undefined` passava, numa rota que escreve com a service-role key. Em Production o
  segredo existe (confirmado com `vercel env ls`); em Preview e em dev, não. Provado em dev: o
  pedido que antes passava leva agora 401. Comparação em tempo constante.
- `runIneRefresh` saiu do ficheiro `"use server"`, onde era um endpoint chamável por POST.
- O refresh do INE nunca atualizava `fetched_at` (o default só corre no insert). O painel do Admin
  mostrava a data da primeira importação, e por isso "19/07" não provava que o cron tivesse parado.
- CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, sem `X-Powered-By`.
  Verificado no browser: o Supabase passa e qualquer outra origem é bloqueada.

### 5. Desempenho e relógio (`8dc1195`)
- `getSession` em `cache()`: o layout e a página faziam cada um o seu `getUser()` (um pedido de
  rede ao Auth) e a sua leitura do perfil.
- **O servidor corre agora em hora de Lisboa.** A Vercel corre em UTC, e no dia 1 de cada mês,
  entre a meia-noite e a uma da manhã, a app mostrava o mês anterior. Provado num servidor de
  produção arrancado em UTC: `TZ=Europe/Lisbon`, offset −60.
- `npm run check`: de **73 s para 10 s**, numa só compilação e agora em modo `strict`. Um check
  novo é descoberto sozinho. Provei que o runner falha quando um check falha.

### 6. Ficha da fração em tema escuro (`c602586`)
O cabeçalho da tabela de recibos era um bloco branco com texto claro, quase ilegível; a descrição
das despesas escondia o valor atrás de um scroll horizontal. Ambos verificados no browser.

### 7. Funcionalidade nova: a agenda e o calendário (`8a6357d`)
"O que vem aí", no Início: as prestações do IMI, a entrega do IRS, o AIMI de setembro com o valor
estimado por senhorio, e **o último dia para enviar cada carta de atualização de renda** (30 dias
antes da data de elegibilidade, art. 1077.º do CC), com o ganho anual. O botão "Pôr no calendário"
descarrega um `.ics` com o ano inteiro e alarmes três dias antes, para a família ter os prazos no
telemóvel, que é onde olha todos os dias. Com os dados reais saem 8 prazos no próximo ano,
incluindo três cartas de renda.

A agenda diz também uma coisa que a app nunca tinha dito: **nenhum dos 42 contratos ativos tem
data de fim na base**. Por isso o gerador "contrato a terminar" e o conselho "fim de contrato"
nunca disparam, e nenhuma oposição à renovação pode ser calculada.

### 8. A revisão hostil, e o que ela apanhou (`1362c3a`)
Um revisor independente (um agente sem o meu contexto) leu o diff inteiro. Resultado: 0 críticos,
0 altos, 2 médios e 4 baixos. Corrigi os seis, e uma segunda passagem sobre as correções saiu
limpa. Os dois médios eram reais, e um deles fui eu que o causei:
- **Ao fixar o relógio de Lisboa, criei um bug em produção.** O `calc.ts` lia as datas em UTC e
  somava-lhes meses com setters locais; com o servidor em Lisboa, `2025-03-30` + 12 meses dava
  `2026-03-29`. Na máquina de dev (sempre em Lisboa) este bug **já existia antes**: a elegibilidade
  das rendas datadas de 29 a 31 de março saía um dia cedo. Agora é aritmética UTC, com caso no check.
- **"3,125" lia-se 3125.** A vírgula sozinha passa a ser sempre decimal, e os formulários
  pré-preenchem com vírgula: uma quota 3.125 voltava como 3125 ao gravar sem mexer no campo.
- Também: as cartas de renda na agenda passam a ser só do admin (a V3 separa o que cada um vê);
  o alarme do `.ics` toca às 9h e não à meia-noite; o runner dos checks só declara sucesso no fim
  (havia um check assíncrono); e os 19 scripts `check:<mod>`, que compilavam sem `strict`, saíram.

Notas que deixei como estão, de propósito: "1,200" escrito à americana lê-se agora 1,2 (numa app
em PT-PT, a vírgula é decimal), e um CSV com ponto decimal de exatamente três casas leria-se
como milhares. O Portal exporta com `;` e vírgula decimal, e os dois casos foram verificados
contra o leitor real (`spreadsheet.ts`).

## Gates finais
`npm run build` verde (lint e tipos); `npm run check` com **21 checks** verdes em ~10 s, contra os
18 iniciais. Verificado no browser com sessão de admin e dados reais: todas as rotas carregam,
a ficha mostra o mesmo mercado que antes, a CSP deixa passar o Supabase e bloqueia o resto, e o
`.ics` descarrega com 8 prazos.

## O que recusei mudar, e porquê

| Pedido implícito | Decisão | Razão |
|---|---|---|
| Reescrever a arquitetura | Recusado | O snapshot puro e os checks são o melhor do projeto. Uma reescrita trocava conhecimento validado por código novo sem testes. |
| Redesenhar a UI | Recusado | O "papel e tinta" está decidido e documentado (V3.md), e foi validado contigo página a página. Corrigi só defeitos visíveis. |
| Migrar a ficha da fração para tokens | Recusado | As escalas da V1 já estão redefinidas no `@theme`: seriam 800 linhas mexidas sem mudança visível. A minha primeira análise dizia que lá havia "verde de ok"; estava errada, e está corrigida no ANALISE.md. |
| Transação SQL para a atualização de renda, CHECKs na BD | Recusado nesta ronda | Uma migração colada no SQL Editor não se desfaz com `git checkout`, e a condição era poder voltar atrás num comando. A compensação na app e as guardas cobrem o caso. |
| zod, Jest, Playwright, ORM | Recusado | São dependências novas para problemas que meia dúzia de guardas e os `*.check.ts` resolvem (regra do CLAUDE.md). |
| CSP com nonce | Adiado | Obrigaria o middleware a gerar um nonce e todas as páginas a propagá-lo. Com páginas todas dinâmicas e o React a escapar tudo, o ganho é pequeno; fica `'unsafe-inline'` em script, documentado. |
| Dissolver o `forms.tsx` | Adiado | Já está planeado (PLANO.md §10.7) e é trabalho de UX para fazer contigo. |
| Conciliação bancária, emissão automática de recibos | Não reaberto | Recusados por ti em julho. |

## Próximos passos fora do meu alcance

1. **Olhar para isto e decidir.** `npm run dev` neste ramo mostra tudo. Se gostares, o caminho é o
   de sempre: merge para `main` e "faz deploy".
2. **Preencher a data de fim dos contratos ativos** (0 de 42). Desbloqueia os prazos de oposição à
   renovação, a agenda de fins de contrato e dois geradores que hoje estão mortos.
3. **Ver se o cron do INE corre.** A tabela só tem 2026T1. Com o `fetched_at` corrigido, o painel
   do Admin passa a dizer a verdade a partir do próximo refresh; a forma rápida é carregar em
   "Atualizar do INE agora".
4. **Pôr o `CRON_SECRET` também em Preview** (ou desligar o cron lá), por coerência.
5. Recomendações do PLANO.md §13 que continuam válidas e pedem schema ou serviços externos:
   RLS por senhorio, digest mensal por email, função SQL transacional para a atualização de renda.
