/** Règles : 8 caractères minimum, au moins une majuscule, une minuscule et un chiffre. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "8 caractères minimum";
  if (!/[A-Z]/.test(pw)) return "Au moins une majuscule";
  if (!/[a-z]/.test(pw)) return "Au moins une minuscule";
  if (!/[0-9]/.test(pw)) return "Au moins un chiffre";
  return null;
}
