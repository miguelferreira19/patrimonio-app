"""Import automático de recibos, anulados e observações, sem alterar fichas.

Usa o normalizador oficial em dados/. --validar reverte a transação inteira.
"""
from datetime import date
from pathlib import Path
import sys
import os
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dados'
sys.path.insert(0, str(DATA))


def sql_recibos(recibos, senhorio: str) -> str:
    import gerar_sql_import as g
    if not (recibos["Estado"] == "Emitido").any():
        return ""
    receipts, _ = g.build_receipts_and_payments(recibos)
    body = g.gen_receipts_sql(receipts, senhorio)
    body = body.replace('insert into public.receipts\n', 'with added as (insert into public.receipts\n')
    return body.replace('on conflict (receipt_number) do update set withholding = excluded.withholding;',
        'on conflict (receipt_number) do nothing returning contract_id,ref_month)\n'
        'insert into pg_temp.import_periods select distinct contract_id,ref_month from added '
        'where contract_id is not null on conflict do nothing;')


def sql_anulados(recibos) -> str:
    import gerar_sql_import as g
    chaves = set()
    for r in recibos.itertuples(index=False):
        if str(r.Estado).strip().lower() != "anulado":
            continue
        chave = f"{r.NContrato}/{r.NRecibo}"
        chaves.add(chave)
        n = len(g.an.mes_range(r.DataInicio, r.DataFim))
        if n > 1:
            chaves.update(f"{chave}#{i}" for i in range(1, n + 1))
    blocos = []
    for bloco in g.chunks(sorted(chaves), g.CHUNK):
        valores = ", ".join(g.sql_str(chave) for chave in bloco)
        blocos.append('with cancelled as (update public.receipts set cancelled = true\n'
                      f'where receipt_number = any(array[{valores}]::text[]) and not cancelled\n'
                      'returning contract_id, ref_month)\n'
                      'insert into pg_temp.import_periods select distinct contract_id, ref_month '
                      'from cancelled where contract_id is not null on conflict do nothing;')
    return "\n".join(blocos)


def sql_observacoes(observacoes: list[dict], *, usar_contexto: bool = False) -> str:
    import gerar_sql_import as g
    colunas = ("receipt_key", "pf_contract_no", "account", "period_start", "period_end",
               "received_date", "amount", "withholding", "state", "first_seen")
    datas = {"period_start", "period_end", "received_date", "first_seen"}
    blocos = []
    for bloco in g.chunks(observacoes, g.CHUNK):
        valores = []
        for obs in bloco:
            linha = [g.sql_date(obs[c]) if c in datas else g.sql_dec(obs[c])
                     if c in ("amount", "withholding") else g.sql_str(obs[c]) for c in colunas]
            if usar_contexto:
                linha[-1] = "(select first_seen from pg_temp.import_ctx)"
            valores.append("(" + ", ".join(linha) + ")")
        blocos.append("insert into public.receipt_observations (" + ", ".join(colunas) + ")\nvalues\n"
                      + ",\n".join(valores) + "\non conflict (receipt_key, state) do nothing;")
    return "\n".join(blocos)


def gerar(pasta: str) -> Path:
    import gerar_sql_import as g
    folder = (DATA / pasta).resolve()
    if folder.parent != DATA.resolve() or not folder.is_dir():
        raise ValueError('Pasta de origem inválida.')
    recibos = g.an.load_recibos(folder)
    sql = '\n'.join([
        '-- Import automático: recibos, anulados, observações e períodos afetados.',
        'create temporary table import_periods(contract_id uuid,ref_month date,'
        'primary key(contract_id,ref_month)) on commit drop;',
        '-- 1. Recibos novos', sql_recibos(recibos, g.FOLDER_TO_LANDLORD.get(pasta, pasta)),
        '-- 2. Anulados', sql_anulados(recibos),
        'create temporary table import_ctx on commit drop as select case when exists '
        f'(select 1 from public.receipt_observations where account = {g.sql_str(pasta)}) '
        f"then date '{date.today():%Y-%m-%d}' end as first_seen;",
        '-- 3. Observações', sql_observacoes(g.build_observations(recibos, pasta, None), usar_contexto=True),
        '-- 4. Atualizar períodos',
        'do $$ declare p record; begin for p in select * from pg_temp.import_periods loop '
        'perform public.gestao_refresh_month(p.contract_id,p.ref_month); end loop; end $$;\n',
    ])
    out = DATA / ('import_recibos_' + pasta.lower() + '.sql')
    out.write_text(sql, encoding='utf-8')
    return out


def executar(sql: Path, seco: bool) -> None:
    source = sql.read_text(encoding='utf-8-sig')
    if re.search(r'^\s*(begin|commit|rollback)\s*;', source, re.I | re.M):
        raise ValueError('O SQL contém controlo de transação; execução recusada para proteger o modo seco.')
    import psycopg
    with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
        with con.transaction(force_rollback=seco):
            with con.cursor() as cur:
                cur.execute("set local statement_timeout='60s'")
                cur.execute(source)


def registar_corrida(conta, inicio, fim, ok, export_rows, new_receipts, new_cancelled, erro,
                     *, seco: bool = False, logger=print) -> None:
    try:
        import psycopg
        with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
            with con.transaction(force_rollback=seco):
                with con.cursor() as cur:
                    cur.execute("set local statement_timeout='15s'")
                    cur.execute('insert into public.collection_runs '
                                '(account, started_at, finished_at, ok, export_rows, '
                                'new_receipts, new_cancelled, error) values (%s,%s,%s,%s,%s,%s,%s,%s)',
                                (conta, inicio, fim, ok, export_rows, new_receipts, new_cancelled, erro))
    except Exception:
        try:
            logger('AVISO: não foi possível registar a corrida em collection_runs.')
        except Exception:
            pass  # O registo nunca pode interromper as outras contas, nem por falha do log.

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
