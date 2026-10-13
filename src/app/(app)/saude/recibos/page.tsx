import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/data";
import { getOrphanReceipts } from "@/lib/portfolio/gestao-load";
import { getSnapshotComRaw } from "@/lib/portfolio";
import { Lede } from "@/components/kit/lede";
import { ReceiptCorrection } from "@/components/gestao/recibos";
import { buttonClass } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { isAdmin } = await getSession();
  if (!isAdmin) redirect("/");
  const [receipts, { raw }] = await Promise.all([getOrphanReceipts(), getSnapshotComRaw()]);
  return (
    <div className="space-y-6">
      <Link href="/saude" className={buttonClass({ variant: "ghost" })}>
        Voltar às verificações
      </Link>
      <Lede title="Associar recibos sem contrato">
        Revê a fonte, o período e o inquilino. A associação individual ou em lote só é aplicada depois de uma
        pré-visualização explícita.
      </Lede>
      {receipts.length ? (
        <ReceiptCorrection
          receipts={receipts}
          contracts={raw.contracts}
          properties={raw.properties}
          landlords={raw.landlords}
        />
      ) : (
        <p className="py-8 text-sm text-tinta-2">Todos os recibos têm contrato associado.</p>
      )}
    </div>
  );
}
