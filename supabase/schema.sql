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

-- ======================================================================
-- V5 · GESTÃO OPERACIONAL · 2026-10-09
-- Cópia autónoma: supabase/gestao-operacional.sql
-- Gestão operacional · 2026-10-09. Migração aditiva, repetível e sem apagar histórico.
alter table public.landlords add column if not exists in_portfolio boolean not null default true;
alter table public.properties add column if not exists quota_remainder_kind text not null default 'por_confirmar' check (quota_remainder_kind in ('por_confirmar','externa'));
alter table public.property_owners add column if not exists quota_confirmed boolean not null default false;
alter table public.contracts add column if not exists term_kind text not null default 'desconhecido' check (term_kind in ('desconhecido','sem_termo','prazo_certo'));
alter table public.contracts add column if not exists expected_end_date date;
alter table public.contracts add column if not exists duration_months integer check (duration_months > 0);
alter table public.contracts add column if not exists renewal_months integer check (renewal_months > 0);
alter table public.contracts add column if not exists notice_days_landlord integer check (notice_days_landlord >= 0);
alter table public.contracts add column if not exists notice_days_tenant integer check (notice_days_tenant >= 0);
alter table public.contracts add column if not exists term_source text;
alter table public.contracts add column if not exists terms_confirmed_at date;

