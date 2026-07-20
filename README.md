# Património — gestão de arrendamentos da família

App para gerir o património de arrendamento da família: frações, contratos, rendas e despesas, tudo num só sítio.

## O que faz

- **Rent roll + pagamentos** — grelha mensal por contrato, com rendas em falta e taxa de cobrança.
- **Despesas e lucro** — IMI, condomínio, seguros, obras e financiamento, por fração e por senhorio.
- **Benchmarks de mercado (INE)** — compara as rendas atuais com as medianas €/m² por freguesia, e estima o valor de cada fração.
- **Import do Portal das Finanças** — importa os recibos de renda exportados do Portal e cria frações/contratos automaticamente.
- **Multi-senhorio com quotas** — reparte rendimentos e despesas por titular (compropriedade), como base para o IRS de cada um.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript · Supabase (Postgres + Auth + RLS) · Tailwind CSS v4 · Recharts.

## Como arrancar

Ver [`SETUP.md`](SETUP.md) para os passos completos (criar o Supabase, correr o schema, criar utilizador, etc.).

Depois de configurado, duplo clique em [`start.cmd`](start.cmd) para arrancar em modo de desenvolvimento (`http://localhost:3000`).

## Estrutura de pastas

```
src/app/(app)/       páginas autenticadas: dashboard, fracoes, pagamentos, despesas, mercado, senhorios, admin
src/app/login/       página e formulário de login
src/components/      componentes partilhados (ui, forms, nav, charts, setup-notice)
src/lib/             tipos, formatação, cálculos de negócio, parsing, ficha técnica INE
src/lib/actions/     Server Actions (crud, import, market)
src/lib/supabase/    clientes Supabase (browser e servidor)
supabase/            schema.sql (idempotente) e seed_demo.sql (dados fictícios)
```

## Roadmap

- Conciliação automática com extrato bancário.
- Contratos com alertas de atualização anual de renda (coeficiente legal).
- Exportação para IRS — Anexo F.
- Arquivo de documentos por fração/contrato.
