"use client";

// O modal de marcar/corrigir o pagamento de um contrato-mês.
//
// Veio inteiro do `payments-grid.tsx` da V1, sem mudança de comportamento: mesmo atalho
// de dinheiro (P1-2), mesma remoção com confirmação. Mudou de casa porque a grelha de
// Pagamentos foi absorvida pela Faixa e a página redireciona — o formulário não morre
// com ela. As cores cruas do original passaram a tokens semânticos.

import { useState } from "react";
import { Banknote } from "lucide-react";
import { useAction } from "@/components/forms";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { markPayment, removePayment } from "@/lib/actions/crud";
import { fmtEur, monthLabel, todayISO } from "@/lib/format";
import type { Contract, Payment, PaymentMethod } from "@/lib/types";

export function PagamentoModal({
  contract,
  nome,
  month,
  payment,
  onClose,
}: {
  contract: Contract;
  /** Nome da fração, para o título. */
  nome: string;
  month: string;
  payment?: Payment;
  onClose: () => void;
}) {
  const { pending, error, run } = useAction();
  const [amount, setAmount] = useState(payment?.amount?.toString() ?? contract.rent.toString());
  const [date, setDate] = useState(payment?.received_date ?? todayISO());
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "transferencia");

  // `withMethod` existe para o atalho de dinheiro (P1-2): grava com o método escolhido no
  // botão sem obrigar a passar pelo Select. O resto do formulário é o mesmo.
  function save(withMethod: PaymentMethod) {
    const v = Number(amount.replace(",", "."));
    if (!Number.isFinite(v)) return;
    run(
      markPayment({
        contract_id: contract.id,
        ref_month: month,
        amount: v,
        received_date: date,
        method: withMethod,
      }),
      onClose,
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save(method);
  }

  return (
    <Modal open onClose={onClose} title={`${nome} · ${monthLabel(month)}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-tinta-2">
          Inquilino: <strong className="text-tinta">{contract.tenant_name}</strong> · Renda
          contratada: <strong className="tabular-nums text-tinta">{fmtEur(contract.rent, 2)}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor recebido (€)">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
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
        {error && <p className="text-xs text-perda">{error}</p>}
        <div className="flex justify-between gap-2 border-t border-regua pt-4">
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
            {!payment && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => save("dinheiro")}
              >
                <Banknote size={15} strokeWidth={1.75} />
                Em dinheiro
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "A gravar…" : payment ? "Atualizar" : "Marcar como recebida"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