create table if not exists public.payment_movements (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
  received_date date,
  method text not null check (method in ('transferencia','dinheiro','outro')),
  reference text,
  proof_path text,
  notes text,
  request_id uuid not null unique,
  voided boolean not null default false,
  void_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists payment_movements_reference_uq on public.payment_movements(contract_id,reference) where reference is not null and reference <> '' and not voided;
create table if not exists public.payment_allocations (
  movement_id uuid not null references public.payment_movements(id) on delete restrict,
  ref_month date not null check (extract(day from ref_month)=1),
  amount numeric(14,2) not null check (amount > 0),
  primary key (movement_id,ref_month)
);
create index if not exists payment_allocations_month on public.payment_allocations(ref_month);
create table if not exists public.receipt_payment_links (
  receipt_id uuid not null references public.receipts(id) on delete restrict,
  movement_id uuid not null references public.payment_movements(id) on delete restrict,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(receipt_id,movement_id)
);
create table if not exists public.period_confirmations (
  contract_id uuid not null references public.contracts(id) on delete restrict,
  ref_month date not null check (extract(day from ref_month)=1),
  expected_amount numeric(14,2) not null check(expected_amount >= 0 and expected_amount < 1000000000000),
  note text not null check(length(trim(note)) > 0),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz not null default now(),
  primary key(contract_id,ref_month)
);
create table if not exists public.management_cases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('cobranca','tarefa','manutencao','vaga')),
  property_id uuid references public.properties(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  title text not null check(length(trim(title)) > 0),
  description text,
  status text not null default 'aberto' check(status in ('aberto','em_curso','adiado','concluido')),
  responsible text,
  due_date date,
  next_step text,
  priority text not null default 'normal' check(priority in ('baixa','normal','alta','urgente')),
  supplier text,
  budget numeric(14,2) check(budget >= 0),
  approved_budget numeric(14,2) check(approved_budget >= 0),
  availability_state text check(availability_state in ('disponivel','em_obras','uso_proprio','reservado','indisponivel')),
  available_from date,
  vacancy_start date,
  vacancy_end date,
  target_rent numeric(14,2) check(target_rent >= 0),
  preparation text,
  listing_url text,
  document_paths text[] not null default '{}',
  request_id uuid not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(kind not in ('manutencao','vaga') or property_id is not null),
  check(vacancy_end is null or vacancy_start is null or vacancy_end >= vacancy_start)
);
create unique index if not exists management_active_vacancy on public.management_cases(property_id) where kind='vaga' and status <> 'concluido';
create index if not exists management_cases_kind_status on public.management_cases(kind,status,due_date);
create table if not exists public.management_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.management_cases(id) on delete restrict,
  kind text not null check(kind in ('nota','contacto','acordo','visita')),
  occurred_on date not null,
  note text not null check(length(trim(note)) > 0),
  next_step text,
  due_date date,
  request_id uuid not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.operation_history (
  id bigint generated always as identity primary key,
  entity_table text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists operation_history_entity on public.operation_history(entity_table,entity_id,created_at);
alter table public.expenses add column if not exists case_id uuid references public.management_cases(id) on delete restrict;
alter table public.expenses add column if not exists request_id uuid;
create unique index if not exists expenses_request_uq on public.expenses(request_id) where request_id is not null;

-- Registos manuais anteriores conservam data e método; não se inventam movimentos de recibos.
insert into public.payment_movements(id,contract_id,amount,received_date,method,notes,request_id,created_at)
select id,contract_id,amount,received_date,method,'Pagamento confirmado legado. ' || coalesce(notes,''),id,created_at
from public.payments p where source in ('manual','extrato') and amount > 0
and not exists(select 1 from public.payment_movements m join public.payment_allocations a on a.movement_id=m.id where m.contract_id=p.contract_id and a.ref_month=p.ref_month)
on conflict(request_id) do nothing;
insert into public.payment_allocations(movement_id,ref_month,amount)
select p.id,p.ref_month,p.amount from public.payments p join public.payment_movements m on m.request_id=p.id
where p.source in ('manual','extrato') and p.amount > 0 on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['payment_movements','payment_allocations','receipt_payment_links','period_confirmations','management_cases','management_events','operation_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t || '_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (true)',t || '_read',t);
    execute format('grant select on public.%I to authenticated',t);
    if t <> 'operation_history' then
      execute format('drop policy if exists %I on public.%I',t || '_insert',t);
      execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())',t || '_insert',t);
      execute format('grant insert on public.%I to authenticated',t);
      if t not in ('management_events','payment_allocations','receipt_payment_links') then
        execute format('drop policy if exists %I on public.%I',t || '_update',t);
        execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check(public.is_admin())',t || '_update',t);
        execute format('grant update on public.%I to authenticated',t);
      end if;
    end if;
    execute format('revoke all on public.%I from anon',t);
    execute format('revoke delete on public.%I from authenticated',t);
  end loop;
end $$;

create or replace function public.gestao_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare a jsonb; b jsonb; key text;
begin
  if tg_op <> 'INSERT' then b := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new); end if;
  key := coalesce(a->>'id',b->>'id',concat_ws('/',coalesce(a->>'contract_id',b->>'contract_id'),coalesce(a->>'ref_month',b->>'ref_month')));
  if tg_table_name='property_owners' then key:=concat_ws('/',coalesce(a->>'property_id',b->>'property_id'),coalesce(a->>'landlord_id',b->>'landlord_id')); end if;
  if tg_table_name='receipt_payment_links' then key:=concat_ws('/',a->>'receipt_id',a->>'movement_id'); end if;
  if a is distinct from b then
    insert into public.operation_history(entity_table,entity_id,action,before_data,after_data,note,created_by)
    values(tg_table_name,key,tg_op,b,a,nullif(current_setting('app.audit_note',true),''),auth.uid());
  end if;
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['payment_movements','period_confirmations','management_cases','management_events','receipts','contracts','rent_updates','expenses','property_owners','properties'] loop
    execute format('drop trigger if exists gestao_audit on public.%I',t);
    execute format('create trigger gestao_audit after insert or update or delete on public.%I for each row execute function public.gestao_audit()',t);
  end loop;
end $$;

