# Gestão operacional e identidade · 9 de outubro de 2026

Âmbito confirmado pelo utilizador: pontos 2 a 9, funcionalidades A a E do anexo,
e ponto 10 (identidade). Preservar a composição e a ordem das secções de Hoje.

## Plano de execução

1. Separar evidência documental e confirmação de pagamentos. Registar movimentos,
   repartir por períodos, reconciliar sem duplicação, confirmar saldos e auditar correções.
2. Reutilizar contratos, despesas, arquivo e agenda. Persistir tarefas, diligências,
   manutenção, custos associados e períodos de disponibilidade. Nenhum automatismo jurídico
   novo sem regras verificadas; prazos contratuais desconhecidos continuam desconhecidos.
3. Acrescentar consulta operacional da carteira, filtros de período/âmbito/proprietário,
   detalhe de mês e correção assistida de recibos sem contrato, com pré-visualização.
4. Organizar navegação por tarefas. Uniformizar títulos, unidades, proveniência,
   limitações e metodologia nos relatórios e fichas, sem alterar silenciosamente fórmulas fiscais.
5. Desenhar três símbolos originais baseados em casas e pátios, conforme a última direção do utilizador. Comparar a 16/32 px, escolher e integrar
   variantes clara/escura/monocromática, marca verbal, favicon e instalação PWA.
6. Validar lógica financeira, persistência e permissões; browser autenticado em desktop
   e telemóvel; build + checks; publicação e sincronização Git.

## Regras de integridade

- Os recibos importados documentam rendas; não confirmam movimentos bancários.
- Pagamentos confirmados substituem a inferência documental do mesmo período;
  um recibo posterior nunca volta a somar o pagamento confirmado.
- Operações financeiras e associações em lote são transacionais, validadas no servidor
  e mantêm histórico. Um resultado de rede incerto permite repetição idempotente.
- Quotas externas e quotas desconhecidas têm estados distintos; não inventar titulares.
- Custos orçamentados não são despesas realizadas. Uma despesa ligada a uma intervenção
  entra uma vez nas contas.
- Migrações aditivas e idempotentes no fim de `supabase/schema.sql`; preservar histórico.
- Não usar registos fictícios em produção para demonstrar funcionalidades.

## Estado

Implementação concluída; publicação e revisão final em curso. A primeira publicação
está pronta em produção. Os dados financeiros anteriores foram preservados.

## Alterações aplicadas

| Pedido | Resultado | Evidência no código |
| --- | --- | --- |
| Títulos, formatação e informação | Entidade antes dos valores; euros, unidades, origem e limites perto dos indicadores | Páginas de inquilinos, análise, mercado, imóveis e kit/Money |
| Pagamentos e recibos | Extrato mensal, movimento real, repartição parcial/adiantada, reconciliação, correção, anulação e saldo verificado | lib/gestao.ts, actions/gestao.ts, gestao-operacional.sql |
| Período e âmbito | Imóvel por inteiro, partes familiares conhecidas e proprietário; desconhecido explícito; despesas sem aplicar quota duas vezes | portfolio/operacional.ts, ambito.ts, scopedExpense |
| Consulta e navegação | Cartões e tabela pesquisável com filtros recolhíveis, ordenação, cabeçalho e coluna do imóvel fixos; retorno conserva filtros | components/gestao/operacional.tsx, Imóveis/Cobranças/fichas |
| Grelha mensal | Uma Faixa reutilizada, eixo comum, meses clicáveis e histórico recente/completo | components/faixa, Carteira e ficha da fração |
| Saúde dos dados | Registos e tipos, ligações de correção, recibos órfãos com candidatos, escolha explícita, pré-visualização e histórico | health.ts, /saude/recibos, receipt-correction.tsx |
| Estatísticas | Fronteira por fonte, estimativas identificadas, prazos documentados, cobertura e pressupostos; fiscalidade preservada | portfolio/futuro.ts, agenda.ts, páginas de relatórios |
| Cobranças e tarefas | Responsável, estado, prazo, prioridade, próximo passo, contactos/acordos/notas e histórico | management_cases/events, /tarefas e /gestao/[id] |
| Contratos | Fim efetivo separado do previsto, desconhecido separado de sem termo, duração/renovação/pré-aviso documentados, agenda e rendas | /contratos, TermsForm, declaredContractDates |
| Manutenção | Fotografias/documentos, fornecedor, orçamento proposto/aprovado, custo realizado e associação de fatura existente | /manutencao, management_cases, expenses.case_id |
| Disponibilidade | Situações distintas, datas, preparação/anúncio/visitas/próxima ação, histórico e oportunidade estimada | /vagas e /gestao/[id] |
| Identidade | Três casas originais, escolha da casa com pátio e ala lateral, variantes e aplicações na marca/favicon/PWA | public/brand, marca.tsx, gerar-marca.cjs |
| Recolha automática | Apenas recibos novos e agregados afetados; não repõe dados editados a partir de exports antigos | scripts/importar_recibos_automatico.py + recolher_recibos.py local |

## Validação

- `npm run build`: aprovado, páginas compiladas e tipos verificados.
- `npm run check`: 26 módulos aprovados, incluindo estados financeiros, quotas,
  ambiguidades, mês de fevereiro, fiscalidade e isolamento da projeção por fonte.
- Migração aplicada e testada duas vezes na mesma transação; originais financeiros
  preservados. Os registos sintéticos dos testes foram todos revertidos.
- 12 verificações transacionais: pagamento repartido/idempotente, migração repetida,
  recibo posterior sem dupla contagem, reconciliação, plano de associação obsoleto,
  saldo/futuro, correção, anulação, custo de manutenção único, diligência atómica,
  histórico e proibição de escrita do viewer. A 13.ª verificação confirma a aplicação.
- Recolha agendada testada pelo ponto de entrada local em modo `--seco`: reversão
  integral; sem alterar dados financeiros. Nenhuma nova recolha do Portal foi necessária.
- Browser autenticado: páginas de cobranças, extrato, contratos, despesas, tarefas,
  manutenção, vagas, recibos órfãos, relatórios, imóveis e carteira carregados.
  Inspeção em 1440 px, 390 px e largura do utilizador de 401 px.
- Corrigidos na inspeção: transbordo móvel dos cartões, acesso mais rápido aos dados,
  coluna identificadora da tabela fixa, ausência de proprietário sem falsos zeros,
  terminologia/cor do risco inferido. Composição e ordem de Hoje preservadas.
- Detector Impeccable nos alvos alterados: sem ocorrências.
- Capturas autenticadas ficam locais, ignoradas por Git e Vercel. Exports privados
  continuam em `dados/`, também excluídos de ambos.

## Uso e dados a completar

Não é necessária nenhuma execução manual da migração. Em Cobranças, abrir um mês
permite registar o movimento comprovado e verificar o saldo. Em Saúde, rever candidatos
e a pré-visualização antes de associar recibos. Em Contratos, preencher prazos apenas
quando documentados; em Imóveis, confirmar quotas externas quando houver evidência.
As tarefas, manutenção e disponibilidade começam com registos reais criados pela família;
não foram preenchidas com exemplos fictícios. Informação desconhecida mantém-se assim.

## Publicação e reversão

Publicação manual Vercel após build/check verdes; sincronização Git no fim. Se um fluxo
principal autenticado falhar, repor o deploy anterior pela Vercel. A migração aditiva
preserva as tabelas anteriores; não apagar o novo histórico para reverter a interface.
Não existe envio automático de contactos nem interpretação automática de cláusulas.

