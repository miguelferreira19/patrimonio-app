"""Import automático limitado a recibos novos; sem alterar imóveis, quotas ou contratos.

Usa o normalizador oficial em dados/. --validar executa tudo numa transação revertida.
Os exports e o SQL gerado permanecem no diretório privado, fora de Git e Vercel.
"""
from pathlib import Path
import sys
import os
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dados'
sys.path.insert(0, str(DATA))

def gerar(pasta: str) -> Path:
    import gerar_sql_import as g
    folder = (DATA / pasta).resolve()
    if folder.parent != DATA.resolve() or not folder.is_dir():
        raise ValueError('Pasta de origem inválida.')
    receipts, _ = g.build_receipts_and_payments(g.an.load_recibos(folder))
    body = g.gen_receipts_sql(receipts, g.FOLDER_TO_LANDLORD.get(pasta, pasta))
    body = body.replace('insert into public.receipts\n', 'with added as (insert into public.receipts\n')
    body = body.replace('on conflict (receipt_number) do update set withholding = excluded.withholding;',
        'on conflict (receipt_number) do nothing returning contract_id,ref_month)\n'
        'insert into pg_temp.import_periods select distinct contract_id,ref_month from added where contract_id is not null on conflict do nothing;')
    sql = ('-- Import automático: apenas recibos novos e os agregados dos seus períodos.\n'
           'create temporary table import_periods(contract_id uuid,ref_month date,primary key(contract_id,ref_month)) on commit drop;\n'
           + body + '\ndo $$ declare p record; begin for p in select * from pg_temp.import_periods loop '
           'perform public.gestao_refresh_month(p.contract_id,p.ref_month); end loop; end $$;\n')
    out = DATA / ('import_recibos_' + pasta.lower() + '.sql')
    out.write_text(sql, encoding='utf-8')
    return out

def executar(sql: Path, seco: bool) -> None:
    import psycopg
    source = sql.read_text(encoding='utf-8-sig')
    if re.search(r'^\s*(begin|commit|rollback)\s*;', source, re.I | re.M):
        raise ValueError('O SQL contém controlo de transação; execução recusada para proteger o modo seco.')
    with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
        with con.transaction(force_rollback=seco):
            with con.cursor() as cur:
                cur.execute("set local statement_timeout='60s'")
                cur.execute(source)

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != '--validar'):
        raise SystemExit('Uso: python scripts/importar_recibos_automatico.py Pasta [--validar]')
    path = gerar(sys.argv[1])
    if len(sys.argv) == 3:
        from dotenv import load_dotenv
        load_dotenv(DATA / '.env')
        import psycopg
        with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
            with con.cursor() as cur:
                cur.execute("select count(*),sum(amount) from public.payments")
                before = cur.fetchone()
                cur.execute("select count(*) from public.receipts")
                receipts_before = cur.fetchone()
        executar(path, seco=True)
        with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
            with con.cursor() as cur:
                cur.execute("select count(*),sum(amount) from public.payments")
                assert cur.fetchone() == before, 'O modo seco alterou pagamentos.'
                cur.execute("select count(*) from public.receipts")
                assert cur.fetchone() == receipts_before, 'O modo seco alterou recibos.'
        print('OK: import limitado a recibos; modo seco validado sem gravação.')
    else:
        print('SQL de recibos novos preparado no diretório privado.')
