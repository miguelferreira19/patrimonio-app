"""Valida a migração e fluxos em transação revertida. --aplicar só depois de autorizado."""
from pathlib import Path
from uuid import uuid4
import os
import sys
import json
import hashlib
import psycopg
from psycopg.types.json import Jsonb
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / 'dados/.env')
SQL = (ROOT / 'supabase/gestao-operacional.sql').read_text(encoding='utf-8-sig')
APLICAR = sys.argv[1:] == ['--aplicar']
assert APLICAR or not sys.argv[1:], 'Argumento desconhecido'
checks = []

def ok(message):
    checks.append(message)

with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
    with con.cursor() as cur:
        cur.execute("set local statement_timeout='60s'")
        cur.execute('select count(*),sum(amount) from public.payments')
        before = cur.fetchone()
        cur.execute(SQL)
        cur.execute(SQL)
        cur.execute('select count(*),sum(amount) from public.payments')
        assert cur.fetchone() == before
        ok('Migracao idempotente; historico financeiro preservado')
        cur.execute("select id from public.profiles where role='admin' order by id limit 1")
        admin = cur.fetchone()[0]
        cur.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(admin),))
        cur.execute('set local role authenticated')
        cur.execute("insert into public.properties(name,status) values('QA temporario: rollback','vago') returning id")
        prop = cur.fetchone()[0]
        cur.execute("insert into public.contracts(property_id,tenant_name,rent,start_date,due_day,status) values(%s,'QA rollback',500,'2026-01-01',1,'ativo') returning id", (prop,))
        contract = cur.fetchone()[0]
        payment = dict(contract_id=str(contract), request_id=str(uuid4()), amount=700, received_date='2026-10-09', method='transferencia', reference='QA-' + str(uuid4()), allocations=[dict(ref_month='2026-10-01',amount=100),dict(ref_month='2026-11-01',amount=600)], receipt_ids=[])
        cur.execute('select public.gestao_register_payment(%s)', (Jsonb(payment),))
        movement = cur.fetchone()[0]
        cur.execute('select public.gestao_register_payment(%s)', (Jsonb(payment),))
        assert cur.fetchone()[0] == movement
        cur.execute('select amount,source from public.payments where contract_id=%s and ref_month=%s', (contract,'2026-10-01'))
        assert cur.fetchone() == (100,'manual')
        ok('Pagamento parcial e adiantamento repartidos; repeticao nao duplica')
        cur.execute('reset role')
        cur.execute('select count(*) from public.payment_movements where contract_id=%s', (contract,))
        movement_count = cur.fetchone()[0]
        cur.execute(SQL)
        cur.execute('select count(*) from public.payment_movements where contract_id=%s', (contract,))
        assert cur.fetchone()[0] == movement_count
        ok('Repetir a migracao depois de movimentos novos nao duplica o legado')
        cur.execute('select id from public.landlords order by id limit 1')
        landlord = cur.fetchone()[0]
        cur.execute("insert into public.receipts(landlord_id,property_id,contract_id,receipt_number,ref_month,amount,withholding,issue_date) values(%s,%s,%s,%s,'2026-10-01',500,0,'2026-10-09') returning id", (landlord,prop,contract,'QA/' + str(uuid4())))
        receipt = cur.fetchone()[0]
        cur.execute("insert into public.payments(contract_id,ref_month,amount,source) values(%s,'2026-10-01',500,'recibo') on conflict(contract_id,ref_month) do nothing", (contract,))
        cur.execute('select amount,source from public.payments where contract_id=%s and ref_month=%s', (contract,'2026-10-01'))
        assert cur.fetchone() == (100,'manual')
        ok('Recibo posterior nao soma novamente o pagamento confirmado')
        cur.execute('set local role authenticated')
        cur.execute('select public.gestao_reconcile_payment(%s,%s)', (movement,[receipt]))
        cur.execute('select public.gestao_reconcile_payment(%s,%s)', (movement,[receipt]))
        cur.execute('select count(*) from public.receipt_payment_links where receipt_id=%s and movement_id=%s', (receipt,movement))
        assert cur.fetchone()[0] == 1
        cur.execute('savepoint different_request')
        try:
            cur.execute('select public.gestao_register_payment(%s)', (Jsonb({**payment,'amount':701}),))
            raise AssertionError('Identificacao reaproveitada para montante diferente')
        except psycopg.Error:
            cur.execute('rollback to savepoint different_request')
        ok('Reconciliacao idempotente; mesma identificacao com montante diferente rejeitada')
        cur.execute("insert into public.receipts(landlord_id,receipt_number,ref_month,amount,withholding) values(%s,%s,'2026-11-01',10,0) returning id", (landlord,'QA/orphan/' + str(uuid4())))
        orphan = cur.fetchone()[0]
        plan = [dict(receipt_id=str(orphan),contract_id=str(contract),old_contract_id=None,old_property_id=None)]
        cur.execute('select public.gestao_link_receipts(%s,%s)', (Jsonb(plan),'Associacao documental de teste, revertida'))
        assert cur.fetchone()[0] == 1
        cur.execute("select amount,source from public.payments where contract_id=%s and ref_month='2026-11-01'", (contract,))
        assert cur.fetchone() == (600,'manual')
        cur.execute('savepoint stale_plan')
        try:
            cur.execute('select public.gestao_link_receipts(%s,%s)', (Jsonb(plan),'Plano anterior'))
            raise AssertionError('Pre-visualizacao desatualizada aceite')
        except psycopg.Error:
            cur.execute('rollback to savepoint stale_plan')
        ok('Associacao de recibo preserva pagamento confirmado; plano desatualizado rejeitado')
        cur.execute("select public.gestao_confirm_period(%s,'2026-10-01',500,'Conferencia de saldo de teste, revertida')", (contract,))
        cur.execute('select expected_amount from public.period_confirmations where contract_id=%s', (contract,))
        assert cur.fetchone()[0] == 500
        cur.execute('savepoint invalid_operation')
        try:
            cur.execute("select public.gestao_confirm_period(%s,'2099-01-01',500,'Futuro')", (contract,))
            raise AssertionError('Saldo futuro aceite')
        except psycopg.Error:
            cur.execute('rollback to savepoint invalid_operation')
        ok('Saldo confirmado separado; periodo futuro rejeitado')
        replacement = {**payment, 'request_id':str(uuid4()), 'amount':450, 'reference':'QA-'+str(uuid4()), 'allocations':[dict(ref_month='2026-10-01',amount=450)],'receipt_ids':[str(receipt)]}
        cur.execute('select public.gestao_replace_payment(%s,%s,%s)', (movement,Jsonb(replacement),'Correcao temporaria de teste'))
        replacement_id = cur.fetchone()[0]
        cur.execute('select amount from public.payments where contract_id=%s and ref_month=%s', (contract,'2026-10-01'))
        assert cur.fetchone()[0] == 450
        cur.execute('select voided from public.payment_movements where id=%s', (movement,))
        assert cur.fetchone()[0] is True
        cur.execute('select count(*) from public.receipt_payment_links where movement_id=%s', (replacement_id,))
        assert cur.fetchone()[0] == 1
        ok('Correcao atomica conserva o movimento original e liga o recibo')
        cur.execute('select public.gestao_void_payment(%s,%s)', (replacement_id,'Anulacao temporaria, revertida'))
        cur.execute('select amount,source from public.payments where contract_id=%s and ref_month=%s', (contract,'2026-10-01'))
        assert cur.fetchone() == (500,'recibo')
        ok('Anulacao recupera inferencia documental sem afirmar pagamento confirmado')
        cur.execute("insert into public.management_cases(kind,property_id,title,request_id) values('manutencao',%s,'QA rollback',%s) returning id", (prop,uuid4()))
        case = cur.fetchone()[0]
        expense = dict(case_id=str(case),request_id=str(uuid4()),amount=125,expense_date='2026-10-09',category='obras',description='QA rollback')
        cur.execute('select public.gestao_case_expense(%s)', (Jsonb(expense),))
        expense_id = cur.fetchone()[0]
        cur.execute('select public.gestao_case_expense(%s)', (Jsonb(expense),))
        assert cur.fetchone()[0] == expense_id
        cur.execute('select count(*),sum(amount) from public.expenses where case_id=%s', (case,))
        assert cur.fetchone() == (1,125)
        ok('Custo realizado ligado a manutencao contado uma vez')
        event = dict(case_id=str(case),request_id=str(uuid4()),kind='contacto',occurred_on='2026-10-09',note='QA rollback',next_step='Proxima diligencia QA',due_date='2026-10-15')
        cur.execute('select public.gestao_save_event(%s)', (Jsonb(event),))
        event_id = cur.fetchone()[0]
        cur.execute('select public.gestao_save_event(%s)', (Jsonb(event),))
        assert cur.fetchone()[0] == event_id
        cur.execute('select next_step from public.management_cases where id=%s', (case,))
        assert cur.fetchone()[0] == 'Proxima diligencia QA'
        ok('Diligencia e proximo passo persistem na mesma transacao')
        cur.execute("select count(*) from public.operation_history where entity_table='payment_movements' and entity_id=%s", (str(movement),))
        assert cur.fetchone()[0] >= 2
        cur.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(uuid4()),))
        for sql,args in [('select public.gestao_void_payment(%s,%s)',(replacement_id,'Tentativa de viewer')),('update public.payment_movements set amount=1 where id=%s',(replacement_id,)),('delete from public.operation_history where entity_id=%s',(str(movement),))]:
            cur.execute('savepoint viewer_write')
            try:
                cur.execute(sql,args)
                raise AssertionError('Escrita indevida aceite')
            except psycopg.Error:
                cur.execute('rollback to savepoint viewer_write')
        ok('Viewer nao escreve movimentos nem apaga historico')
    con.rollback()

