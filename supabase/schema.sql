-- ============================================================
-- App de gestão do património — schema Supabase (Postgres)
-- Correr UMA VEZ no SQL Editor do projeto Supabase (região UE).
-- Idempotente: pode ser re-corrido sem duplicar objetos.
-- ============================================================

-- ---------- Perfis e papéis ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- O PRIMEIRO utilizador a registar-se fica admin; os seguintes ficam viewer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.profiles where role = 'admin')
         then 'viewer' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- Senhorios ----------
create table if not exists public.landlords (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nif text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Frações ----------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- apelido curto, ex: "R. das Flores 12, 2º Esq"
  address text,
  postal_code text,
  municipality text,                 -- concelho
  parish text,                       -- freguesia
  dicofre text,                      -- código DICOFRE (6 dígitos) para ligar ao INE
  typology text,                     -- T0..T5, loja, garagem...
  area_m2 numeric,                   -- área bruta privativa (caderneta predial)
  vpt numeric,                       -- valor patrimonial tributário
  vpt_year int,
  matriz_article text,               -- artigo matricial
  status text not null default 'arrendado' check (status in ('arrendado', 'vago', 'outro')),
  notes text,
  created_at timestamptz not null default now()
);

-- Compropriedade (ex.: avô + avó com 50/50)
create table if not exists public.property_owners (
  property_id uuid not null references public.properties (id) on delete cascade,
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  quota numeric not null default 100,   -- percentagem
  primary key (property_id, landlord_id)
);

-- ---------- Contratos ----------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  tenant_name text not null,
  tenant_nif text,
  pf_contract_no text,               -- nº do contrato no Portal das Finanças
  start_date date,
  end_date date,
  rent numeric not null,             -- renda mensal atual
  due_day int not null default 1 check (due_day between 1 and 28),
  status text not null default 'ativo' check (status in ('ativo', 'cessado')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.rent_updates (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  effective_date date not null,
  old_rent numeric,
  new_rent numeric not null,
  reason text not null default 'acordo' check (reason in ('coeficiente', 'acordo', 'novo_contrato', 'outro')),
  created_at timestamptz not null default now()
);

-- ---------- Recibos (importados do Portal das Finanças) ----------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  pf_contract_no text,
  receipt_number text,
  ref_month date not null,           -- 1º dia do mês a que a renda respeita
  period_start date,
  period_end date,
  amount numeric not null,
  issue_date date,
  source text not null default 'portal',
  raw jsonb,                         -- linha original do ficheiro importado (auditoria)
  created_at timestamptz not null default now()
);

-- dedupe GLOBAL em reimportações: o nº de recibo importado é o composto
-- "contrato/recibo(#parte)", único em todo o Portal das Finanças — o mesmo
-- contrato/recibo pode ser importado a partir de exports de DOIS senhorios
-- (imóveis em compropriedade) e deve colidir na mesma linha. NULLs não
-- colidem entre si, por isso recibos manuais sem número passam sempre.
create unique index if not exists receipts_dedupe
  on public.receipts (receipt_number);

create index if not exists receipts_ref_month on public.receipts (ref_month);
create index if not exists receipts_property on public.receipts (property_id);

-- ---------- Pagamentos (recebimentos reais) ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  ref_month date not null,           -- 1º dia do mês de referência
  amount numeric not null,
  received_date date,
  method text not null default 'transferencia' check (method in ('transferencia', 'dinheiro', 'outro')),
  source text not null default 'manual' check (source in ('manual', 'extrato', 'recibo')),
  notes text,
  created_at timestamptz not null default now(),
  unique (contract_id, ref_month)
);

create index if not exists payments_ref_month on public.payments (ref_month);

-- ---------- Despesas ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete cascade,  -- null = despesa geral
  landlord_id uuid references public.landlords (id) on delete set null,
  expense_date date not null,
  category text not null check (category in ('imi', 'condominio', 'seguro', 'obras', 'financiamento', 'outras')),
  amount numeric not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date on public.expenses (expense_date);
