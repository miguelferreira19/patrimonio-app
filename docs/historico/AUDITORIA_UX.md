# Usabilidade e acabamento · 9 de outubro de 2026

Objetivo: tornar a carteira fácil de consultar, perceber e corrigir, preservando os quatro destinos e o sistema visual V4. Análise transversal da arquitetura, páginas e componentes e inspeção autenticada em produção. Os números e regras fiscais mantêm os motores existentes.

## Plano de execução

| Prioridade | Problema observado | Aplicação |
|---|---|---|
| P1 | Hoje soma importações em falta, renda e perda esperada como «em jogo» | Retirar o total sem unidade económica comum; identificar a natureza de cada valor e a confiança |
| P1 | Atrasos e dados desconhecidos obrigam a procurar noutras páginas | Ligar os indicadores ao filtro correspondente; filtro de recibos parados independente do atraso |
| P1 | Pesquisa sem recuperação, nome acessível ou botão de fechar | Estado de carregamento, nova tentativa, teclado e seleção com identificação acessível |
| P1 | Formulários com etiquetas separadas dos campos | Associar as etiquetas nas primitivas; tamanho de toque e foco consistentes |
| P2 | Escolher ano ou senhorio abandona os separadores de Dinheiro | Preservar contexto no URL e acrescentar orientação da secção |
| P2 | Saúde dos dados escondida e sem filtro por gravidade | Acesso visível e filtros partilháveis; ocorrências com próximo passo |
| P2 | Arquivo sem contagem filtrada nem recuperação do vazio | Pesquisa identificada, limpar filtros, ligação de descarga explícita |
| P2 | Folhas sem nome acessível e permanecem abertas após navegação | Título associado, fechar ao navegar, fundo sem scroll e foco devolvido |
| P2 | Animações SVG por defeito e sombras inconsistentes | Gráficos estáveis; entrada curta por destino, toque e reduced-motion respeitados |
| P2 | Marca detalhada perde definição em 24 px | Símbolo vetorial simples, variantes PWA, máscara e Apple |
| P2 | Impressão usa variáveis antigas e deixa o cabeçalho móvel | Tokens corretos no papel e elementos de navegação fora da impressão |

## Validação

Obrigatória: build, todos os self-checks, revisão autenticada de Hoje, Imóveis, Dinheiro, Arquivo e Saúde em computador e telemóvel; pesquisa e folhas por teclado. Não alterar schema nem importar dados para executar esta tarefa.

O fecho deste documento regista os testes efetivamente executados e limitações, sem os confundir com o plano.
## Resultado executado

- As onze frentes do plano foram aplicadas. Na revisão visual final corrigiram-se ainda o scroll vertical nos separadores, o contraste das unidades monetárias e a identificação de frações em Saúde, Mercado e Análise. Uma fração fora da carteira corrente já não é automaticamente apresentada como terreno.
- `npm run build`: verde. `npm run check`: 25 módulos verdes, incluindo os novos casos que provam que atraso e recibos parados podem coexistir no mesmo prédio.
- Detector Impeccable nos ficheiros de UI alterados: sem ocorrências. É uma verificação mecânica, não uma certificação de acessibilidade.
- Validação autenticada em produção, com dados reais, a 1440 px e 375 px: Hoje, Imóveis, IRS, Análise, Mercado, Arquivo e Saúde. Sem transbordo horizontal nas superfícies testadas.
- Confirmados: pesquisa com setas e Enter; Ctrl K no telemóvel; filtro de recibos parados; filtro de gravidade; selecionar ano sem abandonar Dinheiro; contagem de documentos, vazio de pesquisa e limpar filtros; abrir e fechar ajuda e formulário; etiquetas dos campos do formulário de fração.
- Console do browser: sem avisos ou erros durante os percursos verificados.
- A revisão abrange a UI e as leituras. Não foram submetidas gravações, apagamentos, importações ou declarações fiscais. Tema claro, impressão e reduced-motion foram revistos no código; não foram ensaiados num dispositivo físico ou em impressora. A sessão visual usou o tema escuro do browser.

## Ações do utilizador

Nenhuma ação obrigatória para esta atualização. As ocorrências da página Verificar dados continuam a exigir confirmação documental ou correção pelo administrador; esta intervenção não alterou os dados da carteira.

## Ficheiros alterados
- `AUDITORIA_UX.md`
- `CLAUDE.md`
- `PLANO.md`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-512.png`
- `public/manifest.json`
- `public/marca.svg`
- `scripts/gerar-icons.cjs`
- `src/app/(app)/analise/page.tsx`
- `src/app/(app)/ano/[ano]/page.tsx`
- `src/app/(app)/arquivo/page.tsx`
- `src/app/(app)/dinheiro/page.tsx`
- `src/app/(app)/error.tsx`
- `src/app/(app)/fracoes/[id]/page.tsx`
- `src/app/(app)/imoveis/[chave]/page.tsx`
- `src/app/(app)/imoveis/page.tsx`
- `src/app/(app)/loading.tsx`
- `src/app/(app)/mercado/page.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/saude/page.tsx`
- `src/app/apple-icon.png`
- `src/app/globals.css`
- `src/app/icon.png`
- `src/app/login/login-form.tsx`
- `src/app/login/page.tsx`
- `src/components/ajuda.tsx`
- `src/components/charts.tsx`
- `src/components/documentos/arquivo-lista.tsx`
- `src/components/documentos/carregar.tsx`
- `src/components/folha.tsx`
- `src/components/forms.tsx`
- `src/components/hoje/cartao-mes.tsx`
- `src/components/imoveis/cartao-predio.tsx`
- `src/components/kit/cobertura.tsx`
- `src/components/kit/lede.tsx`
- `src/components/kit/seccao.tsx`
- `src/components/modal.tsx`
- `src/components/pesquisa.tsx`
- `src/components/shell.tsx`
- `src/components/ui.tsx`
- `src/lib/portfolio/ano.ts`
- `src/lib/portfolio/imoveis.check.ts`
- `src/lib/portfolio/imoveis.ts`


## Publicação

- Produção confirmada: https://patrimonio-app-beryl.vercel.app
- Deploy final READY: `dpl_ANfcLB956Kmrp6auzdPctDJa6s2S`.
- CLI com a equipa explícita: `npx vercel@latest deploy --prod --yes --scope miguel-ferreira-s-projects`. A primeira tentativa sem scope foi recusada; a conta e o projeto foram verificados antes da repetição.
- Confirmação da versão final no browser: separadores com `overflow-y: hidden`, unidades monetárias com opacidade 0,85, sem transbordo horizontal nem avisos ou erros no console.
