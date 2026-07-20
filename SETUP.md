# Arranque da app (uma vez)

1. **Criar o projeto Supabase.** Vai a [supabase.com](https://supabase.com) → *New project*, escolhe uma região da União Europeia (ex.: `eu-west-1`) e o plano *Free*. Guarda a password da base de dados que definires — não é preciso para o dia a dia, mas convém teres em algum lado seguro.

2. **Criar as tabelas.** No painel do Supabase, abre o **SQL Editor**, cola o conteúdo do ficheiro [`supabase/schema.sql`](supabase/schema.sql) e corre-o. É idempotente (podes voltar a correr sem duplicar nada). Isto cria todas as tabelas, os índices, as políticas de RLS e semeia os 4 senhorios iniciais (**Avô / Avó / Pai / Tio** — renomeiam-se depois na página **Senhorios**).

3. **(Opcional, só para experimentar).** Corre também [`supabase/seed_demo.sql`](supabase/seed_demo.sql) — dados fictícios (6 frações, contratos, pagamentos com atrasos propositados, despesas) para veres a app populada antes de teres dados reais. Para limpar depois:
   ```sql
   delete from properties where id::text like '11111111%';
   delete from market_benchmarks where source = 'demo';
   ```

4. **Criar o teu utilizador.** No Supabase, vai a **Authentication → Add user** e cria um utilizador com email + password. O **primeiro** utilizador criado fica administrador automaticamente; os seguintes ficam só com acesso de leitura (promovem-se depois na página **Admin**). Recomendado: em **Authentication → Sign In / Providers**, desativa os registos públicos (sign-ups) — os acessos da família devem ser sempre criados por ti.

5. **Ligar a app ao Supabase.** Copia o ficheiro [`.env.local.example`](.env.local.example) para `.env.local` e preenche:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```
   Os valores estão em **Project Settings → API** no Supabase. Nota: a `anon key` é pública por natureza — quem protege os dados é o Row Level Security (RLS) já configurado no schema, não o segredo da chave. A `service_role key` **nunca** se usa nem se guarda neste projeto.

6. **Arrancar a app.** Duplo clique em [`start.cmd`](start.cmd) (usa o Node instalado em `C:\Users\migue\AppData\Local\Logi\...`, não precisas de o ter no PATH). Abre depois `http://localhost:3000` e entra com o utilizador criado no passo 4.

# Primeiros dados

7. **Benchmarks do INE.** Em **Admin → "Atualizar do INE agora"**, importa as medianas €/m² de rendas e vendas por concelho/freguesia (demora uns segundos). É isto que alimenta a comparação com o mercado.

8. **Importar do Portal das Finanças.** Para cada senhorio, no Portal das Finanças exporta os 3 ficheiros e importa-os em **Admin → Importar do Portal das Finanças**, por esta ordem:
   1. **Contratos** — `Arrendamento → Contratos`, exportar a lista (`ListaContratos`). Cria as frações em falta e cria/atualiza os contratos (renda e estado) por nº de contrato.
   2. **Recibos** — `Arrendamento → Recibos de Renda → Consultar`, exportar a lista (`ListaRecibos`). Cria o que faltar (frações/contratos) e insere os recibos; recibos que abrangem vários meses são divididos automaticamente por mês. Podes marcar para os registar também como pagamentos (rendas recebidas).
   3. **Património Predial** — `Património Predial → lista de imóveis`, exportar em CSV. Só enriquece frações já existentes: preenche o VPT e a quota de propriedade do senhorio — por isso deve ser o último a importar.

   As frações são ligadas entre ficheiros pelo identificador matricial (coluna "Imóvel"/"Identificador"); os nomes das frações podem ajustar-se depois em **Frações**.

9. **Completar as fichas das frações.** Em cada fração, preenche a área (m²), o território INE (freguesia) e o VPT — estes valores vêm da caderneta predial (**Portal das Finanças → Imóveis**). É esta ligação que permite comparar as rendas com as medianas do INE.

10. **Marcar pagamentos.** Na página **Pagamentos**, marca as rendas recebidas mês a mês. (A conciliação automática com o extrato bancário é uma fase futura — ver README.)

# Deploy (quando quiseres a app acessível à família)

Vercel → *Add New Project* → importa o repositório → define as duas variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`) → *Deploy*. Posso tratar disto quando quiseres — é só dizeres.
