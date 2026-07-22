# Handoff: Redesign visual do Património (Dashboard, Atrasos, Frações)

## Overview
Novo visual para a app "Património — gestão de arrendamentos da família" (Next.js 15 App Router · TypeScript · Supabase · Tailwind v4 · Recharts). Mantém a lógica de negócio e os dados atuais; muda só a camada de apresentação de três páginas: Dashboard, Atrasos e Frações. Objetivo: aspeto mais apelativo e intuitivo, PC e telemóvel, para apresentar a um stakeholder não-técnico.

## About the Design Files
Os ficheiros `.dc.html` nesta pasta são **referências de design em HTML** — protótipos do aspeto e comportamento pretendidos, NÃO código de produção para colar. Foram gerados numa ferramenta de design (usam um runtime próprio "DCLogic" + `support.js` e estilos inline). A tarefa é **recriar estes ecrãs no codebase Next.js existente**, reutilizando os componentes e padrões já lá (`src/components/ui.tsx`, `src/components/charts.tsx`, `src/components/nav.tsx`), NÃO importar o HTML. Os dados fictícios nos ficheiros são só ilustrativos — liga tudo às queries Supabase que já existem em cada `page.tsx`.

## Fidelity
**High-fidelity.** Cores, tipografia, espaçamento e interações são finais. Recria pixel-perfeito com Tailwind + os componentes existentes.

## Design Tokens
Fonte: **Geist** (sans) e **Geist Mono** (números/monospace) — já configuradas em `src/app/layout.tsx`.
Cores:
- Fundo app (main): `#fafafa` (zinc-50). Superfície de cartão: `#ffffff`.
- Texto: base `#18181b` (zinc-900), secundário `#71717a` (zinc-500), ténue `#a1a1aa` (zinc-400), micro-label `#c4c4c8`.
- Sidebar: fundo `#09090b` (zinc-950); label de grupo `#52525b`; item inativo `#a1a1aa`; item ativo texto `#fff` com `background: rgba(255,255,255,.07)` e barra ativa `inset 2px 0 0 #2dd4bf` (teal-400).
- Acento primário (marca): **teal `#0f766e`** (teal-800/700 da app). Hover link `#115e59`. Logo/realces teal-300/400 `#5eead4`/`#2dd4bf`.
- Estados: verde `#0ca30c` / `#047857`, âmbar `#fab219` / `#b45309`, vermelho `#d03b3b` / `#b91c1c`. Backgrounds de badge: verde `#ecfdf5`, âmbar `#fef7e6`, vermelho `#fef2f2`, zinc `#f4f4f5`, teal `#f0fdfa`.
- Gráfico: recebido/bruto = acento; líquido = acento a 42% opacidade (barras) ou linha; despesas (só dashboard antigo) `#a1a1aa`; linha "esperado" tracejada `#a1a1aa` dash `4 3`; grelha `#f1f1f3`.
Raio: cartões `14px`; botões/inputs `10px`; badges `999px`; barras de gráfico `3px`. Sombra cartão: `0 1px 2px rgba(0,0,0,.04)`; hover KPI: `0 8px 24px -8px rgba(0,0,0,.14)` + `translateY(-2px)`. Botão primário: `0 6px 16px -6px rgba(0,0,0,.35)`.
Tipografia: h1 hero `30px/1.1 600 -.02em`; eyebrow `12px 500 .06em uppercase` cor acento; valor KPI `27px 600 -.02em` tabular-nums; label KPI `11px 500 .04em uppercase #71717a`; título de cartão `14px 600`; TH tabela `11px 500 .03em uppercase #a1a1aa`; célula `13px`.
Layout global: grid `248px | 1fr`. Main `max-width:1360px`, padding `32px 36px 64px` (desktop) / `16px` (mobile). Sidebar sticky full-height. Responsivo: <900px esconde o rail (mostra topbar preta 56px com hambúrguer), KPIs 2 col (→1 col <560px), tabelas viram cartões empilhados.

## Sidebar / Nav (comum às 3 páginas — usar o `AppNav` existente)
Grupos e itens já existem em `src/components/nav.tsx` (Visão geral: Dashboard; Gestão: Frações, Pagamentos, Atrasos, Despesas; Referência: Mercado, Senhorios, Saúde; Admin). Ícones lucide-react: LayoutDashboard, Building2, HandCoins, CalendarClock, ReceiptText, TrendingUp, Users, Stethoscope, Settings. Rodapé: email + badge de role + Sair. O redesign NÃO altera a estrutura do nav; só confirma o estilo (barra ativa teal, hover `rgba(255,255,255,.04-.06)`).

## Screens