create index if not exists expenses_property on public.expenses (property_id);

-- ---------- Benchmarks de mercado (INE) ----------
create table if not exists public.market_benchmarks (
  id uuid primary key default gen_random_uuid(),
  dicofre text not null,             -- código da freguesia (ou concelho se level='concelho')
  parish_name text,
  municipality text,
  period text not null,              -- ex.: '2025S2' (semestre) ou '2025T4' (trimestre)
  rent_median_m2 numeric,            -- € /m² — novos contratos de arrendamento (INE)
  sale_median_m2 numeric,            -- € /m² — vendas de alojamentos (INE)
  level text not null default 'freguesia' check (level in ('freguesia', 'concelho')),
  source text not null default 'ine',
  fetched_at timestamptz not null default now(),
  unique (dicofre, period, source)
);

-- ---------- Coeficientes anuais de atualização de rendas (Fase 3) ----------
create table if not exists public.update_coefficients (
  year int primary key,
  coefficient numeric not null       -- ex.: 1.0216
);

-- Depois de importar recibos, alinha a renda de cada contrato ativo com o
-- valor do recibo mais recente. Corre com RLS do invocador (só admin escreve).
--
-- Soma por mes de referencia ANTES de escolher o mais recente: alguns contratos
-- (ex.: 1905921 "lote 2e") tem a renda mensal dividida em mais de um recibo no
-- mesmo mes (260 + 70 = 330). A versao anterior pegava so no ultimo recibo (uma
-- linha, `distinct on (contract_id)`) e, quando duas linhas empatavam no mesmo
-- ref_month, escolhia uma delas sem criterio -- podia gravar 70 em vez de 330.
create or replace function public.sync_contract_rents()
returns int
language sql
as $$
  with monthly as (
    select contract_id, ref_month, sum(amount) as total
    from public.receipts
    where contract_id is not null
    group by contract_id, ref_month
  ),
  latest as (
    select distinct on (contract_id) contract_id, total as amount
    from monthly
    order by contract_id, ref_month desc
  ),
  updated as (
    update public.contracts c
    set rent = l.amount
    from latest l
    where l.contract_id = c.id
      and c.status = 'ativo'
      and c.rent is distinct from l.amount
    returning c.id
  )
  select count(*)::int from updated;
$$;

-- ============================================================
-- PERMISSÕES: sem estes GRANTs o PostgREST devolve
-- "42501 permission denied for table ..." e a app não lê nada.
-- (Em projetos Supabase recentes os default privileges podem não
--  cobrir tabelas criadas manualmente no SQL Editor.)
-- A segurança real vem do RLS mais abaixo, não destes GRANTs:
-- 'anon' (não autenticado) não recebe nada.
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Tabelas/funções criadas no futuro herdam o mesmo tratamento.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- ============================================================
-- RLS: qualquer utilizador autenticado LÊ; só admin ESCREVE.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.landlords enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.contracts enable row level security;
alter table public.rent_updates enable row level security;
alter table public.receipts enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.market_benchmarks enable row level security;
alter table public.update_coefficients enable row level security;

-- profiles: cada um vê o seu; admin vê e edita todos
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- macro: leitura para autenticados + escrita só admin nas tabelas de domínio
do $$
declare
  t text;
begin
  foreach t in array array[
    'landlords', 'properties', 'property_owners', 'contracts', 'rent_updates',
    'receipts', 'payments', 'expenses', 'market_benchmarks', 'update_coefficients'
  ]
  loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select to authenticated using (true)', t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (public.is_admin())', t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (public.is_admin())', t, t);
  end loop;
end;
$$;

-- ============================================================
-- Seed mínimo: os 4 senhorios
-- ============================================================
insert into public.landlords (name)
select v.name
from (values ('Miguel'), ('Eva'), ('António'), ('Ilidio')) as v(name)
where not exists (select 1 from public.landlords);

