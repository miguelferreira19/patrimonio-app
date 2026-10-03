# ANALISE.md: auditoria técnica de 3/10/2026

Ramo `remodelacao-2026-10`, a partir de `main` em `8446677`. Lido: middleware, clientes Supabase,
todas as server actions, as quatro rotas de API, o schema e as suas políticas, a camada de
portfólio (`load`, `index`), as páginas Início e ficha da fração, os módulos de documentos e de
import. Medido contra a base real: sessão de admin no browser e leitura direta ao PostgREST.

## Veredicto, sem paninhos quentes

Isto não é código amador, e quem pedir uma reescrita total está a pedir para estragar um sistema
que funciona. A arquitetura está certa para o problema: uma leitura por request
(`loadRaw` → `buildSnapshot` puro), 18 self-checks sobre a lógica de domínio que custou dinheiro a
acertar, regras de negócio escritas onde se lêem, e decisões registadas com o porquê. Reescrever
em ORM, trocar o Supabase, meter Jest ou zod seria trocar conhecimento validado por moda.

**Onde está fraco é na periferia**, que é onde estão sempre os bugs que custam caro: o que
acontece quando o Supabase falha, quando dois ficheiros têm o mesmo nome, quando uma escrita
fica a meio. O núcleo pensa em tudo; as bordas assumem que nada corre mal.

## Achados, por impacto

### Críticos (dados errados em silêncio, ou perda de dados)

**C1. Erros do Supabase engolidos em 56 sítios.** O padrão `(q.data ?? []) as T[]` sem olhar para
`q.error` transforma uma falha de rede, um timeout ou um 42501 numa carteira VAZIA. A falha não
aparece como erro: aparece como facto. Os sítios onde isto morde:
- `api/irs/route.ts`: o ficheiro que se entrega à AT. Se `contracts` ou `property_owners` falhar,
  sai um Anexo F sem rendas e com ar de completo. O comentário do próprio ficheiro diz "uma
  linha que escape aqui é uma renda não declarada", e protege a paginação mas não o erro.
- `actions/importar.ts`: se `properties`/`contracts` falharem no `aplicarImport`, os recibos
  entram com `property_id` e `contract_id` a `null`. Como o import só insere e deduplica por
  `receipt_number`, ficam **órfãos para sempre**: um reimport não os volta a ligar.
- `portfolio/load.ts`: a fila de decisões, a faixa, os atrasos e as projeções saem de dados
  parciais sem aviso.

**C2. `saveProperty` apaga os titulares antes de inserir os novos.** Se o insert falhar (quota
inválida, rede), a fração fica sem `property_owners`. As quotas alimentam o IRS de cada senhorio e
o AIMI. Não há transação: o delete já foi.

**C3. Upload de documentos com `upsert: true`.** Largar um segundo `contrato.pdf` na mesma fração
**substitui o primeiro sem aviso**. O bucket é o arquivo da família (contratos assinados,
cadernetas, declarações de IRS), e não há versões.

**C4. `applyRentUpdate` não é atómico.** Grava o histórico (`rent_updates`) e só depois a renda do
contrato. Se o segundo passo falhar, o histórico diz que a renda mudou e o contrato não mudou.

### Altos (bomba-relógio, superfície de ataque)

**A1. `market_benchmarks` lida sem paginação em três sítios.** A ficha da fração faz
`select("*")` à tabela inteira, e `fetchGeoOptions` (o seletor de território) e o painel INE do
Admin também. Hoje são **698 linhas** (medido: 394 freguesias + 304 concelhos, só 2026T1), por
isso ainda funciona. Assim que o cron trouxer o próximo trimestre passa das 1000, e o PostgREST
corta em silêncio. A partir daí a ficha mostra "Sem medianas do INE" e o seletor perde freguesias
sem nenhum erro. É exatamente a armadilha que o `load.ts` documenta e evita; as outras três
leituras não a evitam. E a ficha nem precisa da tabela inteira: só usa os códigos da própria fração.

**A2. O cron do INE autoriza-se a si próprio sem segredo.** `auth !== \`Bearer ${CRON_SECRET}\``:
com a variável em falta, o header `Bearer undefined` passa. Em Production a variável existe
(confirmado com `vercel env ls`), mas **não existe em Preview**, e a rota escreve com a
service-role key. Tem de falhar fechada, e a comparação deve ser em tempo constante.

