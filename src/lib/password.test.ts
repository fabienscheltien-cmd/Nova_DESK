import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("refuse moins de 8 caractères", () => expect(passwordProblem("Ab1defg")).not.toBeNull());
  it("exige une majuscule", () => expect(passwordProblem("abcdefg1")).not.toBeNull());
  it("exige une minuscule", () => expect(passwordProblem("ABCDEFG1")).not.toBeNull());
  it("exige un chiffre", () => expect(passwordProblem("Abcdefgh")).not.toBeNull());
  it("accepte un mot de passe conforme", () => expect(passwordProblem("Accueil2026")).toBeNull());
});