-- ============================================================
-- Migrações idempotentes (2026-07-24)
-- ============================================================

-- P0-2c: frações não arrendáveis (terrenos) e já vendidas saem das métricas
-- correntes; o histórico de contratos/recibos fica intacto na BD.
-- O check inline chama-se properties_status_check em instalações novas, mas
-- dropamos por definição para não depender do nome gerado.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and rel.relname = 'properties'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%arrendado%'
  loop
    execute format('alter table public.properties drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.properties
  add constraint properties_status_check
  check (status in ('arrendado', 'vago', 'outro', 'terreno', 'vendido'));

-- P2-5: retenção na fonte do recibo (bruto menos "Importância recebida").
alter table public.receipts add column if not exists withholding numeric not null default 0;

-- ============================================================
-- P0-2c (2026-07-24): marcar frações fora das métricas correntes.
-- Não apaga nada — contratos/recibos/pagamentos ficam intactos na BD, só deixam
-- de contar para ocupação, atrasos, mercado e saúde dos dados (ver
-- isCurrentProperty em src/lib/calc.ts). Seguro re-correr: cada UPDATE só afeta
-- quem ainda estiver no estado errado, e não falha se a fração não existir.
-- ============================================================

-- (a) 182341-U-4364: imóvel já vendido pelo avô (o inquilino não pagava renda,
-- mas a dívida ficou saldada na venda — não deve gerar atraso nem entrar em
-- ocupação/mercado).
update public.properties
set status = 'vendido'
where matriz_article = '182341-U-4364'
  and status is distinct from 'vendido';

-- (b) Terrenos: qualquer fração sem NENHUM contrato com renda > 0 e sem
-- NENHUM recibo — nunca teve renda nem histórico de arrendamento (cobre
-- 182341-U-6004 e 182301-R-401, e qualquer outra no mesmo caso). Não toca em
-- quem já está 'vendido' (caso (a) tem prioridade e não é reclassificado aqui).
update public.properties p
set status = 'terreno'
where p.status not in ('vendido', 'terreno')
  and not exists (
    select 1 from public.contracts c where c.property_id = p.id and c.rent > 0
  )
  and not exists (
    select 1 from public.receipts r where r.property_id = p.id
  );

-- ============================================================
-- V2 · FASE 0 (2026-07-24) — migração idempotente. Colar no SQL Editor.
-- Ver PLANO.md §7.2 (S1, S2, S6) e §1 (bugs B4, B7).
-- Nada aqui apaga ou altera dados existentes: só acrescenta índices e uma coluna.
-- ============================================================

-- S1 · Fecha o bug B4: DERIVA DE SCHEMA.
-- Estes dois índices únicos são a base de todo o import idempotente (o gerador
-- faz `on conflict (matriz_article)` e `on conflict (pf_contract_no)`), mas até
-- hoje só existiam dentro de dados/gerar_sql_import.py — uma base de dados criada
-- a partir deste ficheiro NÃO tinha dedupe por artigo matricial nem por número de
-- contrato do Portal, e um reimport duplicaria frações e contratos em silêncio.
-- NULLs não colidem em índices únicos do Postgres, por isso frações sem artigo
-- matricial e contratos sem número do Portal continuam a poder existir aos pares.
create unique index if not exists properties_matriz_uq
  on public.properties (matriz_article);

create unique index if not exists contracts_pfno_uq
  on public.contracts (pf_contract_no);

-- S2 · Fecha o bug B7: recibos ANULADOS não tinham representação.
-- O Portal marca recibos como "Anulado" (21 no export do Pai, 43 no do Avô) e o
-- parse simplesmente descarta-os: o rasto vive só nos Analise_*.md. Com esta
-- coluna, o import da app (Fase 6) passa a gravá-los marcados em vez de os perder,
-- e o ecrã de diff pode dizer "1 anulado, excluído" com prova.
-- Default false: todos os recibos já importados são válidos, que é a verdade.
-- ORDEM IMPORTA: o filtro `cancelled = false` nas queries que contam dinheiro
-- (página /irs e /api/irs) só entra na Fase 6, quando o import passar a escrever
-- a coluna. Adicioná-lo antes de este bloco estar colado no SQL Editor rebentaria
-- essas páginas com "column does not exist" em produção.
alter table public.receipts
  add column if not exists cancelled boolean not null default false;

-- S6 · O snapshot da V2 varre a carteira por contrato-mês (uma faixa por fração,
-- 24 a 60 meses cada). Sem estes índices é um seq scan sobre >5000 linhas por
-- cada construção.
create index if not exists receipts_contract_month
  on public.receipts (contract_id, ref_month);

create index if not exists payments_contract_month
  on public.payments (contract_id, ref_month);

-- ============================================================
-- V2 (2026-07-25) — CORREÇÃO: sync_contract_rents escrevia rendas ERRADAS.
-- Colar no SQL Editor e depois correr "Sincronizar rendas" no Admin.
--
-- O que estava mal: a função pegava no mês MAIS RECENTE com recibos. Esse é
-- justamente o mês menos fiável -- pode ter só parte dos recibos emitidos.
-- Em contratos cuja renda mensal vem repartida em vários recibos (16 dos 24
-- meses no 1825765 "Repeses First", 10 em 18 no 68665 "1PES"), o último mês
-- tinha só uma das parcelas e a renda ficou a valer essa parcela:
--   Repeses First: renda 175 EUR, quando 18 meses repetem 331 EUR
--   1PES:          renda 179 EUR, quando 10 meses repetem 290 EUR
-- Total subavaliado: 267 EUR/mes, ~3.200 EUR/ano.
--
-- Correção: em vez do último mês, usa o total mensal que MAIS SE REPETE nos
-- últimos 12 meses, desempatando pelo mais recente. Um mês parcial aparece uma
-- única vez e perde; uma atualização de renda real aparece 2+ vezes e ganha,
-- porque é a mais recente entre as que se repetem.
-- ============================================================
create or replace function public.sync_contract_rents()
returns int
language sql
as $$
  with monthly as (
    select contract_id, ref_month, sum(amount) as total
    from public.receipts
    where contract_id is not null
      and ref_month >= (date_trunc('month', current_date) - interval '12 months')
    group by contract_id, ref_month
  ),
  frequencia as (
    select contract_id, total, count(*) as vezes, max(ref_month) as ultimo
    from monthly
    group by contract_id, total
  ),
  escolhido as (
    -- Entre os valores que se repetem (vezes >= 2), o mais RECENTE. Se nenhum se
    -- repetir (contrato com 1 só mês de recibos), fica o mais recente que houver.
    select distinct on (contract_id) contract_id, total as amount
    from frequencia
    order by contract_id, (vezes >= 2) desc, ultimo desc, total desc
  ),
  updated as (
    update public.contracts c
    set rent = e.amount
    from escolhido e
    where e.contract_id = c.id
      and c.status = 'ativo'
      and c.rent is distinct from e.amount
      -- Nunca pisar uma atualização de renda DELIBERADA que ainda não tem recibos:
      -- uma decisão humana explícita vence um valor inferido dos recibos.
      and not exists (
        select 1
        from public.rent_updates ru
        where ru.contract_id = c.id
          and ru.effective_date > (
            select coalesce(max(m.ref_month), '1900-01-01'::date) from monthly m
            where m.contract_id = c.id
          )
      )
    returning c.id
  )
  select count(*)::int from updated;
$$;

-- ============================================================
-- V2 (2026-07-25) — sync_contract_rents nunca mais pode PIORAR uma renda.
-- Colar no SQL Editor. Substitui a versão de cima.
--
-- O que aconteceu: a versão anterior já tinha corrido e baixado o 68665
-- ("1PES") de 296 para 290. O 296 é o valor registado no Portal (atualização
-- anual de jan/2026); os recibos só o mostram UMA vez porque o contrato deixou
-- de emitir recibos em fev/2026. O valor que "se repete" era o antigo.
--
-- Regra nova, em duas linhas do WHERE:
--   1) o valor escolhido tem de repetir-se >= 3 meses (REPETICOES_MIN em
--      src/lib/rent.ts). Sem isso, não há prova — fica o que lá está.
--   2) só escreve se a diferença for > 5% (DESALINHAMENTO_MIN, mesmo ficheiro).
--      Abaixo disso está a atualização anual pelo coeficiente (~2%), e aí a
--      renda REGISTADA é mais fiável do que a inferida dos recibos.
--
-- O efeito prático: o botão só consegue mexer no que a página de Saúde já
-- mostrava a vermelho — os erros grosseiros (175 em vez de 331, 47% abaixo)
-- que motivaram a função. Nunca mais rói 6 EUR a uma renda certa.
-- ============================================================
create or replace function public.sync_contract_rents()
returns int
language sql
as $$
  with monthly as (
    select contract_id, ref_month, sum(amount) as total
    from public.receipts
    where contract_id is not null
      and ref_month >= (date_trunc('month', current_date) - interval '12 months')
    group by contract_id, ref_month
  ),
  frequencia as (
    select contract_id, total, count(*) as vezes, max(ref_month) as ultimo
    from monthly
    group by contract_id, total
  ),
  escolhido as (
    -- Entre os valores com prova (>= 3 meses iguais), o mais RECENTE.
    select distinct on (contract_id) contract_id, total as amount
    from frequencia
    where vezes >= 3
    order by contract_id, ultimo desc, total desc
  ),
  updated as (
    update public.contracts c
    set rent = e.amount
    from escolhido e
    where e.contract_id = c.id
      and c.status = 'ativo'
      and c.rent is distinct from e.amount
      -- Só erros grosseiros. Dentro dos 5% manda a renda registada.
      and abs(e.amount - c.rent) > c.rent * 0.05
      -- Nunca pisar uma atualização de renda DELIBERADA que ainda não tem
      -- recibos: uma decisão humana explícita vence um valor inferido.
      and not exists (
        select 1
        from public.rent_updates ru
        where ru.contract_id = c.id
          and ru.effective_date > (
            select coalesce(max(m.ref_month), '1900-01-01'::date) from monthly m
            where m.contract_id = c.id
          )
      )
    returning c.id
  )
  select count(*)::int from updated;
