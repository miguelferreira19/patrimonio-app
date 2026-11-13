# Património · gestão de arrendamentos da família

App para gerir o património de arrendamento da família: frações, contratos, rendas e despesas, tudo num só sítio.

## Estado (novembro de 2026)

Cinco destinos: **Início**, **Rendas**, **Imóveis**, **Finanças** e **Mais**. A ficha do inquilino
junta estado, meses, diário e escada de cartas. Finanças reúne Resultado, Impostos, Calendário
e Poupança, na direção visual C "Sinal".

Papéis: **admin** administra e consulta o Controlo de emissão; **gestor** regista pagamentos,
contactos, promessas e casos; **viewer** só consulta. Permissões validadas no servidor por ação.

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
src/app/(app)/       Início (page.tsx), rendas, inquilinos/[chave], imoveis, fracoes/[id],
                     financas, mais, cartas, controlo e admin. Rotas antigas redirecionam.
src/app/login/       página e formulário de login
src/components/      ui, folhas, formulários, charts, kit/ (Bloco, Tira, Pilulas, Linha, Barra),
                     faixa/ (grelha mensal única), inicio/, inquilino/, imoveis/, financas/
src/lib/             cálculos de negócio, cada um com o seu *.check.ts: arrears, calc, irs,
                     monthcell, rent, health, ine, format, parse
src/lib/portfolio/   o snapshot: load (o único I/O), snapshot, insights, risk, ano
src/lib/actions/     Server Actions (crud, importar, import, market, insights)
supabase/            schema.sql (idempotente) e seed_demo.sql (dados fictícios)
```

## Testes

`npm run check` compila e corre os self-checks de `src/lib/**/*.check.ts` e depois descobre e
executa todos os `src/components/**/*.check.cjs`, em processos separados. Usam dados sintéticos,
sem base de dados, rede ou framework de testes. `npx tsc --noEmit` valida os tipos da app.
O build de produção é um gate antes do deploy, com o servidor de desenvolvimento parado.
Para checks em paralelo com `CHECK_DIR`, consultar [`CLAUDE.md`](CLAUDE.md).

## Roteiro e histórico

Roteiro ativo: [spec da reforma](docs/superpowers/specs/2026-11-11-reforma-design.md).
Domínio e pendências: [`PLANO.md`](PLANO.md), Apêndices A e B.
Planos anteriores: [clareza](docs/historico/PLANO_CLAREZA.md),
[auditoria de clareza](docs/historico/AUDITORIA_CLAREZA.md),
[visual](docs/historico/PLANO_VISUAL.md) e
[visual do resultado](docs/historico/PLANO_VISUAL_RESULTADO.md).
