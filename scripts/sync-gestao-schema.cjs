const fs = require("node:fs");
const marker = "-- V5 · GESTÃO OPERACIONAL · 2026-10-09";
const schema = fs.readFileSync("supabase/schema.sql", "utf8");
const at = schema.indexOf(marker);
if (at < 0) throw new Error("Marcador da migração ausente.");
fs.writeFileSync("supabase/schema.sql", schema.slice(0, at) + marker + "\n-- Cópia autónoma: supabase/gestao-operacional.sql\n" + fs.readFileSync("supabase/gestao-operacional.sql", "utf8"));
