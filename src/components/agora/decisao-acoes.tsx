"use client";

// Adiar / dispensar uma decisão (S3). Client só por causa do `useAction`; o resto da
// fila continua a ser server.
//
// Não há confirmação em nenhuma das duas: ambas são reversíveis num clique e nenhuma
// apaga um facto — o gerador continua a correr, o item só deixa de se mostrar. Pedir
// confirmação para uma ação reversível é atrito sem ganho.

import { useAction } from "@/components/forms";
import { buttonClass } from "@/components/ui";
import { dismissInsight, restoreInsight, snoozeInsight } from "@/lib/actions/insights";
import { ADIAR_DIAS } from "@/lib/insight-prazo";

export function DecisaoAcoes({ kind, subject = "" }: { kind: string; subject?: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(snoozeInsight({ kind, subject }))}
        className={buttonClass({ variant: "ghost", size: "sm" })}
      >
        Adiar {ADIAR_DIAS} dias
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(dismissInsight({ kind, subject }))}
        className={buttonClass({ variant: "ghost", size: "sm" })}
      >
        Dispensar
      </button>
      {error && <span className="self-center text-xs text-perda">{error}</span>}
    </>
  );
}

export function ReporDecisao({ kind, subject = "" }: { kind: string; subject?: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(restoreInsight({ kind, subject }))}
        className="text-acao underline-offset-2 hover:underline disabled:opacity-50"
      >
        repor
      </button>
      {error && <span className="ml-2 text-perda">{error}</span>}
    </>
  );
}