$$;

-- Repõe o estrago que a versão antiga já fez (conferido contra o
-- ListaContratos.xls do Portal em 2026-07-25 por dados/auditoria_rendas.py).
update public.contracts set rent = 296.00
where pf_contract_no = '68665' and rent = 290.00;

-- ============================================================
-- V2 · FASE 2 — S3: adiar/dispensar decisões (PLANO.md §7.2).
-- Colar no SQL Editor.
--
-- A fila do Agora é recalculada a cada request a partir do snapshot. Sem estado
-- persistido, "já tratei disto" não sobrevive a um F5 e a fila mente. Uma linha
-- por (kind, subject): `subject` vazio = a decisão é da carteira inteira; caso
-- contrário é o id da entidade (fração, contrato).
--
-- Adiar tem data; dispensar não tem — é para sinais que estão CERTOS e que o
-- utilizador decidiu não agir (um terreno que nunca vai ser arrendado). Ambos
-- são reversíveis por delete, e nenhum apaga o facto: o gerador continua a
-- correr, só não mostra.
-- ============================================================
create table if not exists public.insight_state (
  kind text not null,
  subject text not null default '',
  snoozed_until date,
  dismissed_at timestamptz,
  note text,
  updated_at timestamptz not null default now(),
  primary key (kind, subject)
);

