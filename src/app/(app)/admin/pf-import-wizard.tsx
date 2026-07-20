"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning, Upload } from "lucide-react";
import type {
  ContractImportResult,
  ContractImportRow,
  ImportResult,
  PatrimonioImportResult,
  PatrimonioImportRow,
  ReceiptRow,
} from "@/lib/actions/import";
import {
  importContractsChunk,
  importPatrimonioChunk,
  importReceiptsChunk,
  syncContractRents,
} from "@/lib/actions/import";
import { Button, Card, cn, EmptyState, Field, Select, StatCard, Table, Td, Th } from "@/components/ui";
import { addMonthsKey, endOfMonthISO, fmtEur, monthLabel } from "@/lib/format";
import { guessHeader, parseAmount, parseDateISO, toMonthKey } from "@/lib/parse";
import { parseSpreadsheetFile, type ParsedSheet } from "@/lib/spreadsheet";
import type { Landlord } from "@/lib/types";

const BATCH_SIZE = 400;

type Kind = "contratos" | "recibos" | "patrimonio";

const KIND_OPTIONS: Array<{ key: Kind; label: string }> = [
  { key: "contratos", label: "Contratos (ListaContratos)" },
  { key: "recibos", label: "Recibos (ListaRecibos)" },
  { key: "patrimonio", label: "Património predial" },
];

interface FieldMap {
  property_label: string;
  property_ref: string;
  pf_contract_no: string;
  recibo_no: string;
  tenant_name: string;
  period_start: string;
  period_end: string;
  issue_date: string;
  amount: string;
  estado: string;
  rent: string;
  identificador: string;
  parte: string;
  ano: string;
  valor: string;
}

const EMPTY_MAP: FieldMap = {
  property_label: "",
  property_ref: "",
  pf_contract_no: "",
  recibo_no: "",
  tenant_name: "",
  period_start: "",
  period_end: "",
  issue_date: "",
  amount: "",
  estado: "",
  rent: "",
  identificador: "",
  parte: "",
  ano: "",
  valor: "",
};

interface FieldDef {
  key: keyof FieldMap;
  label: string;
  required?: boolean;
  exact: string[];
  keywords: string[];
}

const FIELD_DEFS_RECIBOS: FieldDef[] = [
  { key: "property_ref", label: "Imóvel (identificador matricial)", required: true, exact: ["Imóvel"], keywords: ["imóvel", "imovel"] },
  { key: "property_label", label: "Referência (nome da fração)", exact: ["Referência"], keywords: ["referência", "referencia"] },
  { key: "pf_contract_no", label: "Nº de Contrato", exact: ["Nº de Contrato"], keywords: ["nº de contrato", "n° de contrato", "contrato"] },
  { key: "recibo_no", label: "Nº de Recibo", exact: ["Nº de Recibo"], keywords: ["nº de recibo", "n° de recibo", "recibo"] },
  { key: "tenant_name", label: "Locatário", exact: ["Locatário"], keywords: ["locatário", "locatario", "inquilino"] },
  { key: "period_start", label: "Data de Início", required: true, exact: ["Data de Início"], keywords: ["início", "inicio"] },
  { key: "period_end", label: "Data de Fim", exact: ["Data de Fim"], keywords: ["fim"] },
  { key: "issue_date", label: "Data de Rec. (recebimento)", exact: ["Data de Rec."], keywords: ["data de rec", "recebimento", "pagamento"] },
  { key: "amount", label: "Valor (€)", required: true, exact: ["Valor (€)", "Valor"], keywords: ["valor"] },
  { key: "estado", label: "Estado", exact: ["Estado"], keywords: ["estado"] },
];