### 1. Dashboard  (src/app/(app)/page.tsx)
- **Hero**: eyebrow com o mês (`monthLabel(currentMonthKey())`, cor acento) · h1 "Bom dia, <nome>" (ou "Dashboard") · parágrafo-resumo em linguagem natural derivado dos números do mês (taxa de cobrança, nº de atrasos, recibos por emitir). À direita: botão outline "Exportar" + botão primário teal "+ Novo pagamento". Empilha em mobile.
- **5 KPIs** (grid 5→3→2→1): Recebido este mês (tom por `collectionTone`), Rendas em falta (link p/ /atrasos, vermelho se >0), Lucro do mês (teal), Potencial de mercado (âmbar), Ocupação (link p/ /fracoes). Cada card: label uppercase, ícone lucide em caixa 32px arredondada com bg suave da cor, valor 27px tabular-nums, sub 12px. Reaproveitar `StatCard` de `ui.tsx` (já tem label/value/sub/tone/icon) — só actualizar o wrapper para radius 14px, hover-lift e a caixa de ícone colorida por tom.
- **Card "Este mês: recibos por emitir"**: header com subtítulo + link externo ao Portal das Finanças; grelha 2 col de cartõezinhos (nome fração link, inquilino, renda tabular, nº PF mono). EmptyState `CheckCircle2` quando vazio.
- **Card "Últimos 12 meses"**: gráfico composto (`MonthlyFlowChart` em `charts.tsx`, Recharts) — barras Recebido (acento) + Líquido (acento translúcido), linha tracejada Esperado; eixo € com grelha hairline; legenda em linha (Bruto / Líquido / Esperado). Por baixo, "Taxa de cobrança mensal" (`CollectionRateChart`): barras coloridas por estado (≥100% verde, 80–99% âmbar, <80% vermelho) COM rótulo do mês por baixo de cada barra e legenda de estados. NOTA de mudança pedida pelo cliente: no gráfico principal comparar **Bruto vs Líquido** (retirar a série "Despesas"); e a taxa de cobrança tem de ter **rótulos de mês**.
- **2 cartões lado-a-lado**: "Rendas em atraso" (tabela: Fração, Inquilino, Meses, Dívida vermelha; cartões em mobile) e "Mais abaixo do mercado" (Fração, Desvio via `DeviationBadge`, Potencial/mês âmbar). EmptyStates como no original.
- Rodapé: links "Mercado" e "Pagamentos".

### 2. Atrasos  (src/app/(app)/atrasos/page.tsx + arrears-client.tsx)
- Hero: eyebrow "Cobrança", h1 "Rendas em atraso", resumo (nº contratos em atraso + renda mensal em risco, vindo de `summary`), botão primário "Registar pagamento".
- **4 KPIs**: Contratos em atraso (vermelho), Dívida estimada (vermelho, `summary.totalDebt`), Renda em risco (âmbar, `summary.rentAtRisk`), Taxa de cobrança 12m.
- **Card gráfico** "Recebido vs. esperado — 12 meses": `ArrearsFlowChart` existente (barras recebido acento + linha tracejada esperado).
- **Tabela "Contratos em atraso"**: Fração(link) · Inquilino · Último pago · Meses · Dívida (vermelha) · Estado (badge: Crítico=vermelho / Em atraso=âmbar). Deriva de `computeArrears`. Mobile: cartões.

### 3. Frações  (src/app/(app)/fracoes/page.tsx + properties-table.tsx)
- Hero: eyebrow "Portefólio", h1 "Frações", resumo (nº frações + arrendadas + ocupação + €/m² vs mediana), botão primário "+ Nova fração" (só admin — condicionar como o `PropertyFormButton` atual).
- **4 KPIs**: Total de frações, Arrendadas, Ocupação %, €/m² médio (âmbar com desvio).
- **Card com filtros** (input de procura com ícone lupa + select senhorios + select estado) — igual à lógica `useState`/`useMemo` do `PropertiesTable` atual.
- **Tabela** (colunas: Fração, Freguesia, Tipol., Área, Senhorios, Inquilino, Renda, €/m², Vs. mercado [`DeviationBadge`], Estado [badge]). Cabeçalho sticky. Mobile: um cartão por fração com grelha 2×2 de campos. Reaproveitar `PropertiesTable` — só re-estilar (radius 14px, header de filtros, mesma tabela).

## Interactions & Behavior
- Hover KPI: sobe 2px + sombra. Hover linha de tabela: bg `#fafafa`. Hover link: teal escuro. Botões: `active:scale-.99`, focus ring teal (manter o do `Button` existente).
- Entrada: hero com fade-up 0.5s; barras de gráfico com `scaleY` 0→1 0.6s (opcional; Recharts já anima).
- Navegação: itens da sidebar levam às rotas reais; KPIs "Rendas em falta"→/atrasos, "Ocupação"→/fracoes.
- Responsivo: ver breakpoints em Design Tokens.

## State Management
Sem novo estado global. Mantém: server components que fazem `await` às queries Supabase (properties, contracts, landlords, market_benchmarks, payments paginados via `fetchAllPayments`, expenses, receipts) e passam para os client components. Filtros de Frações em `useState` local (já existe). Gráficos são client components (Recharts).

## Implementação sugerida (para o Vercel)
1. Ramo novo a partir de `main`.
2. Aplicar o restyle em `ui.tsx` (StatCard/Card: radius 14, hover-lift, caixa de ícone por tom) e `charts.tsx` (dashboard: Bruto vs Líquido; rate chart com labels de mês) — mudanças partilhadas pelas 3 páginas.
3. Ajustar os 3 `page.tsx`/client components: adicionar o bloco hero (eyebrow + h1 + resumo + ações) acima dos KPIs; manter todo o data-fetching.
4. `npm run build` local, commit, push → PR → merge → deploy automático Vercel. Sem migrações Supabase.

## Files
- `Dashboard.dc.html`, `Atrasos.dc.html`, `Fracoes.dc.html` — protótipos de referência (abrir em browser para ver o alvo).
- No repo: `src/app/(app)/page.tsx`, `.../atrasos/{page.tsx,arrears-client.tsx}`, `.../fracoes/{page.tsx,properties-table.tsx}`, `src/components/{ui.tsx,charts.tsx,nav.tsx}`, `src/lib/format.ts`.
