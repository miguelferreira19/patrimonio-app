"""Valida a reforma numa transação revertida, sem guardar alterações."""
from pathlib import Path
import os
import re

ROOT = Path(__file__).resolve().parents[1]


def ler_sql() -> str:
    source = (ROOT / 'supabase' / 'reforma.sql').read_text(encoding='utf-8-sig')
    if re.search(r'\b(begin|commit|rollback)\s*;', source, re.I):
        raise ValueError('O SQL contém controlo de transação; validação recusada.')
    return source


def verificar(cur) -> None:
    from psycopg import sql

    cur.execute("select to_regprocedure('public.is_gestor()') is not null, "
                "to_regclass('public.collection_runs') is not null, "
                "to_regclass('public.receipt_observations') is not null")
    assert cur.fetchone() == (True, True, True), 'Faltam objetos da reforma.'
    cur.execute("select pg_get_expr(conbin, conrelid) from pg_constraint "
                "where conrelid = 'public.profiles'::regclass "
                "and conname = 'profiles_role_check' and contype = 'c'")
    constraint = cur.fetchone()
    assert constraint is not None, 'Falta o check de profiles.role.'
    query = sql.SQL('select {} from (values (%s::text)) as perfil(role)').format(
        sql.SQL(constraint[0]))
    for role, accepted in [('admin', True), ('gestor', True), ('viewer', True), ('invalido', False)]:
        cur.execute(query, (role,))
        assert cur.fetchone() == (accepted,), 'O check de profiles.role é incompatível.'


def main() -> None:
    source = ler_sql()
    from dotenv import load_dotenv
    import psycopg

    load_dotenv(ROOT / 'dados' / '.env')
    with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
        with con.transaction(force_rollback=True):
            with con.cursor() as cur:
                cur.execute("set local statement_timeout='60s'")
                # A app em produção lê `profiles` em cada pedido: se o ALTER não conseguir o
                # bloqueio depressa, desiste em vez de a deixar à espera.
                cur.execute("set local lock_timeout='5s'")
                for _ in range(2):
                    cur.execute(source)
                verificar(cur)
    print('OK: reforma.sql idempotente, revertido.')


if __name__ == '__main__':
    main()
