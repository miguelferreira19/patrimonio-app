# PLANO_REMODELACAO.md: o que esta ronda muda, e porquê

Nota sobre o nome: o pedido era um `PLANO.md`, mas esse ficheiro já existe e é a fonte de
verdade do projeto (com o Apêndice A, que "nunca se apaga"). Escrever por cima dele destruía
conhecimento comprado com erros. Este plano vive à parte.

## Regras desta ronda

1. **Reversível num comando.** Tudo vive no ramo `remodelacao-2026-10`; `main` fica intacto.
   Para voltar atrás basta `git checkout main`, e o ramo pode apagar-se sem deixar rasto.
2. **Zero alterações de schema.** Uma migração colada no SQL Editor não se desfaz com git. O
   que pedia schema (CHECKs na BD, uma função transacional para a renda) foi resolvido na
   aplicação ou fica no relatório como recomendação.
3. **Zero dependências novas.** Nada de zod, Jest ou ORM: a validação são meia dúzia de guardas
   e os testes continuam nos `*.check.ts`.
4. **Sem deploy.** Produção não muda até o utilizador olhar para isto e decidir.
5. **Gates verdes em cada commit**: `tsc`, `npm run check` e `npm run build`. Um commit por tema.

## Ordem de execução (do achado mais caro para o mais barato)

| # | Tema | Achados | Porquê nesta ordem |
|---|------|---------|--------------------|
| 1 | Falhar alto em vez de mentir | C1, A5 | Um erro do Supabase não pode virar uma carteira vazia, sobretudo no Anexo F e no import. Primeiro o `error.tsx`, para lançar ter onde cair; depois um helper `dados()` aplicado na raiz de cada leitura. |
| 2 | Escritas que não ficam a meio | C2, C3, C4, A6 | Titulares com upsert e depois poda; renda com compensação; upload que nunca escreve por cima; guardas de entrada nas actions. |
| 3 | Benchmarks sem o corte das 1000 | A1 | A ficha lê só os territórios da fração; o seletor e o painel INE paginam. |
| 4 | Perímetro | A2, A3, A4 | Cron que falha fechado e compara em tempo constante; CSP e cabeçalhos; o núcleo do INE sai do ficheiro `"use server"`. |
| 5 | Desempenho e relógio | M1, M2, M4 | `getSession` em `cache()`; servidor em hora de Lisboa; o gate de checks numa compilação só. |
| 6 | Ficha da fração em papel e tinta | M3 | Tokens semânticos, sem verde de ok. Mesma estrutura, mesmos dados. |
| 7 | Agenda de prazos e .ics | Oportunidade 1, M5 | Módulo puro com check; secção no Início; ficheiro .ics para o calendário. E diz em voz alta que nenhum contrato ativo tem data de fim. |
| 8 | Revisão hostil | todos | Um revisor independente sobre o diff inteiro, e corrigir o que encontrar. |

## O que fica de fora de propósito
- **Reescrever as páginas ou mudar o paradigma da V2/V3**: o design está decidido e documentado em
  V3.md, e foi validado pelo utilizador página a página.
- **Dissolver o `forms.tsx`**: já está planeado (§10.7) e é trabalho de UX com o utilizador presente.
- **RLS por senhorio e digest por email**: dependem de schema ou de um serviço externo (ver ANALISE.md).