create or replace function public.gestao_guard_case() returns trigger language plpgsql as $$
begin
  if new.contract_id is not null and not exists(select 1 from public.contracts c where c.id=new.contract_id and (new.property_id is null or c.property_id=new.property_id)) then
    raise exception 'O contrato não pertence ao imóvel selecionado.';
  end if;
  if new.kind='vaga' and new.status <> 'concluido' and exists(select 1 from public.contracts c where c.property_id=new.property_id and c.status='ativo') then
    raise exception 'Há um contrato ativo nesta fração; confirmar a cessação antes de abrir uma vaga.';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists gestao_guard_case on public.management_cases;
create trigger gestao_guard_case before insert or update on public.management_cases for each row execute function public.gestao_guard_case();

create or replace function public.gestao_refresh_month(p_contract uuid,p_month date) returns void language plpgsql security definer set search_path=public as $$
declare total numeric; n integer; last_date date; source_value text; method_value text;
begin
  select coalesce(sum(a.amount),0),count(*),max(m.received_date) into total,n,last_date
  from public.payment_allocations a join public.payment_movements m on m.id=a.movement_id
  where m.contract_id=p_contract and a.ref_month=p_month and not m.voided;
  source_value := 'manual'; method_value := 'outro';
  if n=0 then
    select coalesce(sum(amount-withholding),0),max(issue_date) into total,last_date
    from public.receipts where contract_id=p_contract and ref_month=p_month and not cancelled;
    source_value := 'recibo';
  end if;
  insert into public.payments(contract_id,ref_month,amount,received_date,method,source,notes)
  values(p_contract,p_month,total,last_date,method_value,source_value,'Agregado dos movimentos confirmados ou, na ausência destes, inferência documental.')
  on conflict(contract_id,ref_month) do update set amount=excluded.amount,received_date=excluded.received_date,method=excluded.method,source=excluded.source,notes=excluded.notes;
end $$;
revoke all on function public.gestao_refresh_month(uuid,date) from public,anon,authenticated;