const FIELD_DEFS_CONTRATOS: FieldDef[] = [
  { key: "property_ref", label: "Imóvel (identificador matricial)", required: true, exact: ["Imóvel"], keywords: ["imóvel", "imovel"] },
  { key: "property_label", label: "Referência (nome da fração)", exact: ["Referência"], keywords: ["referência", "referencia"] },
  { key: "pf_contract_no", label: "Nº de Contrato", required: true, exact: ["Nº de Contrato"], keywords: ["nº de contrato", "n° de contrato", "contrato"] },
  { key: "tenant_name", label: "Locatário", exact: ["Locatário"], keywords: ["locatário", "locatario", "inquilino"] },
  { key: "rent", label: "Renda (€)", required: true, exact: ["Renda (€)", "Renda"], keywords: ["renda"] },
  { key: "estado", label: "Estado", required: true, exact: ["Estado"], keywords: ["estado"] },
];

const FIELD_DEFS_PATRIMONIO: FieldDef[] = [
  { key: "identificador", label: "Identificador", required: true, exact: ["Identificador"], keywords: ["identificador"] },
  { key: "parte", label: "Parte (quota)", exact: ["Parte"], keywords: ["parte"] },
  { key: "ano", label: "Ano de inscrição na matriz", exact: ["Ano Inscr. Matriz"], keywords: ["ano"] },
  { key: "valor", label: "Valor (VPT atual)", exact: ["Valor"], keywords: ["valor"] },
];

function fieldDefsFor(kind: Kind): FieldDef[] {
  if (kind === "recibos") return FIELD_DEFS_RECIBOS;
  if (kind === "contratos") return FIELD_DEFS_CONTRATOS;
  return FIELD_DEFS_PATRIMONIO;
}

