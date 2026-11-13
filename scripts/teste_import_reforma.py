"""Checks sintéticos da reforma do import, sem base, credenciais ou rede."""
import contextlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import io
import os
from pathlib import Path
import re
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "dados"), str(ROOT / "scripts")]
import gerar_sql_import as g
import importar_recibos_automatico as imp


def recibos():
    import pandas as pd
    return pd.DataFrame([
        {"NContrato": "N", "NRecibo": "E", "DataInicio": pd.Timestamp("2026-01-01"),
         "DataFim": pd.Timestamp("2026-02-28"), "DataRec": pd.Timestamp("2026-03-04"),
         "Valor": 1000.01, "ImportanciaRecebida": 750.01, "RetencaoIRS": 250,
         "Imovel": "artigo-ensaio", "Estado": "Emitido"},
        {"NContrato": "N", "NRecibo": "R", "DataInicio": pd.Timestamp("2026-01-31"),
         "DataFim": pd.Timestamp("2026-02-01"), "DataRec": pd.NaT,
         "Valor": 600, "ImportanciaRecebida": 450, "RetencaoIRS": 150,
         "Imovel": "artigo-ensaio", "Estado": "Anulado"},
    ])


def check_observacoes():
    df = recibos()
    antes = df.copy(deep=True)
    obs = g.build_observations(df, "Ensaio", date(2026, 8, 17))
    assert len(obs) == 2
    assert obs[0] == {"receipt_key": "N/E", "pf_contract_no": "N", "account": "Ensaio",
                      "period_start": date(2026, 1, 1), "period_end": date(2026, 2, 28),
                      "received_date": date(2026, 3, 4), "amount": Decimal("1000.01"),
                      "withholding": Decimal("250.00"), "state": "emitido",
                      "first_seen": date(2026, 8, 17)}
    assert obs[1]["receipt_key"] == "N/R" and obs[1]["state"] == "anulado"
    assert obs[1]["received_date"] is None
    assert g.build_observations(df, "Ensaio", None)[0]["first_seen"] is None
    assert g.build_observations(df.iloc[:0], "Ensaio", None) == []
    assert df.equals(antes)


def sql_sintetico(df):
    with tempfile.TemporaryDirectory() as td:
        raiz = Path(td)
        (raiz / "Ensaio").mkdir()
        with patch.object(imp, "DATA", raiz), patch.object(g.an, "load_recibos", return_value=df):
            return imp.gerar("Ensaio").read_text(encoding="utf-8")


def check_sql():
    sql = sql_sintetico(recibos())
    ordem = [sql.index(t) for t in ("insert into public.receipts\n", "set cancelled = true",
                                   "insert into public.receipt_observations", "gestao_refresh_month")]
    assert ordem == sorted(ordem)
    assert all(g.sql_str(chave) in sql for chave in ("N/R", "N/R#1", "N/R#2"))
    assert "N/R#3" not in sql
    assert "and not cancelled" in sql
    assert "returning contract_id, ref_month" in sql
    cancelamento = sql[sql.index("set cancelled = true"):sql.index("insert into public.receipt_observations")]
    assert "insert into pg_temp.import_periods" in cancelamento
    assert "where contract_id is not null on conflict do nothing" in cancelamento
    assert "on conflict (receipt_key, state) do nothing" in sql
    assert "on conflict (receipt_number) do nothing" in sql
    assert not re.search(r"^\s*(begin|commit|rollback)\s*;", sql, re.I | re.M)
    assert "insert into public.receipts\n" not in sql_sintetico(recibos().iloc[1:])
    assert "set cancelled = true" in sql_sintetico(recibos().iloc[1:])
    vazio = sql_sintetico(recibos().iloc[:0])
    assert "insert into public.receipts\n" not in vazio
    assert "insert into public.receipt_observations" not in vazio
    for tabela in ("properties", "contracts", "payments", "property_owners"):
        assert "insert into public." + tabela not in sql
        assert "update public." + tabela not in sql


