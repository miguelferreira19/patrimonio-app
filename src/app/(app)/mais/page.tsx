import { getSession } from "@/lib/data";
import { pode, ROTULO_PAPEL } from "@/lib/papeis";
import { Lede, Linha, Seccao } from "@/components/kit";
import { Sair } from "@/components/shell";
import { Ajuda } from "@/components/ajuda";

const GESTAO = [
  { href: "/tarefas", titulo: "Tarefas" },
  { href: "/contratos", titulo: "Contratos" },
  { href: "/arquivo", titulo: "Documentos" },
  { href: "/cartas", titulo: "Cartas" },
  { href: "/carteira", titulo: "Histórico mensal" },
];

const ADMINISTRACAO = [
  { href: "/senhorios", titulo: "Senhorios" },
  { href: "/saude", titulo: "Saúde dos dados" },
  { href: "/admin", titulo: "Administração" },
];

export default async function MaisPage() {
  const { user, role } = await getSession();
  const administra = pode(role, "administrar");
  return (
    <div className="mx-auto max-w-2xl space-y-8 text-tinta tabular-nums">
      <Lede title="Mais" />
      <Seccao titulo="Gestão">
        <div className="divide-y divide-regua">
          {GESTAO.map((item) => <Linha key={item.href} {...item} />)}
        </div>
      </Seccao>
      {administra && <Seccao titulo="Administração">
        <div className="divide-y divide-regua">
          {pode(role, "ver_controlo") && <Linha href="/controlo" titulo="Controlo" />}
          {ADMINISTRACAO.map((item) => <Linha key={item.href} {...item} />)}
        </div>
      </Seccao>}
      <Seccao titulo="Conta">
        <Linha titulo={user?.email ?? "Conta"} sub={ROTULO_PAPEL[role]} />
        <div className="mt-3 space-y-3">
          <Ajuda admin={administra} />
          <Sair />
        </div>
      </Seccao>
    </div>
  );
}
