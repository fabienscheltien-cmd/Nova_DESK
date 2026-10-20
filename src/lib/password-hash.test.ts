import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password-hash";

describe("hashPassword / verifyPassword", () => {
  it("vérifie un mot de passe fraîchement haché", async () => {
    const hash = await hashPassword("Accueil2026");
    expect(hash.startsWith("pbkdf2:")).toBe(true);
    expect(await verifyPassword("Accueil2026", hash)).toBe(true);
  });

  it("rejette un mauvais mot de passe", async () => {
    const hash = await hashPassword("Accueil2026");
    expect(await verifyPassword("accueil2026", hash)).toBe(false);
    expect(await verifyPassword("AutreChose1", hash)).toBe(false);
  });

  it("produit un haché différent à chaque appel (sel aléatoire)", async () => {
    const a = await hashPassword("MemeMot2Passe");
    const b = await hashPassword("MemeMot2Passe");
    expect(a).not.toBe(b);
    expect(await verifyPassword("MemeMot2Passe", a)).toBe(true);
    expect(await verifyPassword("MemeMot2Passe", b)).toBe(true);
  });

  it("accepte l'empreinte SHA-256 historique des comptes migrés", async () => {
    // sha256("AncienMdp1") calculé en base lors de la migration.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("AncienMdp1"));
    const legacy = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await verifyPassword("AncienMdp1", legacy)).toBe(true);
    expect(await verifyPassword("MauvaisMdp1", legacy)).toBe(false);
  });

  it("rejette les valeurs vides ou malformées", async () => {
    expect(await verifyPassword("QuelqueChose1", null)).toBe(false);
    expect(await verifyPassword("QuelqueChose1", "")).toBe(false);
    expect(await verifyPassword("QuelqueChose1", "pbkdf2:abc")).toBe(false);
    expect(await verifyPassword("QuelqueChose1", "pas-du-hex")).toBe(false);
  });
});
