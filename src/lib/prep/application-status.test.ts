import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  DEFAULT_APPLICATION_STATUS,
  isApplicationStatus,
  toApplicationStatus,
} from "./application-status";

describe("application-status", () => {
  it("o padrão é 'preparando' e está na lista", () => {
    expect(DEFAULT_APPLICATION_STATUS).toBe("preparando");
    expect(APPLICATION_STATUSES).toContain(DEFAULT_APPLICATION_STATUS);
  });

  it("todo status tem rótulo em português", () => {
    for (const s of APPLICATION_STATUSES) {
      expect(APPLICATION_STATUS_LABEL[s]).toMatch(/\S/);
    }
  });

  it("os valores batem com o CHECK da migration 0025", async () => {
    // Se a lista mudar sem a migration (ou o contrário), a gravação falha em
    // produção com violação de CHECK. Este teste lê o SQL pra pegar isso.
    const fs = await import("node:fs");
    const sql = fs.readFileSync("supabase/migrations/0025_prep_application_status.sql", "utf8");
    const m = sql.match(/check \(application_status in\s*\(([^)]*)\)\)/i);
    expect(m, "CHECK não encontrado na migration").not.toBeNull();
    const noSql = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(noSql).toEqual([...APPLICATION_STATUSES]);
  });

  it("isApplicationStatus aceita só os valores da lista", () => {
    expect(isApplicationStatus("entrevista")).toBe(true);
    for (const ruim of ["", "Entrevista", "contratado", null, undefined, 3, {}]) {
      expect(isApplicationStatus(ruim)).toBe(false);
    }
  });

  it("valor desconhecido vindo do banco cai no padrão, sem quebrar", () => {
    expect(toApplicationStatus("oferta")).toBe("oferta");
    expect(toApplicationStatus("lixo")).toBe("preparando");
    expect(toApplicationStatus(null)).toBe("preparando");
  });
});