alter table public.insight_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'insight_state'
      and policyname = 'insight_state_select'
  ) then
    create policy insight_state_select on public.insight_state
      for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'insight_state'
      and policyname = 'insight_state_write'
  ) then
    create policy insight_state_write on public.insight_state
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select, insert, update, delete on public.insight_state to authenticated;

-- ============================================================
-- V3 · DESPESAS POR SENHORIO — proveniência (V3.md, frente B).
-- Colar no SQL Editor.
--
-- Sem esta coluna, uma despesa COPIADA de um comproprietário fica indistinguível de
-- uma despesa medida, e a app passa a mostrar "líquido" com ar de facto sobre um
-- número inferido. `registada` = saiu de uma declaração/fatura do próprio;
-- `espelhada` = copiada de um comproprietário documentado na caderneta predial;
-- `estimada` = qualquer outra inferência (não usada ainda).
--
-- DECISÃO DO UTILIZADOR (2026-07-26): espelhadas NÃO vão ao Anexo F. Servem a análise
-- de carteira e a projeção; deduzir ao fisco exige a fatura em nome do titular.
-- O filtro está em `expenseTotalsByProperty` (src/lib/irs.ts), o único sítio por onde
-- passam as duas superfícies fiscais (mapa anual e Anexo F).
-- ============================================================
alter table public.expenses
  add column if not exists origem text not null default 'registada';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'expenses_origem_check'
  ) then
    alter table public.expenses
      add constraint expenses_origem_check
      check (origem in ('registada', 'espelhada', 'estimada'));
  end if;