function cell(row: Record<string, unknown>, col: string): string {
  if (!col) return "";
  const v = row[col];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Escolhe primeiro por header exato (case-insensitive), depois por palavra-chave. */
function guessField(headers: string[], exact: string[], keywords: string[]): string {
  for (const e of exact) {
    const found = headers.find((h) => h.trim().toLowerCase() === e.toLowerCase());
    if (found) return found;
  }
  return guessHeader(headers, keywords);
}

function guessMap(headers: string[], defs: FieldDef[]): FieldMap {
  const out = { ...EMPTY_MAP };
  for (const f of defs) out[f.key] = guessField(headers, f.exact, f.keywords);
  return out;
}

/** Nº de meses de calendário entre duas datas ISO, inclusive. Sem fim válido -> 1. */
function monthsBetweenInclusive(startISO: string, endISO: string | null): number {
  if (!endISO) return 1;
  const [sy, smo] = startISO.slice(0, 7).split("-").map(Number);
  const [ey, emo] = endISO.slice(0, 7).split("-").map(Number);
  const n = (ey - sy) * 12 + (emo - smo) + 1;
  return n >= 1 ? n : 1;
}

/** Converte as linhas cruas do ficheiro de recibos em ReceiptRow, dividindo os multi-mês. */
function buildReceiptRows(
  sheetRows: Array<Record<string, unknown>>,
  map: FieldMap,
): { rows: ReceiptRow[]; invalidCount: number; anuladoCount: number } {
  const rows: ReceiptRow[] = [];
  let invalidCount = 0;
  let anuladoCount = 0;

  for (const row of sheetRows) {
    if (map.estado) {
      const estado = cell(row, map.estado).toLowerCase();
      if (estado && estado !== "emitido") {
        anuladoCount++;
        continue;
      }
    }

    const property_ref = cell(row, map.property_ref) || null;
    const property_label = cell(row, map.property_label) || property_ref || "";
    const start = map.period_start ? parseDateISO(row[map.period_start]) : null;
    const end = map.period_end ? parseDateISO(row[map.period_end]) : null;
    const amount = parseAmount(row[map.amount]);
    if (!property_label || !start || amount === null) {
      invalidCount++;
      continue;
    }

    const contractNo = cell(row, map.pf_contract_no) || null;
    const reciboNo = cell(row, map.recibo_no) || null;
    const baseReceiptNumber =
      contractNo && reciboNo ? `${contractNo}/${reciboNo}` : reciboNo || contractNo || null;
    const issue_date = map.issue_date ? parseDateISO(row[map.issue_date]) : null;
    const tenant_name = cell(row, map.tenant_name) || null;
    const startMonthKey = toMonthKey(start)!;
    const nMonths = monthsBetweenInclusive(start, end);

    if (nMonths <= 1) {
      rows.push({
        receipt_number: baseReceiptNumber,
        pf_contract_no: contractNo,
        property_label,
        property_ref,
        tenant_name,
        ref_month: startMonthKey,
        period_start: start,
        period_end: end,
        amount,
        issue_date,
        raw: row,
      });
      continue;
    }

    // divide o recibo multi-mês em N linhas; a última leva o resto p/ somar exato
    const cents = Math.round(amount * 100);
    const base = Math.floor(cents / nMonths);
    const remainder = cents - base * nMonths;
    for (let i = 0; i < nMonths; i++) {
      const monthKey = addMonthsKey(startMonthKey, i);
      const isLast = i === nMonths - 1;
      const share = base + (isLast ? remainder : 0);
      rows.push({
        receipt_number: baseReceiptNumber ? `${baseReceiptNumber}#${i + 1}` : null,
        pf_contract_no: contractNo,
        property_label,
        property_ref,
        tenant_name,
        ref_month: monthKey,
        period_start: i === 0 ? start : monthKey,
        period_end: isLast ? end : endOfMonthISO(monthKey),
        amount: share / 100,
        issue_date,
        raw: row,
      });
    }
  }

  return { rows, invalidCount, anuladoCount };
}

function toContractRow(row: Record<string, unknown>, map: FieldMap): ContractImportRow | null {
  const pf_contract_no = cell(row, map.pf_contract_no);
  const property_ref = cell(row, map.property_ref) || null;
  const property_label = cell(row, map.property_label) || property_ref || "";
  const rent = parseAmount(row[map.rent]);
  if (!pf_contract_no || !property_label || rent === null) return null;
  const estadoRaw = cell(row, map.estado).toLowerCase();
  const status: "ativo" | "cessado" = estadoRaw === "ativo" ? "ativo" : "cessado";
  return {
    pf_contract_no,
    property_label,
    property_ref,
    tenant_name: cell(row, map.tenant_name) || null,
    rent,
    status,
    raw: row,
  };
}

function toPatrimonioRow(row: Record<string, unknown>, map: FieldMap): PatrimonioImportRow | null {
  const identificador = cell(row, map.identificador);
  if (!identificador) return null;
  const parte = map.parte ? cell(row, map.parte) || null : null;
  const anoRaw = map.ano ? cell(row, map.ano) : "";
  const ano = anoRaw ? parseInt(anoRaw, 10) : null;
  const valor = map.valor ? parseAmount(row[map.valor]) : null;
  return {
    identificador,
    parte,
    ano: ano !== null && Number.isFinite(ano) ? ano : null,
    valor,
    raw: row,
  };
}

type Preview =
  | { kind: "recibos"; rows: ReceiptRow[]; invalidCount: number; anuladoCount: number }
  | { kind: "contratos"; rows: ContractImportRow[]; invalidCount: number }
  | { kind: "patrimonio"; rows: PatrimonioImportRow[]; invalidCount: number };

const WIZARD_STEPS: Array<{ n: 1 | 2 | 3; label: string }> = [
  { n: 1, label: "Ficheiro" },
  { n: 2, label: "Mapeamento" },
  { n: 3, label: "Importação" },
];

/** Indicador visual dos 3 passos do wizard: círculos teal, sem qualquer lógica própria. */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-4 flex items-center">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                s.n === step
                  ? "bg-teal-800 text-white"
                  : s.n < step
                    ? "bg-teal-100 text-teal-800"
                    : "bg-zinc-100 text-zinc-400",
              )}
            >
              {s.n}
            </span>
            <span className={cn("text-xs font-medium", s.n <= step ? "text-zinc-900" : "text-zinc-400")}>
              {s.label}
            </span>
          </div>
          {i < WIZARD_STEPS.length - 1 && <span className="mx-3 h-px w-8 bg-zinc-200" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

export function PfImportWizard({ landlords }: { landlords: Landlord[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kind, setKind] = useState<Kind>("contratos");
  const [landlordId, setLandlordId] = useState(landlords[0]?.id ?? "");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [map, setMap] = useState<FieldMap>(EMPTY_MAP);
  const [createPayments, setCreatePayments] = useState(true);
  const [updateRents, setUpdateRents] = useState(false);

  const [importing, setImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ i: number; n: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<ImportResult | null>(null);
  const [contractResult, setContractResult] = useState<ContractImportResult | null>(null);
  const [patrimonioResult, setPatrimonioResult] = useState<PatrimonioImportResult | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fieldDefs = fieldDefsFor(kind);

  const preview: Preview | null = useMemo(() => {
    if (!sheet) return null;
    if (kind === "recibos") {
      const { rows, invalidCount, anuladoCount } = buildReceiptRows(sheet.rows, map);
      return { kind: "recibos", rows, invalidCount, anuladoCount };
    }
    if (kind === "contratos") {
      const rows: ContractImportRow[] = [];
      let invalidCount = 0;
      for (const row of sheet.rows) {
        const r = toContractRow(row, map);
        if (r) rows.push(r);
        else invalidCount++;
      }
      return { kind: "contratos", rows, invalidCount };
    }
    const rows: PatrimonioImportRow[] = [];
    let invalidCount = 0;
    for (const row of sheet.rows) {
      const r = toPatrimonioRow(row, map);
      if (r) rows.push(r);
      else invalidCount++;
    }
    return { kind: "patrimonio", rows, invalidCount };
  }, [sheet, map, kind]);

  function resetAll() {
    setStep(1);
    setSheet(null);
    setFileError(null);
    setMap(EMPTY_MAP);
    setImporting(false);
    setBatchProgress(null);
    setImportError(null);
    setReceiptResult(null);
    setContractResult(null);
    setPatrimonioResult(null);
    setSyncInfo(null);
    setSyncError(null);
  }

  function handleKindChange(k: Kind) {
    setKind(k);
    if (sheet) setMap(guessMap(sheet.headers, fieldDefsFor(k)));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.rows.length === 0) {
        setFileError("O ficheiro não tem linhas de dados.");
        return;
      }
      setSheet(parsed);
      setMap(guessMap(parsed.headers, fieldDefsFor(kind)));
      setStep(2);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Não foi possível ler o ficheiro.");
    }
  }

  async function handleStartImport() {
    if (!landlordId || !preview || preview.rows.length === 0) return;
    setStep(3);
    setImporting(true);
    setImportError(null);
    setReceiptResult(null);
    setContractResult(null);
    setPatrimonioResult(null);
    setSyncInfo(null);
    setSyncError(null);

    const total = Math.ceil(preview.rows.length / BATCH_SIZE);

    if (preview.kind === "recibos") {
      let acc: ImportResult = {
        createdProperties: 0,
        createdContracts: 0,
        insertedReceipts: 0,
        insertedPayments: 0,
        skippedRows: preview.invalidCount,
      };
      for (let i = 0; i < total; i++) {
        const chunk = preview.rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setBatchProgress({ i: i + 1, n: total });
        const res = await importReceiptsChunk({ landlord_id: landlordId, rows: chunk, createPayments });
        if (!res.ok) {
          setImportError(res.error);
          setImporting(false);
          return;
        }
        if (res.result) {
          acc = {
            createdProperties: acc.createdProperties + res.result.createdProperties,
            createdContracts: acc.createdContracts + res.result.createdContracts,
            insertedReceipts: acc.insertedReceipts + res.result.insertedReceipts,
            insertedPayments: acc.insertedPayments + res.result.insertedPayments,
            skippedRows: acc.skippedRows + res.result.skippedRows,
          };
        }
      }
      if (updateRents) {
        const syncRes = await syncContractRents();
        if (syncRes.ok) setSyncInfo(syncRes.info ?? "Rendas atualizadas.");
        else setSyncError(syncRes.error);
      }
      setReceiptResult(acc);
    } else if (preview.kind === "contratos") {
      let acc: ContractImportResult = { createdProperties: 0, createdContracts: 0, updatedContracts: 0 };
      for (let i = 0; i < total; i++) {
        const chunk = preview.rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setBatchProgress({ i: i + 1, n: total });
        const res = await importContractsChunk({ landlord_id: landlordId, rows: chunk });
        if (!res.ok) {
          setImportError(res.error);
          setImporting(false);
          return;
        }
        if (res.result) {
          acc = {
            createdProperties: acc.createdProperties + res.result.createdProperties,
            createdContracts: acc.createdContracts + res.result.createdContracts,
            updatedContracts: acc.updatedContracts + res.result.updatedContracts,
          };
        }
      }
      setContractResult(acc);
    } else {
      let acc: PatrimonioImportResult = { matched: 0, unmatched: 0, updatedQuotas: 0 };
      for (let i = 0; i < total; i++) {
        const chunk = preview.rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setBatchProgress({ i: i + 1, n: total });
        const res = await importPatrimonioChunk({ landlord_id: landlordId, rows: chunk });
        if (!res.ok) {
          setImportError(res.error);
          setImporting(false);
          return;
        }
        if (res.result) {
          acc = {
            matched: acc.matched + res.result.matched,
            unmatched: acc.unmatched + res.result.unmatched,
            updatedQuotas: acc.updatedQuotas + res.result.updatedQuotas,
          };
        }
      }
      setPatrimonioResult(acc);
    }

    setImporting(false);
    setBatchProgress(null);
    router.refresh();
  }

  const missingRequired = fieldDefs.some((f) => f.required && !map[f.key]);
  const rowCount = preview?.rows.length ?? 0;

  return (
    <Card title="Importar do Portal das Finanças">
      <StepIndicator step={step} />
      {step === 1 && (
        <div className="space-y-3">
          <Field label="Tipo de ficheiro *">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {KIND_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => handleKindChange(o.key)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                    kind === o.key
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Senhorio *">
            <Select value={landlordId} onChange={(e) => setLandlordId(e.target.value)}>
              {landlords.length === 0 && <option value="">Sem senhorios</option>}
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ficheiro exportado do Portal das Finanças *">
            <label className="relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40">
              <Upload size={20} strokeWidth={1.75} className="text-zinc-400" aria-hidden="true" />
              <p className="text-sm text-zinc-600">
                <span className="font-medium text-teal-700">Escolhe um ficheiro</span> ou arrasta para aqui
              </p>
              <p className="text-xs text-zinc-400">CSV, XLSX ou XLS</p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFile}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </Field>
          {fileError && <p className="text-xs text-red-600">{fileError}</p>}
          <p className="text-xs text-zinc-400">
            Ordem recomendada: importa primeiro os Contratos, depois os Recibos e por fim o
            Património predial, um ficheiro por senhorio.
          </p>
        </div>
      )}

      {step === 2 && sheet && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fieldDefs.map((f) => (
              <Field key={f.key} label={f.required ? `${f.label} *` : f.label}>
                <Select
                  value={map[f.key]}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">Ignorar</option>
                  {sheet.headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>

          {preview.kind === "recibos" && (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={createPayments}
                  onChange={(e) => setCreatePayments(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-2 focus:ring-teal-600/20"
                />
                Registar os recibos também como pagamentos (rendas recebidas).
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={updateRents}
                  onChange={(e) => setUpdateRents(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-2 focus:ring-teal-600/20"
                />
                Substituir a renda dos contratos pelo último recibo (usar só se NÃO importaste a
                lista de contratos).
              </label>
            </>
          )}

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Pré-visualização
            </p>
            {rowCount === 0 ? (
              <EmptyState icon={FileWarning}>
                Nenhuma linha válida com este mapeamento. Confirma as colunas obrigatórias (*).
              </EmptyState>
            ) : preview.kind === "recibos" ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Imóvel</Th>
                    <Th>Mês</Th>
                    <Th className="text-right">Valor</Th>
                    <Th>Nº recibo</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <Td className="max-w-52 truncate">{r.property_label}</Td>
                      <Td className="font-mono">{monthLabel(r.ref_month)}</Td>
                      <Td className="text-right tabular-nums">{fmtEur(r.amount, 2)}</Td>
                      <Td className="font-mono">{r.receipt_number ?? "n/d"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : preview.kind === "contratos" ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Imóvel</Th>
                    <Th>Locatário</Th>
                    <Th className="text-right">Renda</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <Td className="max-w-52 truncate">{r.property_label}</Td>
                      <Td className="max-w-52 truncate">{r.tenant_name ?? "n/d"}</Td>
                      <Td className="text-right tabular-nums">{fmtEur(r.rent, 2)}</Td>
                      <Td>{r.status}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Identificador</Th>
                    <Th>Parte</Th>
                    <Th>Ano</Th>
                    <Th className="text-right">Valor (VPT)</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <Td className="font-mono">{r.identificador}</Td>
                      <Td>{r.parte ?? "n/d"}</Td>
                      <Td className="tabular-nums">{r.ano ?? "n/d"}</Td>
                      <Td className="text-right tabular-nums">{fmtEur(r.valor, 0)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              {rowCount} linha(s) válida(s)
              {preview.kind === "recibos" && preview.anuladoCount > 0
                ? ` · ${preview.anuladoCount} anulado(s) excluído(s)`
                : ""}
              {preview.invalidCount > 0 ? ` · ${preview.invalidCount} inválida(s)` : ""} de{" "}
              {sheet.rows.length} no ficheiro.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={handleStartImport}
              disabled={rowCount === 0 || !landlordId || missingRequired}
            >
              Importar {rowCount} linhas
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {importing && (
            <p className="text-sm text-zinc-600">
              {batchProgress ? `Lote ${batchProgress.i} de ${batchProgress.n}…` : "A importar…"}
            </p>
          )}
          {importError && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{importError}</p>
              <Button variant="outline" size="sm" onClick={resetAll}>
                Recomeçar
              </Button>
            </div>
          )}
          {!importing && receiptResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Frações criadas" value={receiptResult.createdProperties} />
                <StatCard label="Contratos criados" value={receiptResult.createdContracts} />
                <StatCard label="Recibos inseridos" value={receiptResult.insertedReceipts} tone="teal" />
                <StatCard label="Pagamentos registados" value={receiptResult.insertedPayments} tone="teal" />
                <StatCard
                  label="Linhas ignoradas"
                  value={receiptResult.skippedRows}
                  tone={receiptResult.skippedRows > 0 ? "amber" : "zinc"}
                />
              </div>
              {syncInfo && <p className="text-sm text-emerald-700">{syncInfo}</p>}
              {syncError && <p className="text-sm text-red-600">Renda dos contratos: {syncError}</p>}
              <Button onClick={resetAll}>Importar outro ficheiro</Button>
            </div>
          )}
          {!importing && contractResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Frações criadas" value={contractResult.createdProperties} />
                <StatCard label="Contratos criados" value={contractResult.createdContracts} tone="teal" />
                <StatCard label="Contratos atualizados" value={contractResult.updatedContracts} tone="teal" />
              </div>
              <Button onClick={resetAll}>Importar outro ficheiro</Button>
            </div>
          )}
          {!importing && patrimonioResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Frações correspondidas" value={patrimonioResult.matched} tone="teal" />
                <StatCard
                  label="Não encontradas"
                  value={patrimonioResult.unmatched}
                  tone={patrimonioResult.unmatched > 0 ? "amber" : "zinc"}
                />
                <StatCard label="Quotas atualizadas" value={patrimonioResult.updatedQuotas} />
              </div>
              {patrimonioResult.unmatched > 0 && (
                <p className="text-sm text-amber-700">
                  Há frações do CSV sem correspondência. Importa primeiro os contratos e/ou os
                  recibos desse senhorio para as criar.
                </p>
              )}
              <Button onClick={resetAll}>Importar outro ficheiro</Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-snug text-zinc-400">
        No Portal das Finanças: Arrendamento → Contratos (exportar lista), Arrendamento → Recibos
        de Renda → Consultar (exportar lista) e Património Predial → lista de imóveis (CSV).
        Importa um ficheiro por senhorio, pela ordem contratos → recibos → património.
      </p>
    </Card>
  );
}
