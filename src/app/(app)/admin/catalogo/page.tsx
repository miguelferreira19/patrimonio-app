import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, House } from "lucide-react";
import { getSession } from "@/lib/data";
import type { EstadoMes } from "@/lib/monthcell";
import {
  Barra, Bloco, Cobertura, Confianca, DeviationBadge, Figure, Iniciais,
  Lede, Linha, Money, Pilulas, PropertyStatusBadge, Seccao, Tira,
} from "@/components/kit";
import {
  Badge, Button, Card, EmptyState, Field, Input, Label, PageHeader,
  Select, StatCard, Table, Td, Textarea, Th, buttonClass, type BadgeTone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const ESTADOS: EstadoMes[] = ["fora", "pago", "pago", "pago", "pago", "pago", "sem_info", "atraso", "atraso", "atraso", "por_receber", "por_receber"];
const MESES = ESTADOS.map((estado, i) => ({ chave: `2026-${String(i + 1).padStart(2, "0")}-01`, estado }));
const MOEDA_HERDADA = "text-inherit text-[length:inherit] md:text-[length:inherit] font-[number:inherit]";
const TONS: BadgeTone[] = ["confirmado", "neutro", "acao", "perda", "atencao", "futuro", "green", "teal", "zinc", "amber", "red", "blue"];

function Blocos() {
  return <Seccao titulo="Blocos" id="blocos">
    <div className="space-y-3">
      <Bloco tom="perda" tamanho="heroi" sangra rotulo="3 inquilinos em atraso"
        valor={<Money value={4120} escala="hero" className={MOEDA_HERDADA} />}
        legenda="Novembro, dados fictícios" href="#linhas" acao="Ver quem deve" />
      <div className="grid grid-cols-2 gap-2.5">
        <Bloco tom="tinta" rotulo="pagas este mês" valor={31}
          legenda={<Money value={11292} className="text-inherit" />} />
        <Bloco tom="futuro" rotulo="por receber" valor={10}
          legenda={<Money value={3220} className="text-inherit" />} />
      </div>
      <Bloco tom="neutro" rotulo="contratos neste exemplo" valor={41} legenda="Carteira fictícia">
        <p className="mt-2 text-sm">Exemplo com conteúdo livre.</p>
      </Bloco>
    </div>
  </Seccao>;
}

function Listas() {
  return <Seccao titulo="Listas e filtros" id="linhas">
    <Pilulas ativo="todos" itens={[
      { id: "todos", rotulo: "Todos", n: 41, href: "#linhas" },
      { id: "atraso", rotulo: "Em atraso", n: 3, href: "#linhas" },
      { id: "receber", rotulo: "Por receber", n: 10, href: "#linhas" },
    ]} />
    <Linha href="#meses" titulo="Leonor Vale" sub="Rua da Amendoeira, 18" tom="perda"
      valor={<Money value={1680} escala="lg" tom="perda" />} etiqueta="4 meses em atraso">
      <Barra parte={1680} total={2400} tom="perda" />
    </Linha>
    <Linha titulo="Duarte Serrano" sub="Exemplo sem ligação" tom="futuro"
      valor={<Money value={420} escala="lg" tom="futuro" />}>
      <Tira meses={MESES} tamanho="s" />
    </Linha>
    <Linha titulo="Nenhuma renda em atraso" etiqueta={<Badge tone="confirmado">Em dia</Badge>} />
  </Seccao>;
}

function MesesEBarras() {
  return <Seccao titulo="Meses e proporções" id="meses" nota="Pago, em atraso, por receber, sem informação e sem contrato.">
    <div className="space-y-4">
      <Tira meses={MESES} tamanho="m" rotulos />
      <Tira meses={MESES} tamanho="s" rotulos />
      <Barra parte={3} total={5} tom="perda" />
      <Barra parte={4} total={5} tom="tinta" />
      <Barra parte={1} total={5} tom="futuro" />
    </div>
  </Seccao>;
}

function Botoes() {
  return <Seccao titulo="Botões" id="botoes">
    <div className="flex flex-wrap gap-2">
      <Button type="button">Pagou</Button>
      <Button type="button" variant="outline">Falei com ela</Button>
      <Button type="button" variant="ghost">Detalhes</Button>
      <Button type="button" variant="danger">Anular</Button>
      <Button type="button" size="sm">Pequeno</Button>
      <Button type="button" disabled>Indisponível</Button>
      <Button as="a" href="#formularios" variant="outline">Ligação HTML</Button>
      <Link href="#blocos" className={buttonClass()}>Ligação Next</Link>
    </div>
  </Seccao>;
}

function Formularios() {
  return <Seccao titulo="Formulários" id="formularios">
    <div className="space-y-4">
      <Field label="Nome fictício"><Input defaultValue="Leonor Vale" autoComplete="off" /></Field>
      <Field label="Tipo de contacto"><Select defaultValue="telefone"><option value="telefone">Telefone</option><option value="carta">Carta</option></Select></Field>
      <Field label="Nota de exemplo"><Textarea rows={3} defaultValue="Combinámos voltar a falar na próxima semana." /></Field>
      <Field label="Campo vazio"><Input placeholder="Escreva aqui" /></Field>
      <Field label="Só de leitura"><Input defaultValue="Dados de exemplo" disabled /></Field>
      <div><Label><span className="space-y-1.5"><span className="block">Rótulo separado</span><Input defaultValue="Outro exemplo" /></span></Label></div>
    </div>
  </Seccao>;
}

function Etiquetas() {
  return <Seccao titulo="Etiquetas e pessoas">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{TONS.map((tone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}</div>
      <div className="flex flex-wrap gap-2"><PropertyStatusBadge status="arrendado" /><PropertyStatusBadge status="vago" /><DeviationBadge deviation={-0.2} /><DeviationBadge deviation={null} /></div>
      <div className="flex items-center gap-3"><Iniciais nome="Leonor Vale" /><span className="text-base font-semibold">Leonor Vale</span></div>
      <div className="flex flex-wrap gap-3"><Confianca nivel="medido" conta="Soma de 3 rendas fictícias." /><Confianca nivel="estimado" /><Confianca nivel="assumido" /></div>
      <Cobertura factos={{ fronteira: "2026-10-01", senhoriosModelados: 2, senhoriosTotal: 3, fichasIncompletas: 1, fontesParadas: [{ nome: "Família Vale", horizonte: "2026-08-01" }] }} podeCorrigir />
    </div>
  </Seccao>;
}

function Numeros() {
  return <Seccao titulo="Números" valor={<Figure value={41} unit="contratos" escala="lg" />}>
    <div className="space-y-4">
      <Money value={11292} escala="hero" />
      <div className="flex flex-wrap items-baseline gap-4"><Money value={1680} escala="xl" tom="perda" /><Money value={420} escala="lg" tom="futuro" /><Money value={335.25} decimals={2} /><Money value={25} sign escala="sm" /><Money value={null} /></div>
      <Figure value={72} unit="%" escala="xl" />
    </div>
  </Seccao>;
}

function CartoesETabela() {
  return <Seccao titulo="Cartões, tabela e vazio">
    <div className="space-y-4">
      <Card title="Contrato de exemplo" subtitle="Cabeçalho sem separador" actions={<Badge>Fictício</Badge>}>
        <p className="text-[15px] text-tinta-2">Conteúdo do cartão.</p>
      </Card>
      <StatCard label="Rendas recebidas" value={<Money value={11292} escala="xl" />} sub="Exemplo fictício" icon={House} />
      <Table edgeFade><thead><tr><Th>Inquilino</Th><Th>Renda</Th></tr></thead><tbody><tr><Td>Leonor Vale</Td><Td><Money value={420} /></Td></tr></tbody></Table>
      <EmptyState icon={FileText} action={<Link href="#blocos" className={buttonClass({ variant: "outline" })}>Ver exemplos</Link>}>Ainda não há documentos neste exemplo.</EmptyState>
    </div>
  </Seccao>;
}

export default async function CatalogoPage() {
  const { user, isAdmin } = await getSession();
  if (!user || !isAdmin) redirect("/");
  return <div className="mx-auto w-full max-w-[390px] space-y-8 px-5 py-5 font-sans text-tinta">
    <Lede title="Catálogo Sinal" variant="hero">Dados fictícios. Exemplos das primitivas partilhadas.</Lede>
    <Blocos />
    <Listas />
    <MesesEBarras />
    <Botoes />
    <Formularios />
    <Etiquetas />
    <Numeros />
    <CartoesETabela />
    <PageHeader title="Cabeçalho compatível" eyebrow="Página de exemplo" description="O PageHeader continua a usar o Lede." />
  </div>;
}