if APLICAR:
    with psycopg.connect(os.environ['SUPABASE_DB_URL'], connect_timeout=15) as con:
        with con.cursor() as cur:
            snapshot = {}
            for table in ['properties','property_owners','contracts','receipts','payments','expenses','rent_updates']:
                cur.execute('select row_to_json(t) from public.' + table + ' t')
                snapshot[table] = [r[0] for r in cur.fetchall()]
            backup_path = ROOT / 'dados/_recolhas/2026-10-09/antes-gestao.json'
            if not backup_path.exists(): backup_path.write_text(json.dumps(snapshot,default=str,ensure_ascii=False),encoding='utf-8')
            cur.execute('select count(*),sum(amount) from public.payments')
            before = cur.fetchone()
            cur.execute(SQL)
            cur.execute('select count(*),sum(amount) from public.payments')
            assert cur.fetchone() == before
        con.commit()
    ok('Migracao aplicada; dados financeiros anteriores preservados')
else:
    ok('Todos os registos de teste e a migracao foram revertidos')

report = {'modo':'aplicado' if APLICAR else 'simulado_e_revertido','sha256':hashlib.sha256(SQL.encode()).hexdigest(),'checks':checks}
(ROOT / '.vercel/gestao-validacao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
for check in checks: print('OK:',check)
