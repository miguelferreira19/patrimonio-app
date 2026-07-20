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
create or replace function public.sync_contract_rents()
returns int
language sql
as $$
  with latest as (
    select distinct on (contract_id) contract_id, amount
    from public.receipts
    where contract_id is not null
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