**A3. Sem cabeçalhos de segurança.** O `next.config.ts` está vazio: não há CSP, `X-Frame-Options`,
`nosniff`, `Referrer-Policy` nem `Permissions-Policy`. A app mostra NIFs e rendas de inquilinos e
pode ser embebida num iframe (clickjacking).

**A4. `runIneRefresh` é exportada de um ficheiro `"use server"`.** Todas as exportações de um
módulo destes viram endpoints de action chamáveis por POST. Hoje a chamada rebenta porque o
argumento (um cliente Supabase) não é serializável, mas é superfície que não devia existir: é o
núcleo que escreve com a service-role no cron.

**A5. Sem error boundary.** Não existe `error.tsx` nem `not-found.tsx`. Qualquer exceção mostra a
página genérica do Next, em inglês, sem botão de tentar de novo. Isto é também o que torna C1
difícil de resolver bem: lançar o erro hoje dava um ecrã feio, e por isso o código prefere
engolir.

**A6. Server actions sem validação de entrada.** `rent: NaN`, `amount: -500`, `quota: 250` e datas
inválidas chegam à BD. Só o admin escreve, por isso o problema não é de segurança: é de
integridade, porque um formulário com um bug grava lixo que depois alimenta o IRS.

### Médios

**M1. Três idas ao serviço de Auth por página.** O middleware chama `getUser()`, o layout chama
`getUser()` + perfil, e a página volta a chamar `getSession()` (outra vez `getUser()` + perfil).
O `getUser()` é um pedido de rede ao Supabase Auth. Com `cache()` do React, layout e página
partilham a mesma resposta.

**M2. Fuso horário do servidor.** A Vercel corre em UTC; a app usa `new Date()` e getters locais
em dezenas de sítios para decidir "hoje" e "o mês corrente". Entre a meia-noite e a uma da manhã
de Lisboa (no verão), a app ainda vive no dia anterior. No dia 1 do mês é o mês anterior.

**M3. A ficha da fração (823 linhas) ainda é V1.** Usa `zinc/teal/emerald` em vez dos tokens
semânticos, e tem precisamente o que a regra fundadora proíbe: uma caixa **verde** com um visto a
dizer "Meses em falta: nenhum" (verde de ok), e `Badge tone="green"` para "Ativo" e "Arrendado".
É a página onde a família mais vai parar.

**M4. `npm run check` demora 73 s.** São 18 compilações `tsc` separadas, cada uma a recompilar
os mesmos módulos. Um gate lento é um gate que se salta.

**M5. Contratos ativos sem data de fim (dado, não código).** Medido: **0 de 42** contratos ativos
têm `end_date`. O gerador `contrato_a_terminar` (Agora) e o conselho `fim_de_contrato` (Análise)
nunca disparam com os dados reais, e nenhuma oposição à renovação pode ser calculada. A app não
diz isto em lado nenhum.

### Baixos (registados, não tratados)
- `lerArquivo` lista o bucket com `limit: 1000`. Ao ritmo atual, chega lá em anos.
- `forms.tsx` com 706 linhas de modais: o PLANO.md §10.7 já prevê dissolvê-lo; não é desta ronda.
- `paginateAllParallel` pode saltar uma linha se houver escrita entre a contagem e a leitura.
  Está documentado como `ponytail` e é aceitável com um único escritor.

## Oportunidades de produto

O que um líder neste nicho teria e esta app não tem, filtrado pelo que já foi recusado
(conciliação bancária, emissão automática de recibos) e pelo que os dados permitem:

1. **Agenda de prazos, exportável para o calendário do telemóvel (.ics).** IRS (abril a junho),
   prestações do IMI (maio, agosto, novembro, consoante o valor), AIMI (setembro, com o valor que
   a app já calcula por senhorio) e as datas em que cada renda fica atualizável, com o último dia
   para mandar a carta (30 dias de antecedência). A app já sabe isto tudo; falta pô-lo onde a
   família olha todos os dias, que não é esta app.
2. Digest mensal por email: já está no §13 do PLANO.md, e exige um serviço de email e mais um
   segredo. Fica como recomendação.
3. RLS por senhorio: já está no §13. É uma mudança de schema com risco de deixar a família sem
   acesso, e não cabe numa ronda que tem de poder ser revertida num comando.
