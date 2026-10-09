import { describe, expect, it } from "vitest";
import { applySiteOverrides } from "./data.functions";

const base = [
  { id: "a", price_cents: 500 },
  { id: "b", price_cents: 800 },
];

describe("prix et prestations par site", () => {
  it("applique le prix spécifique du site", () => {
    const r = applySiteOverrides(base, [{ service_id: "a", active: true, price_cents: 350 }]);
    expect(r.find((s) => s.id === "a")?.price_cents).toBe(350);
  });
  it("masque une prestation désactivée pour le site", () => {
    const r = applySiteOverrides(base, [{ service_id: "b", active: false, price_cents: null }]);
    expect(r.map((s) => s.id)).toEqual(["a"]);
  });
  it("garde le prix catalogue sans réglage du site", () => {
    expect(applySiteOverrides(base, [])[1].price_cents).toBe(800);
  });
});
