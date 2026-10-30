# PLANO_VISUAL — resultado (2026-10-30)

## Direção: "banca calma, viva"
Mais vida, mesma calma. Uma só gramática de movimento: o que entra **sobe 8px e aparece** em
cascata curta (35ms por bloco, máx. 160ms de atraso); o que é **quantidade cresce da origem**
(barras da esquerda, células de baixo). Tudo uma vez, no mount, só `transform`/`opacity`,
ease-out forte (`--e-out`). Acabamento: um cartão-destaque por página, estados vazios
tipográficos, navegação com indicador claro, esqueletos com a forma final.

## O que mudou
- **Fundação (`globals.css`)**: `page-in` com opacidade; utilidades `.pagina`, `.stagger`,
  `.cartao-link`, `.barra-cresce`, `.celula-in`, `.esqueleto`, `.vazio`, `.destaque`.
  Reduced-motion corta também o `animation-delay` (armadilha do stagger); `@media print`
  desliga todas as animações e transições.
- **Shell/navegação**: cascata automática de cada página (`.pagina`, reinicia por rota, não
  por separador). Sidebar: filete verde-cofre que cresce no destino ativo, ícone mais cheio.
  Telemóvel: pílula atrás do ícone ativo, rótulo a 600, alvo ≥ 44px, pressão a 0.97.
- **Hoje**: cartão do mês é o `.destaque` (régua forte + filete de tinta); a barra da cascata
  cresce; linhas dos baldes com alvo de 44px; listas "Este mês"/"A investigar" em cascata;
  "Nada para fazer" em `.vazio`. Gráfico dos meses fechados desenha-se uma vez (420ms).
- **Cobranças**: barras de dívida crescem; lista de devedores e grelha de contratos em cascata;
  as três caixas e os contratos levantam no hover; vazios em `.vazio`.
- **Imóveis**: cartões de prédio em cascata e com `.cartao-link`; quadrados dos meses entram
  coluna a coluna; ordenar com alvo de 44px no toque; vazio em `.vazio`.
- **Faixa** (Histórico mensal, ficha): células entram da esquerda para a direita (6ms/coluna).
- **Rentabilidade**: barras por prédio crescem; listas em cascata; gráfico da projeção anima
  uma vez. As alterações por comitar que já lá estavam foram preservadas.
- **Login**: formulário e destaques em cascata, frase do painel maior; erro numa faixa
  `perda-tenue` que entra.
- **Primitivas (`ui.tsx`, sem "use client")**: pressão dos botões 0.99 → 0.97; `EmptyState`
  sem tracejado, frase a tinta.
- **Carregamento**: `loading.tsx` com a forma do Hoje (raiz), Cobranças, Imóveis e
  Rentabilidade; blocos estáticos que só aparecem após 150ms (sem flash nem shimmer).

## Dependências novas
Nenhuma. CSS primeiro; o único JS é `use-reduced-motion.ts` (`useSyncExternalStore` +
`matchMedia`) para os gráficos Recharts.

## Verificação
- `npm run build` e `npm run check` (28 checks) verdes.
- Browser: só o `/login` foi verificável (1280 claro e pane estreito escuro; cascata a correr;
  consola só com erros de rede da Supabase). **A Supabase não resolvia por DNS nesta máquina durante a sessão**, por
  isso as páginas com dados redirecionam para o login e não foram vistas. A verificar pela
  família/administrador: Hoje, Cobranças, Imóveis, Rentabilidade, Impostos em 375px e
  escuro, e com reduced-motion ligado no sistema.

## Ficou por fazer
- Ver as superfícies com dados no browser (ver acima) e afinar o que o olho apanhar.
- `MoneyAnimado` (contador nos números herói): saltado de propósito, ganho baixo e risco de
  piscar o valor final.
- `imoveis/loading.tsx` e `cobrancas/loading.tsx` também cobrem as sub-rotas (`/imoveis/[chave]`,
  `/cobrancas/extrato`): esqueleto aproximado. Acrescentar `loading.tsx` próprios se incomodar.
- `.destaque` só no cartão do mês do Hoje; Cobranças/Imóveis/Rentabilidade ainda não o usam.
- Ficha da fração e Impostos herdam a cascata da página e a faixa, mas não tiveram retoques
  próprios.

## Como reverter
Ficheiros alterados: `src/app/globals.css`, `src/components/shell.tsx`, `src/components/ui.tsx`,
`src/components/charts.tsx`, `src/components/faixa/celula.tsx`, `src/components/faixa/faixa.tsx`,
`src/components/imoveis/meses.tsx`, `src/components/imoveis/cartao-predio.tsx`,
`src/components/hoje/cartao-mes.tsx`, `src/components/gestao/casos.tsx`,
`src/app/(app)/page.tsx`, `src/app/(app)/loading.tsx`, `src/app/(app)/cobrancas/page.tsx`,
`src/app/(app)/imoveis/page.tsx`, `src/app/(app)/arquivo/page.tsx`,
`src/app/(app)/rentabilidade/page.tsx` (só classes `stagger`/`barra-cresce`; o resto do diff
não é desta tarefa), `src/app/login/page.tsx`, `src/app/login/login-form.tsx`, `CLAUDE.md`.
Ficheiros novos (apagar): `src/components/use-reduced-motion.ts`, `src/components/esqueleto.tsx`,
`src/app/(app)/cobrancas/loading.tsx`, `src/app/(app)/imoveis/loading.tsx`,
`src/app/(app)/rentabilidade/loading.tsx`.
`git checkout -- <ficheiro>` reverte cada um, EXCETO a página de Rentabilidade (tem alterações
anteriores por comitar: retirar à mão só `stagger ` e `barra-cresce `).

---

## Segunda passagem (2026-10-30, tarde): o que se VÊ
A primeira passagem foi quase só movimento e não pôde ver as páginas com dados. Esta viu-as
(Hoje, Cobranças, Imóveis, Rentabilidade em 1280 e 375 px, claro e escuro) com dados de teste
temporários, entretanto apagados, e mudou o desenho estático:
- **Profundidade e atmosfera** (`globals.css`): luz suave no fundo (verde-cofre e ardósia, `--luz-a/b`) e
  elevação de duas camadas nos cartões (`--sombra-carta`). Uma só regra, `:where(.rounded-2xl.border.bg-carta)`,
  apanha o cartão de toda a app. Impressão: sem luz nem sombra.
- **Hoje**: número herói 44/60 px com tracking mais justo, chip de percentagem recebida, barra mais
  alta com segmentos separados; gráfico com barras de cantos 7 px e degradê de tinta (`charts.tsx`).
- **Listas de pessoas** (Hoje e Cobranças): `kit/Iniciais`, círculo neutro com as iniciais.
- `text-wrap: pretty` nos parágrafos.
- Verificado: `npm run build` e `npm run check` (28) verdes; nenhum resto do andaime de pré-visualização.
- Não vistos: Impostos e a ficha da fração (herdam as mudanças globais).
- Para reverter só esta passagem: `kit/iniciais.tsx` (apagar) e `kit/index.ts`, `kit/money.tsx` (escala hero),
  `hoje/cartao-mes.tsx`, `charts.tsx`, `cobrancas/page.tsx`, `(app)/page.tsx`, o bloco "PROFUNDIDADE E
  ATMOSFERA" do `globals.css` e a regra `.destaque`.