def check_contexto_primeira_corrida():
    hoje = date(2030, 4, 5)
    with patch.object(imp, "date") as relogio, patch.object(g, "CHUNK", 1):
        relogio.today.return_value = hoje
        sql = sql_sintetico(recibos())
    contexto = "create temporary table import_ctx on commit drop as select case when exists "
    assert sql.count(contexto) == 1
    assert sql.index(contexto) < sql.index("-- 3. Observações")
    assert ("(select 1 from public.receipt_observations where account = 'Ensaio') "
            f"then date '{hoje}' end as first_seen;") in sql
    blocos = re.findall(r"insert into public\.receipt_observations.*?"
                        r"on conflict \(receipt_key, state\) do nothing;", sql, re.S)
    assert len(blocos) == 2
    for bloco in blocos:
        assert "(select first_seen from pg_temp.import_ctx)" in bloco
        assert str(hoje) not in bloco


def check_erro_seguro():
    import recolher_recibos as r
    conta = r.Conta("Ensaio", "Ensaio", "nif-ficticio", "senha-ficticia")
    segredos = (conta.nif, conta.senha, "ligacao-privada",
                "postgresql://u:p@h/db", "postgres://outro:segredo@h/db")
    with patch.dict(os.environ, {"SUPABASE_DB_URL": segredos[2]}, clear=True):
        texto = "o export tem 12 colunas " + " ".join(segredos + segredos) + " fim"
        mensagem = r.erro_seguro(RuntimeError(texto), conta)
        assert mensagem.startswith("RuntimeError: o export tem 12 colunas ")
        assert mensagem.endswith(" fim") and mensagem.count("***") == 10
        assert all(segredo not in mensagem for segredo in segredos)
        longo = r.erro_seguro(RuntimeError("x" * 480 + conta.senha + "y" * 100), conta)
        assert len(longo) == 500 and conta.senha not in longo and "***" in longo
    with patch.dict(os.environ, {"SUPABASE_DB_URL": ""}, clear=True):
        assert r.erro_seguro(RuntimeError("o export tem 12 colunas")) == (
            "RuntimeError: o export tem 12 colunas")
        assert r.erro_seguro(RuntimeError("PF_SENHA_B")) == "Falta PF_SENHA_B."
        assert r.erro_seguro(ValueError("texto"), r.Conta("", "", "", "")) == "ValueError: texto"
        assert r.erro_seguro(RuntimeError("postgresql://u:p@h/db fim")) == "RuntimeError: *** fim"


def check_autoteste_log_temporario():
    import recolher_recibos as r
    original = r.LOG
    caminhos = []

    def verificar_log():
        assert r.LOG != original and r.LOG.parent.is_dir()
        caminhos.append(r.LOG)
        r.log("Ensaio do log isolado.")
        assert "Ensaio do log isolado." in r.LOG.read_text(encoding="utf-8")

    with patch.object(r, "autoteste_contas", verificar_log), patch.object(r, "autoteste_arquivo"), \
            contextlib.redirect_stdout(io.StringIO()):
        r.autoteste()
    assert caminhos and not caminhos[0].parent.exists()
    assert r.LOG == original


def check_primeira_vez():
    import backfill_observacoes as b
    df = recibos().iloc[:1].copy()
    segundo = df.copy()
    segundo.loc[segundo.index[0], "NRecibo"] = "NOVO"
    terceiro = segundo.copy()
    terceiro.loc[terceiro.index[0], "Estado"] = "Anulado"
    recolhas = [(date(2026, 8, 24), "Ensaio", terceiro),
                (date(2026, 8, 17), "Ensaio", df),
                (date(2026, 8, 20), "Ensaio", segundo),
                (date(2026, 8, 24), "Outra", terceiro)]
    obs = b.primeiras_observacoes(recolhas)
    por_chave = {(o["receipt_key"], o["state"]): o["first_seen"] for o in obs}
    assert por_chave == {("N/E", "emitido"): None,
                         ("N/NOVO", "emitido"): date(2026, 8, 20),
                         ("N/NOVO", "anulado"): date(2026, 8, 24)}
    assert b.primeiras_observacoes([]) == []
    assert len(b.primeiras_observacoes(recolhas + recolhas)) == 3
    assert df.iloc[0]["Estado"] == "Emitido"
    sql = b.sql_backfill(obs)
    assert "import_ctx" not in sql
    assert g.sql_date(date(2026, 8, 20)) in sql
    assert g.sql_date(date(2026, 8, 24)) in sql


