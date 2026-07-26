-- Conferencia das rendas: BD vs Portal das Financas
-- Gerado por dados/auditoria_rendas.py em 2026-07-25.
-- Colar no SQL Editor do Supabase. ZERO LINHAS = a BD esta conferida.
with portal(pfno, renda) as (values
    ('68665', 296.00),
    ('6426872', 450.00),
    ('35408', 317.00),
    ('68650', 307.00),
    ('5451653', 420.00),
    ('68661', 296.00),
    ('4808952', 430.00),
    ('2589810', 307.00),
    ('68670', 307.00),
    ('68613', 307.00),
    ('68683', 301.00),
    ('5296812', 357.00),
    ('35510', 311.00),
    ('966739', 317.00),
    ('3190654', 438.00),
    ('512780', 328.00),
    ('4779446', 320.00),
    ('35519', 295.00),
    ('6558275', 500.00),
    ('1031664', 318.00),
    ('512797', 200.00),
    ('5416923', 460.00),
    ('68631', 50.00),
    ('6204271', 600.00),
    ('3328441', 250.00),
    ('668483', 250.00),
    ('4331105', 342.00),
    ('5847921', 650.00),
    ('4968014', 327.00),
    ('34924', 318.00),
    ('68686', 296.00),
    ('68691', 307.00),
    ('4225402', 342.00),
    ('6022750', 520.00),
    ('6582185', 550.00),
    ('5177694', 450.00),
    ('1825765', 331.00),
    ('3043556', 331.00),
    ('3668000', 301.00),
    ('5928053', 650.00),
    ('4774854', 357.00),
    ('1905921', 330.00),
    ('1863307', 307.00)
)
select
  c.pf_contract_no,
  p.matriz_article,
  c.tenant_name,
  c.rent            as renda_na_bd,
  portal.renda      as renda_no_portal,
  c.rent - portal.renda as diferenca
from portal
join public.contracts c on c.pf_contract_no = portal.pfno
left join public.properties p on p.id = c.property_id
where c.rent is distinct from portal.renda
union all
-- contratos ativos na BD que o Portal nao conhece (ou com o numero trocado)
select c.pf_contract_no, p.matriz_article, c.tenant_name, c.rent,
       null::numeric, null::numeric
from public.contracts c
left join public.properties p on p.id = c.property_id
where c.status = 'ativo'
  and c.pf_contract_no not in (select pfno from portal)
order by 1;
