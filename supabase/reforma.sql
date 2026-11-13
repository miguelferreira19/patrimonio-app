alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'gestor', 'viewer'));

create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'gestor')
  );
$$;
revoke all on function public.is_gestor() from public, anon;
grant execute on function public.is_gestor() to authenticated;

create table if not exists public.collection_runs (
  id uuid primary key default gen_random_uuid(),
  account text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  ok boolean not null default false,
  export_rows int,
  new_receipts int,
  new_cancelled int,
  error text
);

create table if not exists public.receipt_observations (
  id uuid primary key default gen_random_uuid(),
  receipt_key text not null,
  pf_contract_no text not null,
  account text not null,
  period_start date,
  period_end date,
  received_date date,
  amount numeric not null,
  withholding numeric not null default 0,
  state text not null check (state in ('emitido', 'anulado')),
  first_seen date,
  created_at timestamptz default now(),
  unique (receipt_key, state)
);

alter table public.collection_runs enable row level security;
alter table public.receipt_observations enable row level security;

drop policy if exists collection_runs_read on public.collection_runs;
create policy collection_runs_read on public.collection_runs
  for select to authenticated using (true);

drop policy if exists receipt_observations_read on public.receipt_observations;
create policy receipt_observations_read on public.receipt_observations
  for select to authenticated using (public.is_admin());

-- O schema antigo atribui escrita por defeito; a recolha usa a ligação direta.
revoke all on public.collection_runs, public.receipt_observations from public, anon, authenticated;
grant select on public.collection_runs, public.receipt_observations to authenticated;

alter table public.management_events drop constraint if exists management_events_kind_check;
alter table public.management_events add constraint management_events_kind_check
  check (kind in ('nota', 'contacto', 'acordo', 'visita', 'promessa', 'carta'));
alter table public.management_events add column if not exists amount numeric;

drop policy if exists management_cases_insert on public.management_cases;
create policy management_cases_insert on public.management_cases
  for insert to authenticated with check (public.is_gestor());

drop policy if exists management_cases_update on public.management_cases;
create policy management_cases_update on public.management_cases
  for update to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- DELETE continua sem GRANT nem política; os triggers gestao_guard_* mantêm-se.

create or replace function public.gestao_register_payment(p_input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid; cid uuid; rid uuid; total numeric; alloc jsonb; month_date date; receipt_id uuid;
begin
  if not public.is_gestor() then raise exception 'Só o administrador ou um gestor podem registar pagamentos.'; end if;
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
  if not public.is_gestor() then raise exception 'Só o administrador ou um gestor podem registar diligências.'; end if;
  cid := (p_input->>'case_id')::uuid;
  perform 1 from public.management_cases where id=cid for update;
  if not found then raise exception 'Ocorrência inexistente.'; end if;
  select id into eid from public.management_events where request_id=(p_input->>'request_id')::uuid;
  if eid is not null then return eid; end if;
  insert into public.management_events(case_id,kind,occurred_on,note,next_step,due_date,amount,request_id,created_by)
  values(cid,p_input->>'kind',(p_input->>'occurred_on')::date,p_input->>'note',nullif(p_input->>'next_step',''),nullif(p_input->>'due_date','')::date,nullif(p_input->>'amount','')::numeric,(p_input->>'request_id')::uuid,auth.uid()) returning id into eid;
  update public.management_cases set next_step=coalesce(nullif(p_input->>'next_step',''),next_step),due_date=coalesce(nullif(p_input->>'due_date','')::date,due_date) where id=cid;
  return eid;
end $$;

insert into public.landlords (name)
select 'Herança de Miguel Ferreira'
where not exists (select 1 from public.landlords where name = 'Herança de Miguel Ferreira');

notify pgrst, 'reload schema';