class BaseFalsa:
    def __init__(self):
        self.transacoes = []
        self.comandos = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def transaction(self, **kwargs):
        self.transacoes.append(kwargs)
        return self

    def cursor(self):
        return self

    def execute(self, sql, params=None):
        self.comandos.append((sql, params))


def check_corridas_e_seco():
    import recolher_recibos as r
    base = BaseFalsa()
    ligacoes = []

    def ligar(url, **kwargs):
        ligacoes.append(url)
        return base

    agora = datetime(2026, 8, 17, tzinfo=timezone.utc)
    with tempfile.TemporaryDirectory() as td, patch.dict(os.environ, {"SUPABASE_DB_URL": "base-falsa"}, clear=True):
        conta = r.Conta("Ensaio", "Ensaio", "nif-ficticio", "senha-privada")
        mensagem = r.erro_seguro(RuntimeError("falha senha-privada nif-ficticio base-falsa fim"), conta)
        sql = Path(td) / "ensaio.sql"
        sql.write_text("select 1;", encoding="utf-8")
        with patch.dict(sys.modules, {"psycopg": SimpleNamespace(connect=ligar)}):
            imp.executar(sql, seco=True)
            imp.registar_corrida("Ensaio", agora, agora, True, 2, None, None, None, seco=True)
            imp.registar_corrida("Ensaio", agora, agora, False, None, None, None, mensagem, seco=True)
        assert base.transacoes == [{"force_rollback": True}] * 3
        assert ligacoes == ["base-falsa"] * 3
        registos = [p for comando, p in base.comandos if "collection_runs" in comando]
        assert len(registos) == 2 and registos[0][3:7] == (True, 2, None, None)
        assert registos[1][3] is False and registos[1][-1] == mensagem == "RuntimeError: falha *** *** *** fim"
        sql.write_text("commit;", encoding="utf-8")
        try:
            imp.executar(sql, seco=True)
        except ValueError:
            pass
        else:
            raise AssertionError("Aceitou SQL com controlo de transação.")
    with patch.dict(os.environ, {}, clear=True), contextlib.redirect_stdout(io.StringIO()) as saida:
        imp.registar_corrida("Ensaio", agora, agora, False, None, None, None, None)
    assert "collection_runs" in saida.getvalue()


def check_registo_nao_interrompe():
    import recolher_recibos as r

    def falhar(*args, **kwargs):
        raise OSError("Falha sintética.")

    agora = datetime.now(timezone.utc)
    args = ("Ensaio", agora, agora, False, None, None, None, None)
    with patch.object(imp, "registar_corrida", side_effect=falhar), patch.object(r, "log", falhar):
        r.registar_corrida(*args)
    with patch.dict(sys.modules, {"psycopg": None}):
        imp.registar_corrida(*args, logger=falhar)

def check_config_e_arquivo():
    import recolher_recibos as r
    with patch.dict(os.environ, {"PF_NIF": "legado", "PF_SENHA": "segredo"}, clear=True):
        assert r.contas() == [r.Conta("Pai", "Pai", "legado", "segredo")]
        os.environ["PF_PASTA"] = "Pasta antiga"
        assert r.contas()[0].pasta == "Pasta antiga"
    with patch.dict(os.environ, {"PF_CONTAS": "Herança", "PF_NIF_HERANCA": "ensaio",
                                "PF_SENHA_HERANCA": "segredo"}, clear=True):
        assert r.contas()[0].nome == "Herança"
        assert r.contas()[0].nif == "ensaio"
    with tempfile.TemporaryDirectory() as td:
        raiz = Path(td)
        hoje = date.today()
        antigo = hoje - timedelta(days=30)
        for caminho in (f"{antigo}/Pai/ListaRecibos.xlsx", f"{hoje}/Outra/ListaRecibos.xlsx"):
            destino = raiz / caminho
            destino.parent.mkdir(parents=True)
            destino.touch()
        assert r.dias_desde_ultima(raiz) == 0
        assert r.dias_desde_ultima(raiz, "Pai") == 30
        assert r.dias_desde_ultima(raiz, "Outra") == 0
        assert r.dias_desde_ultima(raiz, "Nova") is None
        (raiz / str(hoje) / "ListaRecibos.xlsx").touch()
        assert r.dias_desde_ultima(raiz, "Pai") == 0

