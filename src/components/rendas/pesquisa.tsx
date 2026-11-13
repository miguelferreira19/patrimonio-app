"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui";
import { correspondeAoNome } from "./filtros";

export function PesquisaDeRendas({ linhas, filtros, vazio }: {
  linhas: Array<{ chave: string; nome: string; conteudo: ReactNode }>;
  filtros: ReactNode;
  vazio: string;
}) {
  const [pesquisa, setPesquisa] = useState("");
  const visiveis = linhas.filter((l) => correspondeAoNome(l.nome, pesquisa));
  return <div className="min-w-0 space-y-4">
    <label className="block text-sm font-medium text-tinta-2">
      <span className="mb-1.5 block">Pesquisar por nome</span>
      <Input type="search" placeholder="Nome do inquilino" autoComplete="off" value={pesquisa}
        onChange={(evento) => setPesquisa(evento.target.value)} aria-controls="lista-de-rendas" />
    </label>
    {filtros}
    <span className="sr-only" role="status">{visiveis.length} {visiveis.length === 1 ? "inquilino" : "inquilinos"}</span>
    <ul id="lista-de-rendas" className="stagger divide-y divide-regua">
      {linhas.map((l) => <li key={l.chave} hidden={!correspondeAoNome(l.nome, pesquisa)}>{l.conteudo}</li>)}
    </ul>
    {visiveis.length === 0 && <div className="vazio">{pesquisa.trim() ? "Nenhum inquilino com esse nome" : vazio}</div>}
  </div>;
}
