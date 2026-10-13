import Image from "next/image";
export function Marca({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return <span className="inline-flex items-center gap-2.5"><Image src="/brand/app-icon-small.svg" alt="" width={32} height={32} priority className="size-8 shrink-0" />{!compact && <span className={`text-[17px] font-semibold tracking-[-0.01em] ${dark ? "text-[#f7f5ee]" : "text-tinta"}`}>Património</span>}</span>;
}
