export function diaHabitual(datas: Array<string | null>, hoje: string): number | null {
  const inicio = new Date(`${hoje}T00:00:00Z`);
  inicio.setUTCMonth(inicio.getUTCMonth() - 11, 1);
  const limite = inicio.toISOString().slice(0, 10);
  const dias = datas.filter((iso): iso is string => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < limite || iso > hoje) return false;
    const data = new Date(`${iso}T00:00:00Z`);
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === iso;
  }).map((iso) => Number(iso.slice(8, 10))).sort((a, b) => a - b);
  if (!dias.length) return null;
  const meio = Math.floor(dias.length / 2);
  return Math.round(dias.length % 2 ? dias[meio] : (dias[meio - 1] + dias[meio]) / 2);
}
