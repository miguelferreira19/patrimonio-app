// A capa geométrica de um prédio (V4 F4). Sem fotografias na base, um desenho dá
// identidade a cada cartão: pisos de acordo com as frações, terrenos como colinas.
// Determinístico pela chave, para não mudar entre renders.

function semente(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function Fachada({ chave, fracoes, terreno }: { chave: string; fracoes: number; terreno: boolean }) {
  const h = semente(chave);
  if (terreno) {
    return (
      <svg viewBox="0 0 340 92" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full" aria-hidden="true">
        <path d="M0 64 Q70 42 140 58 T280 50 T340 56 V92 H0Z" className="fill-regua-forte" />
        <path d="M0 76 Q90 60 170 70 T340 66 V92 H0Z" className="fill-regua" />
      </svg>
    );
  }
  const pisos = Math.min(5, Math.max(1, Math.ceil(fracoes / 2)));
  const larg = 70 + (h % 3) * 18;
  const x0 = 50 + (h % 5) * 34;
  const alt = pisos * 14 + 8;
  const colunas = Math.floor(larg / 18);
  const janelas = [];
  for (let p = 0; p < pisos; p++)
    for (let j = 0; j < colunas; j++)
      janelas.push(<rect key={`${p}-${j}`} x={x0 + 8 + j * 18} y={84 - alt + 8 + p * 14} width={9} height={7} rx={1} className="fill-carta" />);
  return (
    <svg viewBox="0 0 340 92" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x={x0 + larg + 6} y={84 - alt * 0.6} width={larg * 0.55} height={alt * 0.6} rx={2} className="fill-regua" />
      <rect x={x0} y={84 - alt} width={larg} height={alt} rx={2} className="fill-regua-forte" />
      {janelas}
      <rect x={0} y={84} width={340} height={8} className="fill-regua" />
    </svg>
  );
}
