-- ============================================================
-- DADOS FICTÍCIOS DE DEMONSTRAÇÃO — apenas para testar a app.
-- Correr DEPOIS do schema.sql. Idempotente (UUIDs fixos + on conflict).
-- Usa meses relativos à data em que é corrido, para o dashboard
-- mostrar sempre um "mês atual" com pagamentos e atrasos.
-- Para limpar: delete from properties where id::text like '11111111%';
--              delete from market_benchmarks where source = 'demo';
-- ============================================================

-- Benchmarks fictícios (freguesias de demonstração)
insert into public.market_benchmarks (dicofre, parish_name, municipality, period, rent_median_m2, sale_median_m2, level, source)
values
  ('999901', 'Demofreguesia A', 'Democoncelho', '2025S2', 12.00, 3500, 'freguesia', 'demo'),
  ('999902', 'Demofreguesia B', 'Democoncelho', '2025S2',  9.00, 2600, 'freguesia', 'demo')
on conflict (dicofre, period, source) do nothing;

-- Frações fictícias
insert into public.properties (id, name, address, municipality, parish, dicofre, typology, area_m2, vpt, vpt_year, status)
values
  ('11111111-1111-1111-1111-000000000001', 'Rua Exemplo 1, 2º Dto',  'Rua Exemplo 1, 2º Dto',  'Democoncelho', 'Demofreguesia A', '999901', 'T2', 70, 78000, 2024, 'arrendado'),
  ('11111111-1111-1111-1111-000000000002', 'Rua Exemplo 1, 3º Esq',  'Rua Exemplo 1, 3º Esq',  'Democoncelho', 'Demofreguesia A', '999901', 'T1', 50, 61000, 2024, 'arrendado'),
  ('11111111-1111-1111-1111-000000000003', 'Av. Fictícia 25, R/C',   'Av. Fictícia 25, R/C',   'Democoncelho', 'Demofreguesia A', '999901', 'T3', 95, 92000, 2023, 'arrendado'),
  ('11111111-1111-1111-1111-000000000004', 'Trav. Teste 3, 1º',      'Trav. Teste 3, 1º',      'Democoncelho', 'Demofreguesia B', '999902', 'T2', 68, 55000, 2024, 'arrendado'),
  ('11111111-1111-1111-1111-000000000005', 'Rua Modelo 9, 4º',       'Rua Modelo 9, 4º',       'Democoncelho', 'Demofreguesia B', '999902', 'T0', 38, 39000, 2025, 'arrendado'),
  ('11111111-1111-1111-1111-000000000006', 'Largo Demo 2, Loja',     'Largo Demo 2, Loja',     'Democoncelho', 'Demofreguesia B', '999902', 'Loja', 55, 48000, 2023, 'vago')
on conflict (id) do nothing;

-- Compropriedade: 1-3 Miguel+Eva 50/50; 4-5 António; 6 Ilidio
insert into public.property_owners (property_id, landlord_id, quota)
select p.id, l.id, q.quota
from (values
  ('11111111-1111-1111-1111-000000000001', 'Miguel', 50.0), ('11111111-1111-1111-1111-000000000001', 'Eva', 50.0),
  ('11111111-1111-1111-1111-000000000002', 'Miguel', 50.0), ('11111111-1111-1111-1111-000000000002', 'Eva', 50.0),
  ('11111111-1111-1111-1111-000000000003', 'Miguel', 50.0), ('11111111-1111-1111-1111-000000000003', 'Eva', 50.0),
  ('11111111-1111-1111-1111-000000000004', 'António', 100.0),
  ('11111111-1111-1111-1111-000000000005', 'António', 100.0),
  ('11111111-1111-1111-1111-000000000006', 'Ilidio', 100.0)
) as q(pid, lname, quota)
join public.properties p on p.id = q.pid::uuid
join public.landlords l on l.name = q.lname
on conflict (property_id, landlord_id) do nothing;

-- Contratos fictícios (rendas escolhidas para haver frações abaixo/acima do mercado)
insert into public.contracts (id, property_id, tenant_name, start_date, rent, due_day, status)
values
  ('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000001', 'Inquilino Demo Um',     '2022-03-01', 700, 1, 'ativo'),  -- 10,0 €/m² vs 12 → abaixo
  ('22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000002', 'Inquilino Demo Dois',   '2024-07-01', 650, 8, 'ativo'),  -- 13,0 €/m² → acima
  ('22222222-2222-2222-2222-000000000003', '11111111-1111-1111-1111-000000000003', 'Inquilino Demo Três',   '2015-01-01', 800, 1, 'ativo'),  -- 8,4 €/m² → muito abaixo
  ('22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-000000000004', 'Inquilino Demo Quatro', '2023-10-01', 600, 1, 'ativo'),  -- 8,8 €/m² ≈ mercado
  ('22222222-2222-2222-2222-000000000005', '11111111-1111-1111-1111-000000000005', 'Inquilino Demo Cinco',  '2025-02-01', 450, 8, 'ativo')   -- 11,8 €/m² → acima
