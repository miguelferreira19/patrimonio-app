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