create or replace function public.gestao_register_payment(p_input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid; cid uuid; rid uuid; total numeric; alloc jsonb; month_date date; receipt_id uuid;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode registar pagamentos.'; end if;
  cid := (p_input->>'contract_id')::uuid; rid := (p_input->>'request_id')::uuid;
  select id into mid from public.payment_movements where request_id=rid;
  if mid is not null then
    if not exists(select 1 from public.payment_movements m where m.id=mid and m.contract_id=cid and m.amount=(p_input->>'amount')::numeric and m.received_date=(p_input->>'received_date')::date and m.method=p_input->>'method' and m.reference is not distinct from nullif(trim(p_input->>'reference'),'') and m.proof_path is not distinct from nullif(p_input->>'proof_path','') and m.notes is not distinct from nullif(p_input->>'notes',''))
    or (select jsonb_agg(jsonb_build_object('ref_month',a.ref_month,'amount',a.amount) order by a.ref_month) from public.payment_allocations a where a.movement_id=mid) is distinct from (select jsonb_agg(x order by x->>'ref_month') from jsonb_array_elements(p_input->'allocations') x) then raise exception 'A identificação já pertence a outra operação. Atualizar antes de guardar.'; end if;
    return mid;
  end if;
  perform 1 from public.contracts where id=cid for update;
  if not found then raise exception 'Contrato inexistente.'; end if;
  select id into mid from public.payment_movements where request_id=rid;
  if mid is not null then return public.gestao_register_payment(p_input); end if;
  if jsonb_typeof(p_input->'allocations') <> 'array' or jsonb_array_length(p_input->'allocations') not between 1 and 120 then raise exception 'Indicar entre 1 e 120 períodos.'; end if;
  select sum((x->>'amount')::numeric) into total from jsonb_array_elements(p_input->'allocations') x;
  if total is null or total <> (p_input->>'amount')::numeric or total <= 0 or total >= 1000000000000 then raise exception 'As parcelas não somam um pagamento válido.'; end if;
  if nullif(p_input->>'received_date','') is null then raise exception 'Falta a data do pagamento.'; end if;
  insert into public.payment_movements(contract_id,amount,received_date,method,reference,proof_path,notes,request_id,created_by)
  values(cid,total,(p_input->>'received_date')::date,p_input->>'method',nullif(trim(p_input->>'reference'),''),nullif(p_input->>'proof_path',''),nullif(p_input->>'notes',''),rid,auth.uid()) returning id into mid;
  for alloc in select * from jsonb_array_elements(p_input->'allocations') loop
    month_date := (alloc->>'ref_month')::date;
    insert into public.payment_allocations(movement_id,ref_month,amount) values(mid,month_date,(alloc->>'amount')::numeric);
    perform public.gestao_refresh_month(cid,month_date);
  end loop;
  for receipt_id in select value::text::uuid from jsonb_array_elements_text(coalesce(p_input->'receipt_ids','[]'::jsonb)) loop
    if not exists(select 1 from public.receipts r join public.payment_allocations a on a.ref_month=r.ref_month and a.movement_id=mid where r.id=receipt_id and r.contract_id=cid and not r.cancelled) then raise exception 'O recibo não corresponde ao contrato e período deste pagamento.'; end if;
    insert into public.receipt_payment_links(receipt_id,movement_id,created_by) values(receipt_id,mid,auth.uid()) on conflict do nothing;
  end loop;
  return mid;
end $$;

create or replace function public.gestao_save_event(p_input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; cid uuid;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode registar diligências.'; end if;
  cid := (p_input->>'case_id')::uuid;
  perform 1 from public.management_cases where id=cid for update;
  if not found then raise exception 'Ocorrência inexistente.'; end if;
  select id into eid from public.management_events where request_id=(p_input->>'request_id')::uuid;
  if eid is not null then return eid; end if;
  insert into public.management_events(case_id,kind,occurred_on,note,next_step,due_date,request_id,created_by)
  values(cid,p_input->>'kind',(p_input->>'occurred_on')::date,p_input->>'note',nullif(p_input->>'next_step',''),nullif(p_input->>'due_date','')::date,(p_input->>'request_id')::uuid,auth.uid()) returning id into eid;
  update public.management_cases set next_step=coalesce(nullif(p_input->>'next_step',''),next_step),due_date=coalesce(nullif(p_input->>'due_date','')::date,due_date) where id=cid;
  return eid;
end $$;

create or replace function public.gestao_void_payment(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; period date;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode corrigir pagamentos.'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Indicar o motivo da correção.'; end if;
  select contract_id into cid from public.payment_movements where id=p_id for update;
  if cid is null then raise exception 'Pagamento inexistente.'; end if;
  perform 1 from public.contracts where id=cid for update;
  perform set_config('app.audit_note',p_reason,true);
  update public.payment_movements set voided=true,void_reason=p_reason where id=p_id and not voided;
  for period in select ref_month from public.payment_allocations where movement_id=p_id loop perform public.gestao_refresh_month(cid,period); end loop;
end $$;

create or replace function public.gestao_confirm_period(p_contract uuid,p_month date,p_expected numeric,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare due_date date; due_day_value integer;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode confirmar saldos.'; end if;
  select due_day into due_day_value from public.contracts where id=p_contract;
  if due_day_value is null then raise exception 'Contrato inexistente.'; end if;
  due_date := p_month + (least(due_day_value,extract(day from (p_month + interval '1 month - 1 day'))::integer)-1);
  if due_date > (now() at time zone 'Europe/Lisbon')::date then raise exception 'O período ainda não venceu.'; end if;
  insert into public.period_confirmations(contract_id,ref_month,expected_amount,note,confirmed_by)
  values(p_contract,p_month,p_expected,p_note,auth.uid()) on conflict(contract_id,ref_month) do update
  set expected_amount=excluded.expected_amount,note=excluded.note,confirmed_by=excluded.confirmed_by,confirmed_at=now();
end $$;

create or replace function public.gestao_replace_payment(p_id uuid,p_input jsonb,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare existing uuid; old_contract uuid;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode corrigir pagamentos.'; end if;
  select id into existing from public.payment_movements where request_id=(p_input->>'request_id')::uuid;
  if existing is not null then return public.gestao_register_payment(p_input); end if;
  select contract_id into old_contract from public.payment_movements where id=p_id;
  if old_contract is null then raise exception 'Pagamento inexistente.'; end if;
  perform 1 from public.contracts where id in (old_contract,(p_input->>'contract_id')::uuid) order by id for update;
  perform public.gestao_void_payment(p_id,p_reason);
  return public.gestao_register_payment(p_input);
end $$;

create or replace function public.gestao_quota_evidence(p_property uuid,p_remainder text,p_confirmed uuid[]) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode confirmar titularidade.'; end if;
  if p_remainder not in ('por_confirmar','externa') then raise exception 'Estado das quotas inválido.'; end if;
  perform 1 from public.properties where id=p_property for update;
  if not found then raise exception 'Imóvel inexistente.'; end if;
  if exists(select 1 from unnest(p_confirmed) l where not exists(select 1 from public.property_owners o where o.property_id=p_property and o.landlord_id=l)) then raise exception 'O proprietário não tem quota neste imóvel.'; end if;
  update public.properties set quota_remainder_kind=p_remainder where id=p_property;
  update public.property_owners set quota_confirmed=(landlord_id=any(p_confirmed)) where property_id=p_property;
end $$;

create or replace function public.gestao_link_receipts(p_links jsonb,p_note text) returns integer language plpgsql security definer set search_path=public as $$
declare item jsonb; rec public.receipts; ct public.contracts; n integer := 0;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode associar recibos.'; end if;
  if jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links) not between 1 and 500 then raise exception 'Selecionar entre 1 e 500 recibos.'; end if;
  if length(trim(coalesce(p_note,'')))<3 then raise exception 'Indicar o motivo da associação.'; end if;
  perform set_config('app.audit_note',p_note,true);
  for item in select * from jsonb_array_elements(p_links) loop
    select * into rec from public.receipts where id=(item->>'receipt_id')::uuid for update;
    if rec.id is null or rec.cancelled then raise exception 'Recibo inexistente ou anulado.'; end if;
    if rec.contract_id is distinct from nullif(item->>'old_contract_id','')::uuid or rec.property_id is distinct from nullif(item->>'old_property_id','')::uuid then raise exception 'A associação mudou desde a pré-visualização. Atualizar a lista.'; end if;
    select * into ct from public.contracts where id=(item->>'contract_id')::uuid for update;
    if ct.id is null then raise exception 'Contrato inexistente.'; end if;
    update public.receipts set contract_id=ct.id,property_id=ct.property_id where id=rec.id;
    perform public.gestao_refresh_month(ct.id,rec.ref_month);
    if rec.contract_id is not null and rec.contract_id <> ct.id then perform public.gestao_refresh_month(rec.contract_id,rec.ref_month); end if;
    n := n+1;
  end loop;
  return n;
end $$;

create or replace function public.gestao_case_expense(p_input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare case_row public.management_cases; eid uuid; rid uuid;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode registar custos.'; end if;
  rid := (p_input->>'request_id')::uuid;
  select id into eid from public.expenses where request_id=rid;
  if eid is not null then return eid; end if;
  select * into case_row from public.management_cases where id=(p_input->>'case_id')::uuid for update;
  if case_row.id is null or case_row.kind <> 'manutencao' then raise exception 'Selecionar uma ocorrência de manutenção.'; end if;
  select id into eid from public.expenses where request_id=rid;
  if eid is not null then return eid; end if;
  if (p_input->>'amount')::numeric is null or (p_input->>'amount')::numeric <= 0 or (p_input->>'amount')::numeric >= 1000000000000 then raise exception 'O custo realizado deve ser positivo e finito.'; end if;
  insert into public.expenses(property_id,landlord_id,expense_date,category,amount,description,origem,case_id,request_id)
  values(case_row.property_id,nullif(p_input->>'landlord_id','')::uuid,(p_input->>'expense_date')::date,p_input->>'category',(p_input->>'amount')::numeric,
    nullif(p_input->>'description',''),'registada',case_row.id,rid) returning id into eid;
  return eid;
end $$;

do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('gestao_register_payment','gestao_void_payment','gestao_confirm_period','gestao_link_receipts','gestao_case_expense','gestao_save_event','gestao_replace_payment','gestao_quota_evidence') loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
-- Os movimentos e as repartições só mudam pelas funções transacionais.
revoke insert,update,delete on public.payment_movements,public.payment_allocations,public.receipt_payment_links,public.period_confirmations,public.management_events from authenticated;
notify pgrst,'reload schema';

-- Reconciliar documentação posterior nunca altera o dinheiro confirmado.
create or replace function public.gestao_reconcile_payment(p_movement uuid,p_receipts uuid[]) returns void language plpgsql security definer set search_path=public as $$
declare movement public.payment_movements; receipt_id uuid;
begin
  if not public.is_admin() then raise exception 'Apenas o administrador pode reconciliar recibos.'; end if;
  if coalesce(array_length(p_receipts,1),0) not between 1 and 500 then raise exception 'Selecionar entre 1 e 500 recibos.'; end if;
  select * into movement from public.payment_movements where id=p_movement for update;
  if movement.id is null or movement.voided then raise exception 'Pagamento inexistente ou anulado.'; end if;
  foreach receipt_id in array p_receipts loop
    if not exists(select 1 from public.receipts r join public.payment_allocations a on a.ref_month=r.ref_month and a.movement_id=movement.id where r.id=receipt_id and r.contract_id=movement.contract_id and not r.cancelled) then raise exception 'O recibo não corresponde ao contrato e período do pagamento.'; end if;
    insert into public.receipt_payment_links(receipt_id,movement_id,created_by) values(receipt_id,movement.id,auth.uid()) on conflict do nothing;
  end loop;
end $$;
revoke all on function public.gestao_reconcile_payment(uuid,uuid[]) from public,anon;
grant execute on function public.gestao_reconcile_payment(uuid,uuid[]) to authenticated;
drop trigger if exists gestao_audit on public.receipt_payment_links;
create trigger gestao_audit after insert on public.receipt_payment_links for each row execute function public.gestao_audit();

-- O agregado legado também fica protegido quando um import futuro o tentar atualizar.
create or replace function public.gestao_guard_payment_aggregate() returns trigger language plpgsql security definer set search_path=public as $$
declare total numeric; n integer; last_date date;
begin
  select count(*),sum(a.amount),max(m.received_date) into n,total,last_date from public.payment_movements m join public.payment_allocations a on a.movement_id=m.id where m.contract_id=new.contract_id and a.ref_month=new.ref_month and not m.voided;
  if n>0 then new.amount:=total; new.source:='manual'; new.received_date:=last_date; end if;
  return new;
end $$;
drop trigger if exists gestao_guard_payment_aggregate on public.payments;
create trigger gestao_guard_payment_aggregate before insert or update on public.payments for each row execute function public.gestao_guard_payment_aggregate();

create or replace function public.gestao_guard_expense_case() returns trigger language plpgsql as $$
begin
  if new.case_id is not null and not exists(select 1 from public.management_cases c where c.id=new.case_id and c.kind='manutencao' and c.property_id=new.property_id) then raise exception 'A intervenção deve pertencer ao imóvel da despesa.'; end if;
  return new;
end $$;
drop trigger if exists gestao_guard_expense_case on public.expenses;
create trigger gestao_guard_expense_case before insert or update on public.expenses for each row execute function public.gestao_guard_expense_case();
notify pgrst,'reload schema';
