# Património — gestão de arrendamentos da família

App para gerir o património de arrendamento da família: frações, contratos, rendas e despesas, tudo num só sítio.

## O que faz

Três superfícies, não um menu de nove páginas:

- **Agora** — o que está a acontecer e o que decidir hoje, com cada decisão avaliada em euros por ano.
- **Carteira** — uma faixa com uma linha por fração e o tempo para a direita, lida por lentes
  (cobrança, renda, mercado, risco, vazios). A altura de cada célula é a fração da renda recebida.
- **Ano** — o documento fiscal: rendas, despesas dedutíveis, escolha entre englobamento e taxa
  autónoma, art. 72.º, AIMI e o quadro 4.1 do Anexo F. Imprime-se.

Por baixo: import dos recibos do Portal das Finanças com diff antes de escrever, benchmarks de renda
e venda do INE, modelo de risco de crédito por contrato (PD bayesiana, curva de cura, estágios IFRS 9)
e multi-senhorio com quotas para repartir o IRS por titular.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript · Supabase (Postgres + Auth + RLS) · Tailwind CSS v4 · Recharts.

## Como arrancar

Ver [`SETUP.md`](SETUP.md) para os passos completos (criar o Supabase, correr o schema, criar utilizador, etc.).

Depois de configurado, duplo clique em [`start.cmd`](start.cmd) para arrancar em modo de desenvolvimento (`http://localhost:3000`).

## Estrutura de pastas

```
src/app/(app)/       Agora (page.tsx), carteira, ano/[ano], fracoes/[id], carta/[contractId],
                     mercado, senhorios, saude, admin. As rotas antigas (pagamentos, atrasos,
                     fracoes, despesas, irs) são redirects para a lente equivalente.
src/app/login/       página e formulário de login
src/components/      ui, modal, nav, forms, charts + kit/ (Money, Lede, Confianca, Cobertura),
                     faixa/ (a grelha mensal, implementação única), agora/, ano/, importar/
src/lib/             cálculos de negócio, cada um com o seu *.check.ts: arrears, calc, irs,
                     monthcell, rent, health, ine, format, parse
src/lib/portfolio/   o snapshot: load (o único I/O), snapshot, insights, risk, ano
src/lib/actions/     Server Actions (crud, importar, import, market, insights)
supabase/            schema.sql (idempotente) e seed_demo.sql (dados fictícios)
```

## Testes

`npm run check` corre os self-checks puros de cada módulo de cálculo (sem base de dados e sem
framework de testes). `npm run build` é o gate antes de qualquer deploy. Ambos correm em CI a cada
push para `main`.

## Roadmap

- Conciliação automática com extrato bancário.
- Projeção de cashflow a 24 meses e recomendações de carteira (superfície `/analise`).
- Arquivo de documentos por fração/contrato.
