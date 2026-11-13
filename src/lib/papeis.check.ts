// Self-check dos papéis. Corre com `npm run check`.
import assert from "node:assert/strict";
import { ROTULO_PAPEL, pode } from "./papeis";

assert.equal(pode("gestor", "registar_pagamento"), true);
assert.equal(pode("gestor", "registar_evento"), true);
assert.equal(pode("gestor", "gerir_caso"), true);
assert.equal(pode("gestor", "anular_pagamento"), false);
assert.equal(pode("gestor", "editar_contrato"), false);
assert.equal(pode("gestor", "ver_controlo"), false);
assert.equal(pode("gestor", "administrar"), false);
assert.equal(pode("viewer", "registar_evento"), false);
assert.equal(pode("viewer", "registar_pagamento"), false);
assert.equal(pode("viewer", "gerir_caso"), false);
assert.equal(pode("viewer", "anular_pagamento"), false);
assert.equal(pode("viewer", "editar_contrato"), false);
assert.equal(pode("viewer", "ver_controlo"), false);
assert.equal(pode("viewer", "administrar"), false);
assert.equal(pode("admin", "registar_pagamento"), true);
assert.equal(pode("admin", "registar_evento"), true);
assert.equal(pode("admin", "gerir_caso"), true);
assert.equal(pode("admin", "anular_pagamento"), true);
assert.equal(pode("admin", "editar_contrato"), true);
assert.equal(pode("admin", "ver_controlo"), true);
assert.equal(pode("admin", "administrar"), true);
assert.deepEqual(ROTULO_PAPEL, { admin: "Administrador", gestor: "Gestor", viewer: "Leitura" });

console.log("papeis.check: OK");
