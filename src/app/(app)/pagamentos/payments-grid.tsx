"use client";

import { useMemo, useState } from "react";
import { Banknote, Check, Clock, Minus, X } from "lucide-react";
import { useAction } from "@/components/forms";
import { Badge, Button, Card, cn, Field, Input, Modal, Select, Table, Td, Th } from "@/components/ui";
import { markPayment, removePayment } from "@/lib/actions/crud";
import { contractActiveInMonth } from "@/lib/calc";
import {
  currentMonthKey,
  fmtDate,
  fmtEur,
  monthLabel,
  todayISO,
} from "@/lib/format";
import type { Contract, Landlord, Payment, PaymentMethod } from "@/lib/types";

interface Row {
  contract: Contract;
  propertyName: string;
  ownerIds: string[];
}

type CellState = "pago" | "falta" | "aguarda" | "na";

/** Cor de fundo/texto por estado: estados semânticos suaves, hover via brightness. */
function cellTone(state: CellState): string {
  switch (state) {
    case "pago":
      return "bg-emerald-50 text-emerald-700";
    case "falta":
      return "bg-red-50 text-red-700";
    case "aguarda":
      return "bg-amber-50 text-amber-700";
    default:
      return "text-zinc-300";
  }
}

export function PaymentsGrid({
  rows,
  months,
  payments,
  landlords,
  isAdmin,
}: {
  rows: Row[];
  months: string[];
  payments: Payment[];
  landlords: Landlord[];
  isAdmin: boolean;
}) {
  const [landlord, setLandlord] = useState("");
  const [onlyLate, setOnlyLate] = useState(false);
  const [cell, setCell] = useState<{ row: Row; month: string; payment?: Payment } | null>(null);

  const current = currentMonthKey();
  const today = todayISO();
  const dayOfMonth = parseInt(today.slice(8, 10), 10);

  const payMap = useMemo(
    () => new Map(payments.map((p) => [`${p.contract_id}:${p.ref_month.slice(0, 7)}`, p])),
    [payments],
  );

  function cellState(row: Row, m: string): CellState {
    if (!contractActiveInMonth(row.contract, m)) return "na";
    const p = payMap.get(`${row.contract.id}:${m.slice(0, 7)}`);
    if (p) return "pago";
    if (m < current) return "falta";
    if (m === current) {
      return dayOfMonth > row.contract.due_day ? "falta" : "aguarda";
    }
    return "na";
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.contract.status === "cessado" && !months.some((m) => contractActiveInMonth(r.contract, m))) {
        return false;
      }
      if (landlord && !r.ownerIds.includes(landlord)) return false;
      if (onlyLate && !months.some((m) => cellState(r, m) === "falta")) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, landlord, onlyLate, payMap, months]);

  const totals = months.map((m) => {
    let expected = 0;
    let received = 0;
    for (const r of filtered) {
      if (contractActiveInMonth(r.contract, m)) {
        expected += r.contract.rent;
        const p = payMap.get(`${r.contract.id}:${m.slice(0, 7)}`);
        if (p) received += p.amount;
      }
    }
    return { expected, received };
  });

  const lateCount = rows.reduce(
    (acc, r) => acc + months.filter((m) => cellState(r, m) === "falta").length,
    0,
  );

  return (
    <Card>
      <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Select
          value={landlord}
          onChange={(e) => setLandlord(e.target.value)}
          className="w-full sm:w-auto sm:max-w-44"
        >
          <option value="">Todos os senhorios</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={onlyLate}
            onChange={(e) => setOnlyLate(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-2 focus:ring-teal-600/20"
          />
          Só com rendas em falta
        </label>
        <div className="sm:ml-auto">
          {lateCount > 0 ? (
            <Badge tone="red">{lateCount} renda(s) em falta</Badge>
          ) : (
            <Badge tone="green">Tudo em dia</Badge>
          )}
        </div>
      </div>

      <Table edgeFade>
        <thead>
          <tr>
            <Th className="sticky left-0 top-0 z-30 bg-white">Fração / Inquilino</Th>
            {months.map((m) => (
              <Th
                key={m}
                className={cn(
                  "sticky top-0 z-20 text-center font-mono normal-case tracking-normal",
                  m === current ? "bg-teal-50 text-teal-800" : "bg-white",
                )}
              >
                {monthLabel(m)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.contract.id} className="hover:bg-zinc-50">
              <Td className="sticky left-0 z-10 max-w-52 bg-white">
                <p className="truncate font-medium text-zinc-800">{r.propertyName}</p>
                <p className="truncate text-xs text-zinc-400">
                  {r.contract.tenant_name} · {fmtEur(r.contract.rent)}
                </p>
              </Td>
              {months.map((m) => {
                const state = cellState(r, m);
                const p = payMap.get(`${r.contract.id}:${m.slice(0, 7)}`);
                const clickable = isAdmin && state !== "na";
                return (
                  <Td key={m} className="p-1 text-center">
                    <button
                      disabled={!clickable}
                      onClick={() => setCell({ row: r, month: m, payment: p })}
                      title={
                        p
                          ? `${fmtEur(p.amount, 2)} · ${fmtDate(p.received_date)} · ${p.method}`
                          : state === "falta"
                            ? "Renda em falta. Clica para marcar como recebida."
                            : undefined
                      }
                      aria-label={`${r.propertyName}, ${monthLabel(m)}: ${
                        state === "pago" ? "pago" : state === "falta" ? "em falta" : state === "aguarda" ? "dentro do prazo" : "sem contrato"
                      }`}
                      className={cn(
                        "inline-flex h-10 w-16 items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors sm:h-8",
                        cellTone(state),
                        clickable &&
                          "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1",
                      )}
                    >
                      {state === "pago" ? (
                        <>
                          <Check size={14} strokeWidth={2.5} />
                          {p?.method === "dinheiro" && <Banknote size={12} strokeWidth={2} aria-hidden="true" />}
                        </>
                      ) : state === "falta" ? (
                        <X size={14} strokeWidth={2.5} />
                      ) : state === "aguarda" ? (
                        <Clock size={14} strokeWidth={2} />
                      ) : (
                        <Minus size={14} strokeWidth={2} />
                      )}
                    </button>
                  </Td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-zinc-50 text-xs font-semibold">
            <Td className="sticky left-0 z-10 border-t border-zinc-200 bg-zinc-50 text-zinc-600">
              Recebido / esperado
            </Td>
            {totals.map((t, i) => (
              <Td key={months[i]} className="border-t border-zinc-200 text-center tabular-nums">
                <span className={t.received >= t.expected ? "text-emerald-700" : "text-zinc-700"}>
                  {fmtEur(t.received)}
                </span>
                <span className="block text-[10px] font-normal text-zinc-400">
                  de {fmtEur(t.expected)}
                </span>
              </Td>
            ))}
          </tr>
        </tbody>
      </Table>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Check size={12} strokeWidth={2.5} className="text-emerald-600" /> Pago
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Banknote size={12} strokeWidth={2} className="text-emerald-600" /> Pago em dinheiro
        </span>
        <span className="inline-flex items-center gap-1.5">
          <X size={12} strokeWidth={2.5} className="text-red-600" /> Em falta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={12} strokeWidth={2} className="text-amber-600" /> Dentro do prazo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus size={12} strokeWidth={2} className="text-zinc-400" /> Sem contrato
        </span>
      </div>

      {cell && (
        <PaymentModal
          row={cell.row}
          month={cell.month}
          payment={cell.payment}
          onClose={() => setCell(null)}
        />
      )}
    </Card>
  );
}

function PaymentModal({
  row,
  month,
  payment,
  onClose,
}: {
  row: Row;
  month: string;
  payment?: Payment;
  onClose: () => void;
}) {
  const { pending, error, run } = useAction();
  const [amount, setAmount] = useState(payment?.amount?.toString() ?? row.contract.rent.toString());
  const [date, setDate] = useState(payment?.received_date ?? todayISO());
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "transferencia");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(amount.replace(",", "."));
    if (!Number.isFinite(v)) return;
    run(
      markPayment({
        contract_id: row.contract.id,
        ref_month: month,
        amount: v,
        received_date: date,
        method,
      }),
      onClose,
    );
  }

  return (
    <Modal open onClose={onClose} title={`${row.propertyName} · ${monthLabel(month)}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-zinc-600">
          Inquilino: <strong>{row.contract.tenant_name}</strong> · Renda contratada:{" "}
          <strong className="tabular-nums">{fmtEur(row.contract.rent, 2)}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor recebido (€)">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
          </Field>
          <Field label="Data de receção">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Método">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="transferencia">Transferência</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-between gap-2 border-t border-zinc-100 pt-4">
          {payment ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (confirm("Remover este pagamento?")) run(removePayment(payment.id), onClose);
              }}
            >
              Remover pagamento
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : payment ? "Atualizar" : "Marcar como recebida"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
