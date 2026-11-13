"""Recupera observações dos arquivos datados. --seco mostra apenas contagens."""
import argparse
from collections import Counter
from datetime import date
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "dados"), str(ROOT / "scripts")]
import gerar_sql_import as g
from importar_recibos_automatico import sql_observacoes


def primeiras_observacoes(recolhas) -> list[dict]:
    """A primeira fotografia de cada conta não prova a data de aparecimento."""
    primeiras_datas = {}
    for dia, conta, _ in recolhas:
        primeiras_datas[conta] = min(dia, primeiras_datas.get(conta, dia))
    vistas = {}
    for dia, conta, recibos in sorted(recolhas, key=lambda r: (r[0], r[1])):
        visto_em = None if dia == primeiras_datas[conta] else dia
        for obs in g.build_observations(recibos, conta, visto_em):
            vistas.setdefault((obs["receipt_key"], obs["state"]), obs)
    return list(vistas.values())


def exports_arquivados(raiz: Path) -> list[tuple[date, str, Path]]:
    arquivos = []
    for padrao in ("????-??-??/ListaRecibos.xlsx", "????-??-??/*/ListaRecibos.xlsx"):
        for caminho in raiz.glob(padrao):
            partes = caminho.relative_to(raiz).parts
            try:
                dia = date.fromisoformat(partes[0])
            except ValueError:
                continue
            conta = "Pai" if len(partes) == 2 else partes[1]
            arquivos.append((dia, conta, caminho))
    return sorted(arquivos)


def imprimir_contagens(recolhas, observacoes) -> None:
    primeiras_datas = {}
    for dia, conta, _ in recolhas:
        primeiras_datas[conta] = min(dia, primeiras_datas.get(conta, dia))
    totais, sem_medicao = Counter(), Counter()
    for obs in observacoes:
        dia = obs["first_seen"] or primeiras_datas[obs["account"]]
        totais[dia] += 1
        sem_medicao[dia] += obs["first_seen"] is None
    for dia in sorted({dia for dia, _, _ in recolhas}):
        print(f"{dia}: {totais[dia]} observações; {sem_medicao[dia]} sem medição.")


def sql_backfill(observacoes) -> str:
    # O backfill também corrige datas medidas por uma recolha posterior já importada.
    return sql_observacoes(observacoes).replace(
        "on conflict (receipt_key, state) do nothing;",
        "on conflict (receipt_key, state) do update set first_seen = case "
        "when public.receipt_observations.first_seen is null or excluded.first_seen is null "
        "then null else least(public.receipt_observations.first_seen, excluded.first_seen) end;")


def main(argv=None, *, raiz: Path | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seco", action="store_true")
    args = parser.parse_args(argv)
    arquivos = exports_arquivados(raiz if raiz is not None else ROOT / "dados" / "_recolhas")
    recolhas = [(dia, conta, g.an.load_recibos(caminho.parent)) for dia, conta, caminho in arquivos]
    observacoes = primeiras_observacoes(recolhas)
    imprimir_contagens(recolhas, observacoes)
    if args.seco or not observacoes:
        return 0
    import os
    import psycopg
    from dotenv import load_dotenv
    load_dotenv(ROOT / "dados" / ".env")
    with psycopg.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=15) as con:
        with con.transaction():
            with con.cursor() as cur:
                cur.execute("set local statement_timeout='60s'")
                cur.execute(sql_backfill(observacoes))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        raise SystemExit("Falha no backfill de observações; verificar o arquivo e a configuração.") from None