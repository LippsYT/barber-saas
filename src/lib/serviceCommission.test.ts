import { describe, expect, it } from "vitest";
import { computeLineCommission, pickRule, type CommissionRule } from "./commission";
import { clampPercent, commissionLabel, draftsToDbRows, draftsToRules, type BarberCommissionDraft } from "./serviceCommission";

const business: CommissionRule = {
  id: "biz", member_id: null, item_type: "service", item_id: null, kind: "percent", value: 50, base: "net_of_discount",
};

const drafts: BarberCommissionDraft[] = [
  { memberId: "kevin", selected: true, kind: "percent", value: 30 },
  { memberId: "andres", selected: true, kind: "fixed", value: 400 },
  { memberId: "yuleizi", selected: false, kind: "percent", value: 80 },
];

describe("comisión por servicio y barbero", () => {
  const rules = draftsToRules("corte", drafts);

  it("solo guarda a los colaboradores marcados, con tope de porcentaje", () => {
    expect(rules.map((r) => r.member_id)).toEqual(["kevin", "andres"]);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(draftsToRules("corte", [{ memberId: "a", selected: true, kind: "percent", value: 130.4 }])[0].value).toBe(100);
  });

  it("la regla del barbero+servicio gana sobre la del negocio", () => {
    const line = { item_type: "service" as const, item_id: "corte", member_id: "kevin", description: "corte", qty: 1, unit_price: 2000, discount: 0 };
    expect(pickRule([business, ...rules], line, "2026-10-30")?.rule.member_id).toBe("kevin");
    expect(computeLineCommission(line, [business, ...rules], "2026-10-30").amount).toBe(600);
  });

  it("monto fijo en centavos por unidad", () => {
    const line = { item_type: "service" as const, item_id: "corte", member_id: "andres", description: "corte", qty: 2, unit_price: 2000, discount: 500 };
    const { amount, snapshot } = computeLineCommission(line, [business, ...rules], "2026-10-30");
    expect(snapshot.rule?.kind).toBe("fixed");
    expect(snapshot.rule?.scope).toBe("member_item");
    expect(amount).toBe(800);
  });

  it("quien no está marcado sigue con la regla del negocio", () => {
    const line = { item_type: "service" as const, item_id: "corte", member_id: "yuleizi", description: "corte", qty: 1, unit_price: 1000, discount: 0 };
    expect(computeLineCommission(line, [business, ...rules], "2026-10-30").amount).toBe(500);
  });

  it("filas de base sin id y con el negocio", () => {
    const rows = draftsToDbRows("biz-1", "corte", drafts);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ business_id: "biz-1", item_id: "corte", item_type: "service", base: "net_of_discount", kind: "percent", value: 30 });
    expect(rows[0]).not.toHaveProperty("id");
  });

  it("etiqueta en español", () => {
    expect(commissionLabel("percent", 30)).toBe("30 %");
    expect(commissionLabel("fixed", 1050)).toBe("US$ 10.50 por servicio");
  });
});