end $$;

create index if not exists expenses_origem on public.expenses (origem);

-- Categoria nova `conservacao` (V3, frente B): as declarações de IRS trazem a coluna
-- "Conservação e manutenção" já classificada, e essa DEDUZ no Anexo F (art.º 41.º). A
-- categoria `obras` continua a existir e continua a NÃO deduzir, porque é ambígua
-- (conservação ou valorização?). Sem esta separação, importar a declaração real subvaloriza
-- a dedução do avô em ~26,6k.
do $$
begin
  alter table public.expenses drop constraint if exists expenses_category_check;
  alter table public.expenses
    add constraint expenses_category_check
    check (category in ('imi', 'condominio', 'conservacao', 'seguro', 'obras', 'financiamento', 'outras'));
end $$;

-- ============================================================
-- V3 · MERCADO — bug B5: o código de território era o do INE, não o DICOFRE.
-- Colar no SQL Editor.
--
-- O `geocod` do INE é NUTS III + DICOFRE (Viseu = `1941823` = `194` + `18` + `23`), e era
-- isso que ficava em `market_benchmarks.dicofre` e no Select de território da ficha. A
-- fração, quando vem da caderneta predial, traz o DICOFRE (`182341`). Nenhum dos dois
-- caminhos de `benchmarkForMetric` podia casar: nem a igualdade da freguesia nem o
-- `startsWith` do concelho. Resultado: €/m², valor estimado e yield sempre por saber, com
-- benchmarks carregados na base.
--
-- `ine.ts` passa a gravar só o DICOFRE (4 dígitos concelho, 6 freguesia). Isto converte o
-- que já lá está, em vez de apagar: a conversão é unívoca (o NUTS deriva do concelho) e
-- não pode colidir com a chave (dicofre, period, source).
-- ============================================================
update public.market_benchmarks set dicofre = right(dicofre, 6)
  where source = 'ine' and length(dicofre) = 9;
update public.market_benchmarks set dicofre = right(dicofre, 4)
  where source = 'ine' and length(dicofre) = 7;

-- As frações cujo território foi escolhido à mão no Select guardam o mesmo código do INE.
update public.properties set dicofre = right(dicofre, 6) where length(dicofre) = 9;
update public.properties set dicofre = right(dicofre, 4) where length(dicofre) = 7;

-- Conferência: quantas frações passam a ter benchmark, e por que nível.
select p.matriz_article, p.dicofre, p.typology,
       (select count(*) from public.market_benchmarks b
         where b.level = 'freguesia' and b.dicofre = p.dicofre) as freguesia,
       (select count(*) from public.market_benchmarks b
         where b.level = 'concelho' and p.dicofre like b.dicofre || '%') as concelho