on conflict (id) do nothing;

-- Histórico de atualização de renda (exemplo no contrato 1)
insert into public.rent_updates (id, contract_id, effective_date, old_rent, new_rent, reason)
values ('33333333-3333-3333-3333-000000000001', '22222222-2222-2222-2222-000000000001',
        date_trunc('month', now())::date - interval '6 months', 680, 700, 'coeficiente')
on conflict (id) do nothing;

-- Pagamentos: últimos 8 meses (incluindo o atual), com atrasos propositados:
--   contrato 3: últimos 3 meses POR PAGAR (caso grave)
--   contratos 4 e 5: mês atual por pagar
--   contrato 2: paga em dinheiro (recebida em casa)
insert into public.payments (contract_id, ref_month, amount, received_date, method, source)
select c.id,
       m::date,
       c.rent,
       least((m + (c.due_day - 1) * interval '1 day')::date, current_date),
       case when c.id = '22222222-2222-2222-2222-000000000002' then 'dinheiro' else 'transferencia' end,
       'manual'
from public.contracts c
cross join generate_series(
  date_trunc('month', now()) - interval '7 months',
  date_trunc('month', now()),
  interval '1 month'
) as m
where c.id::text like '22222222%'
  and not (c.id = '22222222-2222-2222-2222-000000000003' and m >= date_trunc('month', now()) - interval '2 months')
  and not (c.id = '22222222-2222-2222-2222-000000000004' and m = date_trunc('month', now()))
  and not (c.id = '22222222-2222-2222-2222-000000000005' and m = date_trunc('month', now()))
on conflict (contract_id, ref_month) do nothing;

-- Recibos fictícios do Portal (histórico p/ ficha da fração 1, senhorio Miguel)
insert into public.receipts (landlord_id, property_id, contract_id, receipt_number, ref_month, amount, issue_date, source)
select l.id,
       '11111111-1111-1111-1111-000000000001'::uuid,
       '22222222-2222-2222-2222-000000000001'::uuid,
       'DEMO-' || to_char(m, 'YYYYMM'),
       m::date,
       700,
       least((m + interval '2 days')::date, current_date),
       'demo'
from public.landlords l
cross join generate_series(
  date_trunc('month', now()) - interval '7 months',
  date_trunc('month', now()),
  interval '1 month'
) as m
where l.name = 'Miguel'
on conflict (receipt_number) do nothing;

-- Despesas: condomínio mensal, IMI, obras, seguro
insert into public.expenses (property_id, expense_date, category, amount, description)
select p.id, m::date, 'condominio', e.amount, 'Condomínio (demo)'
from (values
  ('11111111-1111-1111-1111-000000000001', 35.0),
  ('11111111-1111-1111-1111-000000000002', 28.0),
  ('11111111-1111-1111-1111-000000000003', 40.0),
  ('11111111-1111-1111-1111-000000000004', 25.0),
  ('11111111-1111-1111-1111-000000000005', 22.0)
) as e(pid, amount)
join public.properties p on p.id = e.pid::uuid
cross join generate_series(
  date_trunc('month', now()) - interval '7 months',
  date_trunc('month', now()),
  interval '1 month'
) as m
where not exists (
  select 1 from public.expenses x
  where x.property_id = p.id and x.category = 'condominio' and x.expense_date = m::date
);

insert into public.expenses (property_id, expense_date, category, amount, description)
select v.pid::uuid, (date_trunc('month', now()) - interval '2 months')::date, v.cat, v.amount, v.descr
from (values
  ('11111111-1111-1111-1111-000000000001', 'imi', 195.0, 'IMI 1ª prestação (demo)'),
  ('11111111-1111-1111-1111-000000000002', 'imi', 150.0, 'IMI 1ª prestação (demo)'),
  ('11111111-1111-1111-1111-000000000003', 'imi', 230.0, 'IMI 1ª prestação (demo)'),
  ('11111111-1111-1111-1111-000000000004', 'imi', 140.0, 'IMI 1ª prestação (demo)'),
  ('11111111-1111-1111-1111-000000000005', 'imi',  98.0, 'IMI 1ª prestação (demo)'),
  ('11111111-1111-1111-1111-000000000003', 'obras', 450.0, 'Reparação canalização (demo)'),
  ('11111111-1111-1111-1111-000000000001', 'seguro', 120.0, 'Seguro multirriscos anual (demo)')
) as v(pid, cat, amount, descr)
where not exists (
  select 1 from public.expenses x
  where x.property_id = v.pid::uuid and x.category = v.cat
    and x.expense_date = (date_trunc('month', now()) - interval '2 months')::date
);
