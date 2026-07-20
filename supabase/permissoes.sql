-- ============================================================
-- CORRIGIR PERMISSÕES (erro "42501 permission denied for table ...")
--
-- Sintoma: entras na app mas não aparece o menu "Admin", ou as páginas
-- aparecem vazias mesmo com dados na base. A app assume "leitura" porque
-- nem sequer consegue ler a tabela profiles.
--
-- Causa: as tabelas criadas no SQL Editor podem não receber os GRANTs
-- para o papel 'authenticated' usado pela API do Supabase (PostgREST).
-- Nota: quem protege os dados é o RLS (já definido no schema.sql) — estes
-- GRANTs apenas permitem que utilizadores AUTENTICADOS cheguem às tabelas.
-- O papel 'anon' (visitante sem login) continua sem acesso nenhum.
--
-- Correr no SQL Editor do Supabase. Idempotente.
-- ============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Tabelas/funções criadas no futuro herdam o mesmo tratamento
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- Verificação: deve listar as tabelas da app com os privilégios concedidos.
select table_name as "Tabela",
       string_agg(privilege_type, ', ' order by privilege_type) as "Privilégios de 'authenticated'"
from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema = 'public'
group by table_name
order by table_name;
