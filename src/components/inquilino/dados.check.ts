import assert from "node:assert/strict";
import { diaHabitual } from "./dados";

const hoje = "2026-11-13";
assert.equal(diaHabitual([], hoje), null);
assert.equal(diaHabitual(["2026-11-05", "2026-10-15", "2026-09-09"], hoje), 9);
assert.equal(diaHabitual(["2026-11-05", "2026-10-10"], hoje), 8);
assert.equal(diaHabitual(["2026-11-18", "2026-10-19"], "2026-11-20"), 19);
assert.equal(diaHabitual([null, "2025-11-01", "2026-11-14", "2026-02-30"], hoje), null);
assert.equal(diaHabitual(["2025-12-02", "2026-11-12"], hoje), 7);
console.log("inquilino/dados.check.ts: OK (mediana, janela, datas e ausência de dados)");