def check_recolha_regista():
    import recolher_recibos as r
    chamadas = []
    aplicados = []
    ambiente = {"PF_CONTAS": "A,B", "PF_NIF_A": "nif-a", "PF_SENHA_A": "senha-a",
                "PF_NIF_B": "nif-b", "PF_SENHA_B": "senha-b"}

    def descarregar(destino, conta, **kwargs):
        if conta.nome == "A":
            raise RuntimeError(f"o export tem 12 colunas {conta.nif} {conta.senha} postgresql://u:p@h/db fim")
        return 4

    def registar(*args, **kwargs):
        chamadas.append((args, kwargs))

    with tempfile.TemporaryDirectory() as td, patch.dict(os.environ, ambiente, clear=True):
        raiz = Path(td)
        for nome in ("A", "B"):
            (raiz / nome).mkdir()
        with patch.multiple(r, BASE=raiz, LOG=raiz / "log", ARQUIVO=raiz / "arquivo"), \
                patch.object(r, "load_dotenv"), patch.object(r, "registar_corrida", registar), \
                patch.object(r, "gerar_sql", return_value=raiz / "ensaio.sql"), \
                patch.object(r, "aplicar", side_effect=lambda sql, seco: aplicados.append(seco)), \
                contextlib.redirect_stdout(io.StringIO()):
            assert r.main(["--seco"], descarregar) == 1
        assert len(chamadas) == 2 and aplicados == [True]
        falha, sucesso = chamadas
        assert falha[0][0] == "A" and falha[0][3] is False
        assert sucesso[0][0] == "B" and sucesso[0][3:7] == (True, 4, None, None)
        assert falha[1]["seco"] and sucesso[1]["seco"]
        assert "nif-a" not in falha[0][-1] and "senha-a" not in falha[0][-1]
        assert falha[0][-1] == "RuntimeError: o export tem 12 colunas *** *** *** fim"
        assert "ERRO: " + falha[0][-1] in (raiz / "log").read_text(encoding="utf-8")
        assert not (raiz / "arquivo").exists()

def check_backfill_seco():
    import backfill_observacoes as b
    with tempfile.TemporaryDirectory() as td:
        raiz = Path(td)
        for caminho in ("2026-08-17/ListaRecibos.xlsx", "2026-08-20/ContaPrivada/ListaRecibos.xlsx"):
            destino = raiz / caminho
            destino.parent.mkdir(parents=True)
            destino.touch()
        arquivos = b.exports_arquivados(raiz)
        assert [(dia, conta) for dia, conta, _ in arquivos] == [
            (date(2026, 8, 17), "Pai"), (date(2026, 8, 20), "ContaPrivada")]
        with patch.object(g.an, "load_recibos", return_value=recibos()), \
                patch.dict(sys.modules, {"psycopg": None}), contextlib.redirect_stdout(io.StringIO()) as saida:
            assert b.main(["--seco"], raiz=raiz) == 0
        assert "ContaPrivada" not in saida.getvalue()
        assert "2026-08-17" in saida.getvalue() and "2026-08-20" in saida.getvalue()


def main():
    for check in (check_erro_seguro, check_autoteste_log_temporario, check_observacoes, check_sql,
                  check_contexto_primeira_corrida, check_primeira_vez, check_corridas_e_seco,
                  check_backfill_seco, check_recolha_regista, check_config_e_arquivo, check_registo_nao_interrompe):
        check()
    assert g.FOLDER_TO_LANDLORD.get("Heranca") == "Herança de Miguel Ferreira"
    print("OK: observações, anulados, ordem SQL, primeira observação, corridas e modo seco.")


if __name__ == "__main__":
    main()
