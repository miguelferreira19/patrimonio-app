-- ============================================================
-- Promover o primeiro utilizador a ADMINISTRADOR
--
-- Quando usar: entraste na app mas não aparece a entrada "Admin" no menu
-- (ou não consegues editar nada). Isso significa que a linha em public.profiles
-- não existe ou ficou com role='viewer' — acontece se o utilizador foi criado
-- no painel do Supabase antes de o schema.sql ter sido corrido, ou se o trigger
-- on_auth_user_created não chegou a disparar.
--
-- Correr no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- 1) Garante que existe perfil para o utilizador MAIS ANTIGO e põe-no como admin.
insert into public.profiles (id, email, role)
select u.id, u.email, 'admin'
from (
  select id, email from auth.users order by created_at asc limit 1
) u
on conflict (id) do update
  set role = 'admin',
      email = excluded.email;

-- 2) Garante perfil (leitura) para quaisquer outros utilizadores sem linha em profiles.
insert into public.profiles (id, email, role)
select u.id, u.email, 'viewer'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 3) Verificação — deve mostrar o teu email com role = 'admin'.
select p.email as "Email",
       p.role  as "Papel",
       u.created_at as "Criado em"
from public.profiles p
join auth.users u on u.id = p.id
order by u.created_at;