from public.properties p
where p.dicofre is not null
order by 4, 5, 1;

-- ============================================================
-- V3 · QUOTAS — a Avó (Eva) nas frações do Avô (Miguel).
-- Colar no SQL Editor. Pode ir antes ou depois de dados/update_cadernetas_pai.sql: a
-- trave do `least(...)` impede o excesso em qualquer ordem, e onde a caderneta tem a
-- quota dela escrita é o upsert da caderneta que manda.
--
-- Porquê: o import do Portal só cria `property_owners` para o senhorio da pasta, e a
-- coluna "Parte" do avô é 1/2 — a outra metade é da avó, que nunca terá exports próprios.
-- Ficavam ~22 frações a somar 50% e a acusar "quotas ≠ 100%" na Saúde dos dados. É o
-- mesmo caso do Pai e do Tio, que a caderneta predial já resolveu com os TITULARES.
--
-- A trava: a avó recebe a MESMA quota do avô, mas nunca mais do que o que falta para 100%.
-- Sem isso, uma fração partilhada com terceiros (o 6004 e o rústico 401 têm Ângela e
-- Graça) passava dos 100% e a app começava a distribuir património que não é da família.
-- Onde a caderneta já escreveu a quota da avó, o `not exists` deixa-a em paz.
-- ============================================================
insert into public.property_owners (property_id, landlord_id, quota)
select po.property_id, eva.id,
       least(po.quota, 100 - (select coalesce(sum(x.quota), 0)
                                from public.property_owners x
                               where x.property_id = po.property_id))
from public.property_owners po
join public.landlords m on m.id = po.landlord_id and m.name = 'Miguel'
cross join (select id from public.landlords where name = 'Eva') eva
where not exists (
        select 1 from public.property_owners e
         where e.property_id = po.property_id and e.landlord_id = eva.id
      )
  and (select coalesce(sum(x.quota), 0) from public.property_owners x
        where x.property_id = po.property_id) < 100;

-- Conferência: o que ainda não soma 100% depois disto (e com quem está a diferença).
select p.matriz_article, sum(po.quota) as quota_total,
       string_agg(l.name || ' ' || po.quota || '%', ' · ' order by l.name) as titulares
from public.properties p
join public.property_owners po on po.property_id = p.id
join public.landlords l on l.id = po.landlord_id
group by p.matriz_article
having sum(po.quota) <> 100
order by 2, 1;

-- ============================================================
-- V3 · DOCUMENTOS — o arquivo da carteira (2026-07-30).
-- Colar no SQL Editor. Idempotente.
--
-- Porquê Storage e não uma tabela: os ficheiros são o dado. Uma tabela `documents` seria
-- um índice a duplicar o que o próprio bucket já sabe (nome, tamanho, data) e uma segunda
-- coisa para manter em sincronia. O caminho de cada objeto CARREGA a informação:
--
--     <escopo>__<nome do ficheiro>
--
-- `escopo` é o artigo matricial da fração (ex. `182341-U-5077-A__contrato.pdf`) ou a
-- palavra `geral` para o que é da carteira toda (IRS, cartas, minutas assinadas). Tudo
-- fica na RAIZ do bucket de propósito: com pastas a sério, listar a carteira eram ~50
-- pedidos ao Supabase; assim é UM `list()`. A regra vive em `src/lib/documentos.ts`.
--
-- Permissões: quem tem sessão LÊ (a família toda vê o arquivo, é o ponto), só o admin
-- escreve e apaga. Mesma assimetria das tabelas.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 26214400)   -- 25 MB por ficheiro
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists documentos_read on storage.objects;
create policy documentos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos');

drop policy if exists documentos_insert on storage.objects;
create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.is_admin());

drop policy if exists documentos_update on storage.objects;
create policy documentos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and public.is_admin())
  with check (bucket_id = 'documentos' and public.is_admin());

drop policy if exists documentos_delete on storage.objects;
create policy documentos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and public.is_admin());
