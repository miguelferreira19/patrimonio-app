# PLANO_VISUAL.md — movimento e acabamento visual

Escrito a 2026-10-30 (manhã) para implementar **depois das 14h**. Não está implementado nada.
Ler com CLAUDE.md (secção "Design system banca calma"). Este plano respeita-o: **mais vida, mesma calma**.

## Ponto de partida (o que já existe, não refazer)
- Tokens de tempo/curva em `globals.css` (`--t-instant 90ms … --t-count 420ms`, `--e-out/--e-in-out/--e-in`).
- Keyframes: `rise`, `page-in`, `modal-in`, `sheet-in`, `menu-in`, `overlay-in`. Reduced-motion global
  (corta `animation-duration`/`transition-duration` a 1ms).
- Botões: `active:scale-[0.99]` e anel de foco. Menu/modais/folhas já animam.

## Lacunas encontradas (é aqui que está o ganho)
1. `page-in` só desloca 4 px, sem opacidade: a mudança de página é quase impercetível (`shell.tsx:114`).
2. `animate-rise` está usado em **1** sítio; listas e cartões entram todos de uma vez, sem cascata.
3. **Todos** os gráficos Recharts têm `isAnimationActive={false}` (`charts.tsx:169-352`): aparecem a seco.
4. `--t-count` existe mas não há nenhum contador; `Money` é server component (sem hooks, de propósito).
5. Há um único `loading.tsx` (raiz de `(app)`); sem esqueletos com a forma da página final.
6. Hover de cartão só em 1 sítio (`ui.tsx:328`); cartões-link (`cartao-predio`, tiles do Hoje) não reagem.
7. Barras (atrasos, rentabilidade) e a faixa de 12 meses aparecem de uma vez, sem entrada.

## Regras que limitam o plano (CLAUDE.md, não negociáveis)
- Movimento **≤ 420 ms, sem loops** → **sem shimmer** nos esqueletos (é um loop); blocos `bg-vellum` estáticos.
- **Sem dependências novas** → nada de framer-motion/GSAP. CSS primeiro; JS só onde CSS não chega.
- `ui.tsx` e `kit/` **sem `"use client"`** → componentes com hooks vão para ficheiro próprio.
- Só `transform` e `opacity` (compositor); nunca animar `width/height/margin`.
- Sem emojis, sem gradientes néon, sem "—" na UI. Cor continua semântica (tinta/acao/atencao/perda/futuro).

## Armadilhas já identificadas (apanhar à primeira)
- **Stagger + reduced-motion:** o `animation-delay` NÃO é cortado pela regra global (só a duração). Com
  `both` o item fica invisível durante o atraso. Acrescentar `animation-delay: 0s !important` no bloco
  reduced-motion, e `@media print { * { animation: none !important } }`.
- **Contador:** se contar de 0 a partir do HTML do servidor, o valor final pisca antes de cair a 0.
  Arrancar a ~90% do valor (subtil, e combina com "banca calma"), ou saltar este item.
- **Next 15 e View Transitions:** `@view-transition` só serve navegação entre documentos, não a SPA do
  App Router; `experimental.viewTransition` depende de React canary. **Fora de âmbito.**
- Nunca `npm run build` com o dev ligado: parar dev, apagar `.next`, voltar a arrancar.

---

## Bloco A — fundação de movimento (S, maior retorno; fazer sempre)
Só CSS + 3 retoques. Tudo num commit.
1. `globals.css`: `page-in` passa a `opacity 0→1` + `translateY(6px)`; nova utilidade `.stagger > *`
   com `animation: rise var(--t-slow) var(--e-out) both; animation-delay: calc(min(var(--i,0),8) * 32ms)`
   (o índice vem de `style={{"--i": n}}`, funciona em server components). Regras de reduced-motion/print acima.
2. `.cartao-link`: `transition: transform/border-color var(--t-fast)`, hover `translateY(-1px)` + régua forte,
   `active:` volta a 0. Aplicar a `cartao-predio`, tiles do Hoje, linhas clicáveis de Cobranças. Anel de foco igual ao dos botões.
3. `.barra-cresce`: `scaleX(0→1)`, `transform-origin: left`, `--t-slow`. Aplicar às barras de atraso (Cobranças) e de rentabilidade.
4. `charts.tsx`: ligar `isAnimationActive` com `animationDuration={420}` e `easing ease-out`, **desligado** quando
   `prefers-reduced-motion` (hook `useReducedMotion` num ficheiro próprio, `matchMedia`). Só na 1.ª montagem.
5. Navegação: transição de cor + barra de 2 px (`scaleY`) no item ativo da sidebar; no tab bar do telemóvel,
   rótulo a peso 600 e ícone cheio no ativo (`shell.tsx:80,128`).

**Pronto quando:** Hoje, Cobranças e Imóveis entram em cascata; gráficos desenham-se uma vez; `npm run build` e
`npm run check` verdes; com reduced-motion tudo aparece instantâneo (testar com emulação, incluindo o stagger).

## Bloco B — assinatura da app (M)
1. **Faixa dos 12 meses** (`faixa/faixa.tsx`, `celula.tsx`): cascata por coluna, 18 ms por célula, total < 420 ms,
   uma vez. É o elemento mais característico da app, por isso merece o cuidado.
2. **Esqueletos com a forma final** em `loading.tsx` de Hoje, Cobranças, Imóveis, Rentabilidade: caixas estáticas
   `bg-vellum`, mesmas alturas que o conteúdo real (evita salto de layout, CLS < 0.1).
3. *(Opcional, menor valor/custo)* `MoneyAnimado` em ficheiro `"use client"` próprio, só para os 2-3 números herói
   (Hoje, Rentabilidade). Nunca em tabelas. Contador por `ref.textContent` + rAF, sem re-renders.

## Bloco C — acabamento visual sem movimento (M)
Antes de mexer: **screenshots de base** (Hoje, Cobranças, Imóveis, Rentabilidade, Impostos; desktop 1280, mobile 375,
claro e escuro) para decidir pelo que se vê, não pelo que se supõe.
1. **Hierarquia:** um só "cartão destaque" por página (fundo `vellum` + régua forte) para a coisa principal; o resto
   fica em cartões de hairline. Hoje todos pesam o mesmo.
2. **Ritmo vertical:** uma escala única de espaço entre secções (token `--space-secao`) em vez de margens avulsas.
3. **Modo escuro:** auditar contraste dos tons "ténue" (o `zinc-400` mede ~2,8:1 no claro) e das hachuras.
4. **Estados vazios e "tudo em dia":** momento tipográfico calmo (número + uma frase), sem ilustrações.
5. **Telemóvel:** alvos ≥ 44 px, zona do polegar para ações primárias, `safe-area` no tab bar (já existe; verificar).
6. Ícones lucide com `strokeWidth` uniforme; varrer `focus-visible` em links e cartões.

## Verificação (fim de cada bloco)
`npm run build` + `npm run check` verdes → dev (porta 3000, só leitura na BD de produção) → ver cada página alterada em
desktop, 375 px, escuro e com reduced-motion → `read_console_messages` limpo. **Sem commit nem deploy sem pedido
explícito** (o pedido de deploy inclui o git).

## Se os tokens acabarem a meio
A ordem acima é por retorno/custo: A sozinho já muda a sensação da app. Cada bloco termina verde e comitável por
si, por isso parar entre blocos nunca deixa a app a meio.

## Não fazer
framer-motion/GSAP, shimmer ou qualquer loop, parallax, transições de ecrã inteiro, animar números em tabelas,
gradientes de cor, reescrever `ui.tsx` como client.
